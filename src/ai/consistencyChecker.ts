import type { Scene } from '../types/scene';
import type { ConsistencyIssue } from '../types/consistency';
import type { ForeshadowingIndex } from '../types/story';
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
        suggestion: '씬을 분할하거나 블록 수를 줄이세요',
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
