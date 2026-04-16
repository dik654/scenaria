/**
 * 씬 자동 분석 모듈
 * 저장 시 단일 AI 호출로 요약 + 스레드 감지 + 복선 감지
 */
import { callAI, findBalancedJSON } from './aiClient';
import type { AppSettings } from '../types/project';
import type { Scene, CharacterState } from '../types/scene';

// ── Types ──

export interface AutoAnalysisResult {
  summary?: string;
  detectedThreadNames?: string[];
  detectedForeshadowing?: {
    blockIndex: number;
    description: string;
    importance: 'minor' | 'major' | 'critical';
  }[];
  characterStates?: CharacterState[];
}

interface AnalysisContext {
  existingThreads?: { id: string; name: string; description: string }[];
  prevSceneSummaries?: { number: number; summary: string }[];
  unresolvedForeshadowing?: { description: string; importance: string }[];
}

// ── Prompt ──

const SYSTEM_AUTO_ANALYSIS = `당신은 한국 영화 시나리오 분석 전문가입니다.
씬 내용을 분석하여 다음 정보를 JSON으로 반환하세요:

{
  "summary": "2~3줄로 씬의 핵심 내용 요약",
  "relevantThreads": ["연관된 기존 플롯 스레드 이름 목록"],
  "foreshadowing": [
    {
      "blockIndex": 0,
      "description": "복선으로 보이는 요소 설명",
      "importance": "minor|major|critical"
    }
  ],
  "characterStates": [
    {
      "characterId": "캐릭터이름",
      "emotional": "이 씬 종료 시점의 감정 상태 (예: 분노, 의심, 안도)",
      "situation": "이 씬에서 캐릭터에게 일어난 일과 현재 처지 (1줄)"
    }
  ]
}

규칙:
- summary: 핵심 사건, 캐릭터 행동, 감정 변화를 포함. 2~3줄.
- relevantThreads: 제공된 기존 스레드 이름 중 이 씬에서 진행되는 것만 선택. 없으면 빈 배열.
- foreshadowing: 나중에 회수될 수 있는 소품, 대사, 행동만 감지. 없으면 빈 배열.
- characterStates: 이 씬에 등장하는 **모든** 캐릭터의 씬 종료 시점 감정/상황. 중요!
  - emotional: 단어 2~3개로 감정 상태 (예: "배신감과 분노", "불안한 기대")
  - situation: 이 씬에서 겪은 일과 결과 (예: "진실을 알게 되었지만 증거를 숨기기로 결심")
- blockIndex는 씬 내용에 표시된 [번호]를 사용하세요.
- JSON만 반환하세요. 다른 설명은 쓰지 마세요.`;

// ── Helpers ──

function buildAutoAnalysisPrompt(scene: Scene, ctx: AnalysisContext): string {
  const parts: string[] = [];

  parts.push(`## 씬 헤더\n${scene.header.interior}. ${scene.header.location} - ${scene.header.timeOfDay}\n`);

  parts.push('## 씬 내용');
  scene.blocks.forEach((b, i) => {
    if (b.type === 'action') parts.push(`[${i}] 지문: ${b.text}`);
    else if (b.type === 'character') parts.push(`[${i}] 캐릭터: ${b.characterId}`);
    else if (b.type === 'dialogue') parts.push(`[${i}] 대사: ${b.text}`);
    else if (b.type === 'parenthetical') parts.push(`[${i}] 지시문: ${b.text}`);
    else if (b.type === 'transition') parts.push(`[${i}] 전환: ${b.transitionType}`);
  });
  parts.push('');

  if (ctx.prevSceneSummaries?.length) {
    parts.push('## 이전 씬 요약');
    for (const s of ctx.prevSceneSummaries) {
      parts.push(`- S#${s.number}: ${s.summary}`);
    }
    parts.push('');
  }

  if (ctx.existingThreads?.length) {
    parts.push('## 기존 플롯 스레드');
    for (const t of ctx.existingThreads) {
      parts.push(`- ${t.name}: ${t.description}`);
    }
    parts.push('');
  }

  if (ctx.unresolvedForeshadowing?.length) {
    parts.push('## 미해결 복선');
    for (const f of ctx.unresolvedForeshadowing) {
      parts.push(`- [${f.importance}] ${f.description}`);
    }
    parts.push('');
  }

  parts.push('이 씬을 분석하여 JSON을 반환해주세요.');
  return parts.join('\n');
}

/** 블록 내용 기반 간단 해시 (변경 감지용) */
export function sceneContentHash(scene: Scene): string {
  return scene.blocks
    .map((b) => {
      if (b.type === 'character') return `C:${b.characterId}`;
      if ('text' in b) return `${b.type[0]}:${b.text.slice(0, 50)}`;
      return '';
    })
    .join('|');
}

export function shouldRunAnalysis(
  scene: Scene,
  existingSummary: string | undefined,
  lastAnalyzedHash: string | undefined,
  enabled: boolean,
): boolean {
  if (!enabled) return false;

  // 의미 있는 블록이 3개 미만이면 스킵
  const contentBlocks = scene.blocks.filter(
    (b) => ('text' in b && b.text.trim().length > 0) || b.type === 'character',
  );
  if (contentBlocks.length < 3) return false;

  // 요약이 비어있으면 분석 실행
  if (!existingSummary || !existingSummary.trim()) return true;

  // 요약은 있지만 내용이 변경되었으면 재분석
  if (lastAnalyzedHash) {
    const currentHash = sceneContentHash(scene);
    if (currentHash !== lastAnalyzedHash) return true;
  }

  return false;
}

// ── Main ──

export async function analyzeSceneContent(
  ai: AppSettings['ai'],
  scene: Scene,
  ctx: AnalysisContext,
): Promise<AutoAnalysisResult> {
  if (!ai.apiKey && ai.provider !== 'local-vllm' && ai.provider !== 'claude-code') return {};

  const userPrompt = buildAutoAnalysisPrompt(scene, ctx);
  const [raw] = await callAI(ai, SYSTEM_AUTO_ANALYSIS, userPrompt, 1, 1024);

  const jsonStr = findBalancedJSON(raw);
  if (!jsonStr) return {};

  try {
    const parsed = JSON.parse(jsonStr);
    const result: AutoAnalysisResult = {};

    if (typeof parsed.summary === 'string' && parsed.summary.trim()) {
      result.summary = parsed.summary.trim();
    }

    if (Array.isArray(parsed.relevantThreads)) {
      result.detectedThreadNames = parsed.relevantThreads.filter(
        (t: unknown) => typeof t === 'string',
      );
    }

    if (Array.isArray(parsed.foreshadowing)) {
      result.detectedForeshadowing = parsed.foreshadowing
        .filter(
          (f: Record<string, unknown>) =>
            typeof f.description === 'string' &&
            ['minor', 'major', 'critical'].includes(f.importance as string),
        )
        .map((f: Record<string, unknown>) => ({
          blockIndex: typeof f.blockIndex === 'number' ? f.blockIndex : 0,
          description: f.description as string,
          importance: f.importance as 'minor' | 'major' | 'critical',
        }));
    }

    if (Array.isArray(parsed.characterStates)) {
      result.characterStates = parsed.characterStates
        .filter(
          (cs: Record<string, unknown>) =>
            typeof cs.characterId === 'string' &&
            typeof cs.emotional === 'string' &&
            typeof cs.situation === 'string',
        )
        .map((cs: Record<string, unknown>) => ({
          characterId: cs.characterId as string,
          emotional: cs.emotional as string,
          situation: cs.situation as string,
        }));
    }

    return result;
  } catch {
    return {};
  }
}
