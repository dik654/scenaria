import { useCallback } from 'react';
import type { Scene, SceneBlock, CharacterBlock } from '../../types/scene';
import { useSceneStore } from '../../store/sceneStore';
import { useProjectStore } from '../../store/projectStore';
import { fileIO } from '../../io';
import { nextSceneId, renumberScenes } from '../../utils/sceneNumbering';
import { sceneFilename } from '../../utils/fileNaming';

export function useSplitScene(currentScene: Scene | null, selectedBlockIndex: number | null) {
  const { dirHandle } = useProjectStore();

  const splitScene = useCallback(async () => {
    if (!currentScene || !dirHandle || selectedBlockIndex === null || selectedBlockIndex === 0) return;
    const state = useSceneStore.getState();
    const entry = state.index.find((s) => s.id === currentScene.id);
    if (!entry) return;

    const blocksA = currentScene.blocks.slice(0, selectedBlockIndex);
    const blocksB = currentScene.blocks.slice(selectedBlockIndex);
    if (blocksA.length === 0 || blocksB.length === 0) return;

    const currentIndex = state.index;
    const newId = nextSceneId(currentIndex);

    const extractChars = (blocks: SceneBlock[]) =>
      [...new Set(
        blocks.filter((b): b is CharacterBlock => b.type === 'character')
          .map((b) => b.characterId)
          .filter(Boolean)
      )];

    const newScene: Scene = { ...currentScene, id: newId, version: 1, blocks: blocksB, characters: extractChars(blocksB) };
    const sceneA: Scene = { ...currentScene, blocks: blocksA, characters: extractChars(blocksA) };
    const newFilename = sceneFilename(newId, newScene.header.location);

    await fileIO.writeJSON(dirHandle, `screenplay/${entry.filename}`, sceneA);
    await fileIO.writeJSON(dirHandle, `screenplay/${newFilename}`, newScene);

    const insertAt = currentIndex.findIndex((s) => s.id === currentScene.id) + 1;
    const newEntry = { ...entry, id: newId, filename: newFilename, characterCount: newScene.characters.length };
    const renumbered = renumberScenes([...currentIndex.slice(0, insertAt), newEntry, ...currentIndex.slice(insertAt)]);
    await fileIO.writeJSON(dirHandle, 'screenplay/_index.json', { scenes: renumbered });

    state.updateCurrentScene(sceneA);
    state.markClean();
    state.updateIndexEntry(currentScene.id, { characterCount: sceneA.characters.length });
    state.setIndex(renumbered);
    state.setCurrentScene(newId, newScene);
  }, [currentScene, dirHandle, selectedBlockIndex]);

  return { splitScene };
}
