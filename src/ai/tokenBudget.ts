/**
 * 토큰 예산 관리 유틸리티
 * 모델별 컨텍스트 윈도우 매핑 + 토큰 추정 + 예산 기반 컨텍스트 절삭
 */
import type { AppSettings } from '../types/project';

type AIProvider = AppSettings['ai'];

// ── 모델별 컨텍스트 윈도우 (토큰) ──

const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  // Claude
  'claude-opus-4-6': 200_000,
  'claude-sonnet-4-6': 200_000,
  'claude-sonnet-4-5-20250514': 200_000,
  'claude-3-5-sonnet': 200_000,
  'claude-3-haiku': 200_000,
  'claude-3-opus': 200_000,
  // OpenAI
  'gpt-4o': 128_000,
  'gpt-4o-mini': 128_000,
  'gpt-4-turbo': 128_000,
  'gpt-4': 8_192,
  'gpt-3.5-turbo': 16_385,
  'o1': 200_000,
  'o1-mini': 128_000,
  // Google (OpenAI-compatible)
  'gemini-2.0-flash': 1_048_576,
  'gemini-1.5-pro': 2_097_152,
  'gemini-1.5-flash': 1_048_576,
};

/** Fallback context limits by provider when model name is unknown */
const PROVIDER_DEFAULTS: Record<string, number> = {
  'claude-code': 200_000,
  claude: 200_000,
  openai: 128_000,
  'local-vllm': 8_192, // Conservative default for local models
};

/**
 * 모델의 전체 컨텍스트 윈도우 크기 반환 (토큰)
 * Settings의 contextWindow가 있으면 우선 사용 (local-vllm 사용자 설정용)
 */
export function getModelContextLimit(ai: AIProvider): number {
  // User-configured override (especially useful for local-vllm)
  if (ai.contextWindow && ai.contextWindow > 0) return ai.contextWindow;

  const model = (ai.model ?? '').toLowerCase();

  // Exact match
  if (MODEL_CONTEXT_LIMITS[model]) return MODEL_CONTEXT_LIMITS[model];

  // Partial match (e.g. "claude-sonnet-4-6-20250514" matches "claude-sonnet-4-6")
  for (const [key, limit] of Object.entries(MODEL_CONTEXT_LIMITS)) {
    if (model.includes(key) || key.includes(model)) return limit;
  }

  return PROVIDER_DEFAULTS[ai.provider] ?? 8_192;
}

// ── 토큰 추정 ──

/**
 * 텍스트의 대략적 토큰 수 추정
 * - 한글: ~1.5 토큰/글자 (BPE 기준 한글은 보통 2-3 byte → 1~2 토큰)
 * - 영문/숫자: ~0.25 토큰/글자 (4글자 ≈ 1 토큰)
 * - 공백/특수문자: ~0.5 토큰/글자
 *
 * 정확한 토크나이저 없이도 ±15% 이내의 추정치 제공
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  let tokens = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0xAC00 && code <= 0xD7AF) {
      // 한글 완성형 (가~힣)
      tokens += 1.5;
    } else if (code >= 0x3131 && code <= 0x318E) {
      // 한글 자모
      tokens += 1;
    } else if (code >= 0x4E00 && code <= 0x9FFF) {
      // CJK 한자
      tokens += 1.5;
    } else if (code >= 0x3040 && code <= 0x30FF) {
      // 히라가나/카타카나
      tokens += 1.5;
    } else if (code <= 0x7F) {
      // ASCII (영문, 숫자, 기본 특수문자)
      if (/[a-zA-Z0-9]/.test(ch)) {
        tokens += 0.25;
      } else if (ch === ' ' || ch === '\n' || ch === '\t') {
        tokens += 0.25;
      } else {
        tokens += 0.5;
      }
    } else {
      // 기타 유니코드
      tokens += 1;
    }
  }

  // Minimum 1 token for non-empty text
  return Math.max(1, Math.ceil(tokens));
}

// ── 입력 예산 계산 ──

/** 시스템 프롬프트 + NO_WEB_SEARCH 헤더의 대략적 토큰 오버헤드 */
const SYSTEM_OVERHEAD_TOKENS = 800;

/**
 * 스토리 컨텍스트에 사용 가능한 토큰 예산 계산
 *
 * contextWindow = systemPrompt + userPrompt(storyCtx + modePrompt) + outputTokens
 * storyCtxBudget = contextWindow - systemOverhead - modePromptEstimate - outputTokens - safetyMargin
 */
export function getStoryContextBudget(
  ai: AIProvider,
  outputTokens: number,
  modePromptTokens: number = 500,
): number {
  const contextLimit = getModelContextLimit(ai);
  const safetyMargin = Math.min(500, Math.floor(contextLimit * 0.02));
  const budget = contextLimit - SYSTEM_OVERHEAD_TOKENS - modePromptTokens - outputTokens - safetyMargin;
  return Math.max(1000, budget); // Minimum 1000 tokens for story context
}

// ── 섹션 기반 예산 분배 + 절삭 ──

export interface ContextSection {
  /** 섹션 식별자 */
  key: string;
  /** 렌더링된 텍스트 */
  content: string;
  /** 우선순위 (1 = 최우선, 숫자가 클수록 낮은 우선순위) */
  priority: number;
}

/**
 * 우선순위 기반으로 섹션들을 예산 내에 맞춤
 *
 * 1. 모든 섹션을 우선순위순으로 정렬
 * 2. 높은 우선순위부터 예산 내에 포함
 * 3. 예산 초과 시 낮은 우선순위 섹션부터 제거
 * 4. 마지막으로 포함되는 섹션이 예산을 초과하면 텍스트를 줄 단위로 절삭
 *
 * @returns 예산 내에 맞춰진 섹션들 (원래 key 순서 유지)
 */
export function fitSectionsToTokenBudget(
  sections: ContextSection[],
  budgetTokens: number,
): ContextSection[] {
  if (sections.length === 0) return [];

  // 우선순위순 정렬 (낮은 숫자 = 높은 우선순위)
  const sorted = [...sections].sort((a, b) => a.priority - b.priority);

  let usedTokens = 0;
  const included = new Set<string>();

  for (const section of sorted) {
    const sectionTokens = estimateTokens(section.content);

    if (usedTokens + sectionTokens <= budgetTokens) {
      // 전체 포함
      included.add(section.key);
      usedTokens += sectionTokens;
    } else {
      // 남은 예산으로 줄 단위 절삭 시도
      const remaining = budgetTokens - usedTokens;
      if (remaining > 100) {
        const truncated = truncateToTokens(section.content, remaining);
        if (truncated) {
          included.add(section.key);
          // Replace content with truncated version
          section.content = truncated;
          usedTokens += estimateTokens(truncated);
        }
      }
      // 이후 섹션은 모두 제외 (우선순위가 더 낮으므로)
      break;
    }
  }

  // 원래 삽입 순서 유지하면서 포함된 섹션만 반환
  return sections.filter(s => included.has(s.key));
}

/**
 * 텍스트를 주어진 토큰 예산에 맞게 줄 단위로 자르기
 * 마지막에 "[... 이하 생략]" 표시 추가
 */
function truncateToTokens(text: string, budgetTokens: number): string | null {
  const lines = text.split('\n');
  const result: string[] = [];
  let tokens = 0;
  const suffixTokens = estimateTokens('\n[... 이하 생략]');

  for (const line of lines) {
    const lineTokens = estimateTokens(line + '\n');
    if (tokens + lineTokens + suffixTokens > budgetTokens) break;
    result.push(line);
    tokens += lineTokens;
  }

  if (result.length === 0) return null;
  if (result.length < lines.length) {
    result.push('[... 이하 생략]');
  }
  return result.join('\n');
}
