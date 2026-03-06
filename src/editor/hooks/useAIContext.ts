import { useMemo } from 'react';
import type { Scene, SceneIndexEntry } from '../../types/scene';
import type { Character } from '../../types/character';
import type { ProjectMeta } from '../../types/project';
import { buildContextMarkdown } from '../../ai/contextBuilder';

export function useAIContext(
  currentScene: Scene | null,
  currentSceneId: string | null,
  sceneIndex: SceneIndexEntry[],
  loadedCharacters: Record<string, Character>,
  projectMeta: ProjectMeta | null,
  hasApiKey: boolean,
): string | undefined {
  return useMemo(() => {
    if (!currentScene || !hasApiKey) return undefined;
    const curIdx = sceneIndex.findIndex(s => s.id === currentSceneId);
    const prevEntry = curIdx > 0 ? sceneIndex[curIdx - 1] : undefined;
    const nextEntry = curIdx >= 0 && curIdx < sceneIndex.length - 1 ? sceneIndex[curIdx + 1] : undefined;
    const emptyMeta = { summary: '', emotionalTone: [] as string[], tensionLevel: 5, estimatedMinutes: 1, tags: [] as string[] };
    return buildContextMarkdown({
      project: {
        title: projectMeta?.title ?? '제목 없음',
        logline: projectMeta?.logline ?? '',
        genre: projectMeta?.genre ?? [],
      },
      currentScene,
      prevScene: prevEntry ? { meta: { ...emptyMeta, summary: prevEntry.summary ?? '' } } : undefined,
      nextScene: nextEntry ? { meta: { ...emptyMeta, summary: nextEntry.summary ?? '' } } : undefined,
      characters: Object.values(loadedCharacters),
      totalTokens: 0,
    });
  }, [currentScene, currentSceneId, sceneIndex, loadedCharacters, projectMeta, hasApiKey]);
}
