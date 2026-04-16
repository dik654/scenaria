import { useCallback, useRef, useState } from 'react';
import type { Scene, SceneIndexEntry, CharacterBlock } from '../../types/scene';
import { useSceneStore } from '../../store/sceneStore';
import { useProjectStore } from '../../store/projectStore';
import { useStoryStore } from '../../store/storyStore';
import { useAIActivityStore } from '../../store/aiActivityStore';
import { fileIO } from '../../io';
import { shouldRunAnalysis, analyzeSceneContent, sceneContentHash } from '../../ai/autoAnalysis';
import type { ForeshadowingItem } from '../../types/story';

type SaveIndicator = 'saved' | 'saving' | 'unsaved';

export function useSceneSave(currentScene: Scene | null) {
  const { projectRef, autoSave } = useProjectStore();
  const [saveIndicator, setSaveIndicator] = useState<SaveIndicator>('saved');
  const saveTimerRef = useRef<number | null>(null);
  const analysisInProgressRef = useRef<string | null>(null);
  const lastAnalyzedHashRef = useRef<string | null>(null);

  const saveScene = useCallback(async () => {
    // Always read the latest scene from the store to avoid stale closure data
    const state = useSceneStore.getState();
    const sceneNow = state.currentScene;
    if (!sceneNow || !projectRef) return;
    setSaveIndicator('saving');
    try {
      const entry = state.index.find((s) => s.id === sceneNow.id);
      const filename = entry?.filename ?? `${sceneNow.id}.json`;

      const allCharIds = sceneNow.blocks
        .filter((b): b is CharacterBlock => b.type === 'character')
        .map((b) => b.characterId.trim())
        .filter(Boolean);
      const characterIds = [...new Set(allCharIds)];
      const sceneToSave: Scene = { ...sceneNow, characters: characterIds };

      await fileIO.writeJSON(projectRef, `screenplay/${filename}`, sceneToSave);

      const indexUpdates: Partial<SceneIndexEntry> = {
        location: sceneToSave.header.location,
        timeOfDay: sceneToSave.header.timeOfDay,
        interior: sceneToSave.header.interior,
        summary: sceneToSave.meta.summary || undefined,
        tags: sceneToSave.meta.tags,
        cardColor: sceneToSave.meta.cardColor,
        tensionLevel: sceneToSave.meta.tensionLevel,
        status: sceneToSave.meta.status,
        characters: characterIds,
        characterCount: characterIds.length,
      };
      state.updateIndexEntry(sceneToSave.id, indexUpdates);

      const newIndex = useSceneStore.getState().index;
      await fileIO.writeJSON(projectRef, 'screenplay/_index.json', { scenes: newIndex });

      state.markClean();
      setSaveIndicator('saved');
      autoSave?.markDirty();

      // Fire-and-forget auto-analysis (does not block save UX)
      const aiSettings = useProjectStore.getState().settings.ai;
      if (
        shouldRunAnalysis(sceneNow, sceneNow.meta.summary, lastAnalyzedHashRef.current ?? undefined, aiSettings.autoAnalysis !== false) &&
        analysisInProgressRef.current !== sceneNow.id
      ) {
        analysisInProgressRef.current = sceneNow.id;
        const hashAtStart = sceneContentHash(sceneNow);
        runAutoAnalysis(sceneNow, projectRef).then(() => {
          lastAnalyzedHashRef.current = hashAtStart;
        }).finally(() => {
          analysisInProgressRef.current = null;
        });
      }
    } catch (err) {
      console.error('씬 저장 실패:', err);
      setSaveIndicator('unsaved');
    }
  }, [projectRef, autoSave]);

  const scheduleAutosave = useCallback(() => {
    setSaveIndicator('unsaved');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(saveScene, 2000);
  }, [saveScene]);

  return { saveScene, scheduleAutosave, saveIndicator, setSaveIndicator };
}

// ── Fire-and-forget auto-analysis ──

async function runAutoAnalysis(
  scene: Scene,
  projectRef: NonNullable<ReturnType<typeof useProjectStore.getState>['projectRef']>,
): Promise<void> {
  const aiSettings = useProjectStore.getState().settings.ai;
  if (!aiSettings.apiKey && aiSettings.provider !== 'local-vllm' && aiSettings.provider !== 'claude-code') return;

  const aiActivity = useAIActivityStore.getState();
  aiActivity.start();

  try {
    // Gather existing threads + previous scenes + foreshadowing for context
    const storyState = useStoryStore.getState();
    const existingThreads = storyState.threadIndex
      .map((t) => {
        const full = storyState.threads[t.id];
        return { id: t.id, name: t.name, description: full?.description ?? '' };
      })
      .filter((t) => t.description);

    const sceneIndex = useSceneStore.getState().index;
    const curIdx = sceneIndex.findIndex(s => s.id === scene.id);
    const prevSceneSummaries = sceneIndex
      .slice(Math.max(0, curIdx - 3), curIdx)
      .filter(s => s.summary)
      .map(s => ({ number: s.number, summary: s.summary! }));

    const unresolvedForeshadowing = (storyState.foreshadowing?.items ?? [])
      .filter(f => f.status === 'planted')
      .map(f => ({ description: f.plantedIn.description, importance: f.importance }));

    const result = await analyzeSceneContent(aiSettings, scene, {
      existingThreads,
      prevSceneSummaries,
      unresolvedForeshadowing: unresolvedForeshadowing.length > 0 ? unresolvedForeshadowing : undefined,
    });
    if (!result.summary) return;

    // Apply summary + characterStates (only if scene hasn't been edited during analysis)
    const sceneStore = useSceneStore.getState();
    const currentNow = sceneStore.currentScene;
    if (currentNow?.id === scene.id && currentNow.blocks !== scene.blocks) {
      // 사용자가 분석 중 씬을 수정 → 결과 버림 (다음 저장에서 재분석)
      return;
    }
    const metaUpdates: Partial<Scene['meta']> = { summary: result.summary };
    if (result.characterStates?.length) {
      metaUpdates.characterStates = result.characterStates;
    }
    if (currentNow?.id === scene.id) {
      const updated: Scene = {
        ...currentNow,
        meta: { ...currentNow.meta, ...metaUpdates },
      };
      sceneStore.updateCurrentScene(updated);
    }
    sceneStore.updateIndexEntry(scene.id, { summary: result.summary });

    // Persist updated scene + index
    const entry = sceneStore.index.find((s) => s.id === scene.id);
    const filename = entry?.filename ?? `${scene.id}.json`;
    const latestScene = sceneStore.currentScene?.id === scene.id
      ? sceneStore.currentScene
      : { ...scene, meta: { ...scene.meta, summary: result.summary } };
    await fileIO.writeJSON(projectRef, `screenplay/${filename}`, latestScene);
    await fileIO.writeJSON(projectRef, 'screenplay/_index.json', {
      scenes: useSceneStore.getState().index,
    });

    // Apply thread associations
    if (result.detectedThreadNames?.length) {
      const nameToId = new Map<string, string>();
      for (const t of existingThreads) {
        nameToId.set(t.name.toLowerCase(), t.id);
      }
      for (const name of result.detectedThreadNames) {
        const threadId = nameToId.get(name.toLowerCase());
        if (!threadId) continue;
        const thread = storyState.threads[threadId];
        if (thread && !thread.sceneIds?.includes(scene.id)) {
          storyState.updateThread(threadId, {
            sceneIds: [...(thread.sceneIds ?? []), scene.id],
          });
        }
      }
    }

    // Apply foreshadowing
    if (result.detectedForeshadowing?.length) {
      for (const f of result.detectedForeshadowing) {
        const item: ForeshadowingItem = {
          id: `fs-${scene.id}-${f.blockIndex}-${Date.now()}`,
          type: 'foreshadowing',
          plantedIn: {
            scene: scene.id,
            blockIndex: f.blockIndex,
            description: f.description,
          },
          payoff: null,
          status: 'planted',
          importance: f.importance,
        };
        storyState.addForeshadowingItem(item);
      }
    }
  } catch (err) {
    console.warn('[AutoAnalysis] 실패:', err);
  } finally {
    aiActivity.stop();
  }
}
