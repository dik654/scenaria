import type { Scene } from '../types/scene';
import type { ConsistencyIssue, ConsistencyIssueType, IssueStatus } from '../types/consistency';
import type { ForeshadowingIndex } from '../types/story';
import type { Character } from '../types/character';
import type { AppSettings } from '../types/project';
import { callAI, findBalancedJSON } from './aiClient';
import { SYSTEM_CHARACTER_BEHAVIOR, SYSTEM_SPEECH_STYLE } from './prompts/consistency';
import { nanoid } from 'nanoid';

/**
 * Local (no-AI) consistency rules.
 * Runs synchronously on the scene index.
 */

export function checkUnresolvedForeshadowing(
  foreshadowing: ForeshadowingIndex,
  existingIssues: ConsistencyIssue[]
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const existingIds = new Set(existingIssues.map(i => i.linkedForeshadowing));

  for (const item of foreshadowing.items) {
    if (item.status === 'planted' && !existingIds.has(item.id)) {
      issues.push({
        id: `ci-fs-${item.id}`,
        type: 'unresolved_foreshadowing',
        severity: item.importance === 'critical' ? 'error' : item.importance === 'major' ? 'error' : 'warning',
        description: `미회수 복선: ${item.plantedIn.description} (씬 ${item.plantedIn.scene})`,
        linkedForeshadowing: item.id,
        status: 'open',
      });
    }
  }
  return issues;
}

export function checkSceneTimeContradictions(scenes: Scene[]): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  // Simple heuristic: if a scene has estimated runtime > 60 min, flag it
  for (const scene of scenes) {
    if (scene.meta.estimatedMinutes > 15) {
      issues.push({
        id: `ci-time-${scene.id}`,
        type: 'time_contradiction',
        severity: 'warning',
        description: `S#${scene.id} 예상 상영 시간이 ${scene.meta.estimatedMinutes}분으로 비정상적으로 깁니다`,
        scenes: [scene.id],
        suggestion: '씬을 분할하거나 단락 수를 줄이세요',
        status: 'open',
      });
    }
  }
  return issues;
}

export function checkCharacterLocationContradictions(scenes: Scene[]): ConsistencyIssue[] {
  // Check if same character appears in two scenes with CONTINUOUS transition
  // that have different locations
  const issues: ConsistencyIssue[] = [];

  for (let i = 0; i < scenes.length - 1; i++) {
    const cur = scenes[i];
    const next = scenes[i + 1];

    if (next.header.timeOfDay === 'CONTINUOUS') {
      const curChars = new Set(cur.characters);
      const nextChars = new Set(next.characters);
      const shared = [...curChars].filter(c => nextChars.has(c));

      if (shared.length > 0 && cur.header.location !== next.header.location) {
        // Could be valid (cut to different location) but flag as info
        issues.push({
          id: nanoid(),
          type: 'location_contradiction',
          severity: 'info',
          description: `${shared.join(', ')}이(가) CONTINUOUS 전환으로 다른 장소에 등장합니다 (S#${cur.id} → S#${next.id})`,
          scenes: [cur.id, next.id],
          characters: shared,
          suggestion: '의도적인 교차 편집이면 무시하세요',
          status: 'open',
        });
      }
    }
  }

  return issues;
}

// ── AI-powered consistency checks ──

interface AIIssueItem {
  characterName: string;
  sceneId: string;
  description: string;
  severity: string;
  suggestion: string;
}

function parseAIIssues(raw: string): AIIssueItem[] {
  try {
    let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) cleaned = fenceMatch[1].trim();
    // Use balanced bracket matching to ignore trailing metadata (Gemini grounding etc.)
    const arrStr = findBalancedJSON(cleaned, '[', ']');
    if (!arrStr) return [];
    return JSON.parse(arrStr);
  } catch {
    return [];
  }
}

export async function checkCharacterBehaviorAI(
  scenes: Scene[],
  characters: Character[],
  ai: AppSettings['ai'],
): Promise<ConsistencyIssue[]> {
  if (scenes.length === 0 || characters.length === 0) return [];

  const charSummary = characters.map(c => ({
    id: c.id,
    name: c.name,
    traits: c.personality?.traits?.join(', '),
    flaw: c.drama?.flaw,
    goal: c.drama?.goal,
    arc: c.drama?.arc,
  }));

  const scenesSummary = scenes.slice(0, 30).map(s => ({
    id: s.id,
    location: s.header.location,
    chars: s.characters,
    keyDialogue: s.blocks
      .filter(b => b.type === 'dialogue' && 'text' in b)
      .slice(0, 3)
      .map(b => ('text' in b ? (b.text as string).slice(0, 80) : '')),
    keyActions: s.blocks
      .filter(b => b.type === 'action' && 'text' in b)
      .slice(0, 2)
      .map(b => ('text' in b ? (b.text as string).slice(0, 80) : '')),
  }));

  const userPrompt = `## 캐릭터 프로필\n${JSON.stringify(charSummary, null, 2)}\n\n## 씬 요약 (${scenesSummary.length}개)\n${JSON.stringify(scenesSummary, null, 2)}\n\n캐릭터의 성격, 목표, 결점과 일치하지 않는 행동이나 대사가 있는지 검사하세요.`;

  try {
    const [raw] = await callAI(ai, SYSTEM_CHARACTER_BEHAVIOR, userPrompt, 1, 2048);
    const items = parseAIIssues(raw);
    return items.map(item => ({
      id: `ci-arc-${nanoid(6)}`,
      type: 'character_behavior' as ConsistencyIssueType,
      severity: (item.severity === 'error' ? 'error' : item.severity === 'warning' ? 'warning' : 'info') as ConsistencyIssue['severity'],
      description: item.description,
      scenes: item.sceneId ? [item.sceneId] : undefined,
      characters: item.characterName ? [item.characterName] : undefined,
      suggestion: item.suggestion,
      status: 'open' as IssueStatus,
    }));
  } catch {
    return [];
  }
}

export async function checkSpeechStyleAI(
  scenes: Scene[],
  characters: Character[],
  ai: AppSettings['ai'],
): Promise<ConsistencyIssue[]> {
  if (scenes.length === 0 || characters.length === 0) return [];

  // Extract dialogue samples per character
  const charDialogues = characters.map(c => {
    const samples: string[] = [];
    for (const s of scenes) {
      for (let i = 0; i < s.blocks.length - 1; i++) {
        const blk = s.blocks[i];
        const next = s.blocks[i + 1];
        if (
          blk.type === 'character' &&
          'characterId' in blk &&
          blk.characterId === c.id &&
          next.type === 'dialogue' &&
          'text' in next
        ) {
          samples.push(`[씬 ${s.id}] ${(next.text as string).slice(0, 80)}`);
        }
      }
    }
    return {
      name: c.name,
      speechStyle: c.personality?.speechStyle,
      speechTaboos: c.personality?.speechTaboos,
      samples: samples.slice(0, 10),
    };
  }).filter(c => c.samples.length > 0);

  if (charDialogues.length === 0) return [];

  const userPrompt = `## 캐릭터별 대사 샘플\n${JSON.stringify(charDialogues, null, 2)}\n\n각 캐릭터의 지정된 말투(speechStyle)와 실제 대사의 일관성을 검사하세요. speechTaboos가 있다면 금지 표현 사용 여부도 확인하세요.`;

  try {
    const [raw] = await callAI(ai, SYSTEM_SPEECH_STYLE, userPrompt, 1, 2048);
    const items = parseAIIssues(raw);
    return items.map(item => ({
      id: `ci-speech-${nanoid(6)}`,
      type: 'speech_inconsistency' as ConsistencyIssueType,
      severity: (item.severity === 'warning' ? 'warning' : 'info') as ConsistencyIssue['severity'],
      description: item.description,
      scenes: item.sceneId ? [item.sceneId] : undefined,
      characters: item.characterName ? [item.characterName] : undefined,
      suggestion: item.suggestion,
      status: 'open' as IssueStatus,
    }));
  } catch {
    return [];
  }
}
