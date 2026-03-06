import { useCallback, useRef, useState } from 'react';
import type { Scene, SceneIndexEntry, CharacterBlock } from '../../types/scene';
import { useSceneStore } from '../../store/sceneStore';
import { useProjectStore } from '../../store/projectStore';
import { fileIO } from '../../io';

type SaveIndicator = 'saved' | 'saving' | 'unsaved';

export function useSceneSave(currentScene: Scene | null) {
  const { dirHandle, autoSave } = useProjectStore();
  const [saveIndicator, setSaveIndicator] = useState<SaveIndicator>('saved');
  const saveTimerRef = useRef<number | null>(null);

  const saveScene = useCallback(async () => {
    if (!currentScene || !dirHandle) return;
    setSaveIndicator('saving');
    try {
      const state = useSceneStore.getState();
      const entry = state.index.find((s) => s.id === currentScene.id);
      const filename = entry?.filename ?? `${currentScene.id}.json`;

      const characterIds = [
        ...new Set(
          currentScene.blocks
            .filter((b): b is CharacterBlock => b.type === 'character')
            .map((b) => b.characterId)
            .filter(Boolean)
        ),
      ];
      const sceneToSave: Scene = { ...currentScene, characters: characterIds };

      await fileIO.writeJSON(dirHandle, `screenplay/${filename}`, sceneToSave);

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
      await fileIO.writeJSON(dirHandle, 'screenplay/_index.json', { scenes: newIndex });

      state.updateCurrentScene(sceneToSave);
      state.markClean();
      setSaveIndicator('saved');
      autoSave?.markDirty();
    } catch (err) {
      console.error('씬 저장 실패:', err);
      setSaveIndicator('unsaved');
    }
  }, [currentScene, dirHandle, autoSave]);

  const scheduleAutosave = useCallback(() => {
    setSaveIndicator('unsaved');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(saveScene, 2000);
  }, [saveScene]);

  return { saveScene, scheduleAutosave, saveIndicator, setSaveIndicator };
}
