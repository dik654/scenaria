import { useMemo } from 'react';
import type { Scene, SceneIndexEntry } from '../../types/scene';
import type { Character } from '../../types/character';
import type { ProjectMeta } from '../../types/project';
import { buildContextMarkdown } from '../../ai/contextBuilder';
import { useStoryStore } from '../../store/storyStore';

export function useAIContext(
  currentScene: Scene | null,
  currentSceneId: string | null,
  sceneIndex: SceneIndexEntry[],
  loadedCharacters: Record<string, Character>,
  projectMeta: ProjectMeta | null,
  hasAI: boolean,
): string | undefined {
  const { threadIndex, threads, unresolvedForeshadowing } = useStoryStore();

  return useMemo(() => {
    if (!currentScene || !hasAI) return undefined;
    const curIdx = sceneIndex.findIndex(s => s.id === currentSceneId);
    const prevEntry = curIdx > 0 ? sceneIndex[curIdx - 1] : undefined;
    const nextEntry = curIdx >= 0 && curIdx < sceneIndex.length - 1 ? sceneIndex[curIdx + 1] : undefined;
    const emptyMeta = { summary: '', emotionalTone: [] as string[], tensionLevel: 5, estimatedMinutes: 1, tags: [] as string[] };

    // 활성 플롯 스레드
    const plotThreads = threadIndex.map(t => {
      const full = threads[t.id];
      return { name: t.name, description: full?.description ?? '' };
    }).filter(t => t.description);

    // 미해결 복선
    const unresolvedFs = unresolvedForeshadowing();

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
      plotThreads: plotThreads.length > 0 ? plotThreads : undefined,
      foreshadowing: unresolvedFs.length > 0 ? unresolvedFs : undefined,
      totalTokens: 0,
    });
  }, [currentScene, currentSceneId, sceneIndex, loadedCharacters, projectMeta, hasAI, threadIndex, threads, unresolvedForeshadowing]);
}
