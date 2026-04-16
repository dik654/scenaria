import { useState, useCallback, useEffect } from 'react';
import { useSceneStore } from '../../store/sceneStore';
import { useProjectStore } from '../../store/projectStore';
import { fileIO } from '../../io';
import type { Scene, SceneIndexEntry } from '../../types/scene';
import { nanoid } from 'nanoid';
import { nextSceneId, renumberScenes } from '../../utils/sceneNumbering';
import { sceneFilename } from '../../utils/fileNaming';
import { useConfirm } from '../../components/ConfirmDialog';

function createDefaultScene(id: string): Scene {
  return {
    id,
    version: 1,
    header: { interior: 'INT', location: '장소', timeOfDay: 'DAY' },
    meta: { summary: '', emotionalTone: [], tensionLevel: 5, estimatedMinutes: 1, tags: [] },
    blocks: [{ type: 'action', text: '' }],
    characters: [],
  };
}

export function useSceneOps() {
  const { index, currentSceneId, setCurrentScene, clearCurrentScene, setIndex, addSceneToIndex, removeSceneFromIndex, reorderScenes } = useSceneStore();
  const { projectRef, autoSave } = useProjectStore();
  const confirm = useConfirm();
  const [isAdding, setIsAdding] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleSelectScene = useCallback(async (entry: SceneIndexEntry) => {
    if (!projectRef) return;
    try {
      const prevId = useSceneStore.getState().currentSceneId;
      if (prevId && prevId !== entry.id) {
        autoSave?.onSceneChange(prevId);
      }
      const scene = await fileIO.readJSON<Scene>(projectRef, `screenplay/${entry.filename}`);
      setCurrentScene(entry.id, scene);
    } catch (err) {
      console.error('씬 로드 실패:', err);
    }
  }, [projectRef, setCurrentScene, autoSave]);

  useEffect(() => {
    const handler = (e: Event) => {
      const sceneId = (e as CustomEvent<string>).detail;
      const entry = useSceneStore.getState().index.find(s => s.id === sceneId);
      if (entry) handleSelectScene(entry);
    };
    window.addEventListener('scenaria:gotoScene', handler);
    return () => window.removeEventListener('scenaria:gotoScene', handler);
  }, [handleSelectScene]);

  const handleAddScene = useCallback(async () => {
    if (!projectRef || isAdding) return;
    setIsAdding(true);
    try {
      const id = nextSceneId(index);
      const number = index.length + 1;
      const scene = createDefaultScene(id);
      const filename = sceneFilename(id, scene.header.location);

      await fileIO.writeJSON(projectRef, `screenplay/${filename}`, scene);

      const entry: SceneIndexEntry = {
        id, filename, number,
        location: scene.header.location,
        timeOfDay: scene.header.timeOfDay,
        interior: scene.header.interior,
        summary: '',
        characterCount: 0,
      };

      const newIndex = [...index, entry];
      await fileIO.writeJSON(projectRef, 'screenplay/_index.json', { scenes: newIndex });
      addSceneToIndex(entry);
      setCurrentScene(id, scene);
    } catch (err) {
      console.error('씬 추가 실패:', err);
    } finally {
      setIsAdding(false);
    }
  }, [projectRef, index, isAdding, addSceneToIndex, setCurrentScene]);

  useEffect(() => {
    const handler = () => handleAddScene();
    window.addEventListener('scenaria:addScene', handler);
    return () => window.removeEventListener('scenaria:addScene', handler);
  }, [handleAddScene]);

  const handleDeleteScene = useCallback(async (entry: SceneIndexEntry) => {
    if (!projectRef) return;
    if (!await confirm(`장면 ${entry.number} "${entry.location}"를 삭제하시겠습니까?`)) return;
    try {
      await fileIO.deleteFile(projectRef, `screenplay/${entry.filename}`);
      const newIndex = renumberScenes(index.filter((s) => s.id !== entry.id));
      await fileIO.writeJSON(projectRef, 'screenplay/_index.json', { scenes: newIndex });
      setIndex(newIndex);
      removeSceneFromIndex(entry.id);

      // 삭제한 씬이 현재 씬이면 다른 씬으로 전환하거나 비우기
      if (currentSceneId === entry.id) {
        if (newIndex.length > 0) {
          const next = newIndex[0];
          const scene = await fileIO.readJSON<Scene>(projectRef, `screenplay/${next.filename}`);
          setCurrentScene(next.id, scene);
        } else {
          clearCurrentScene();
        }
      }
    } catch (err) {
      console.error('씬 삭제 실패:', err);
    }
  }, [projectRef, index, currentSceneId, setIndex, removeSceneFromIndex, setCurrentScene, clearCurrentScene]);

  const handleDuplicateScene = useCallback(async (entry: SceneIndexEntry) => {
    if (!projectRef) return;
    try {
      const originalScene = await fileIO.readJSON<Scene>(projectRef, `screenplay/${entry.filename}`);
      const newId = nextSceneId(index);
      const newScene: Scene = { ...originalScene, id: newId, version: 1 };
      const newFilename = sceneFilename(newId, newScene.header.location);

      await fileIO.writeJSON(projectRef, `screenplay/${newFilename}`, newScene);

      const insertAt = index.findIndex((s) => s.id === entry.id) + 1;
      const newNumber = insertAt + 1;
      const newEntry: SceneIndexEntry = { ...entry, id: newId, filename: newFilename, number: newNumber };
      const newIndex = renumberScenes([...index.slice(0, insertAt), newEntry, ...index.slice(insertAt)]);
      await fileIO.writeJSON(projectRef, 'screenplay/_index.json', { scenes: newIndex });
      setIndex(newIndex);
    } catch (err) {
      console.error('씬 복제 실패:', err);
    }
  }, [projectRef, index, setIndex]);

  const handleMergeScene = useCallback(async (entry: SceneIndexEntry) => {
    const entryIdx = index.findIndex(s => s.id === entry.id);
    if (entryIdx === -1 || entryIdx === index.length - 1) return;
    const nextEntry = index[entryIdx + 1];
    if (!projectRef) return;
    if (!await confirm(`장면 ${entry.number} "${entry.location}"과 장면 ${nextEntry.number} "${nextEntry.location}"를 합치겠습니까?\n두 번째 씬은 삭제됩니다.`)) return;
    try {
      const [scene, nextScene] = await Promise.all([
        fileIO.readJSON<Scene>(projectRef, `screenplay/${entry.filename}`),
        fileIO.readJSON<Scene>(projectRef, `screenplay/${nextEntry.filename}`),
      ]);
      const merged: Scene = {
        ...scene,
        blocks: [...scene.blocks, ...nextScene.blocks],
        characters: [...new Set([...(scene.characters ?? []), ...(nextScene.characters ?? [])])],
        meta: {
          ...scene.meta,
          estimatedMinutes: (scene.meta?.estimatedMinutes ?? 0) + (nextScene.meta?.estimatedMinutes ?? 0),
          summary: scene.meta?.summary
            ? `${scene.meta.summary} / ${nextScene.meta?.summary ?? ''}`
            : (nextScene.meta?.summary ?? ''),
        },
      };
      await fileIO.writeJSON(projectRef, `screenplay/${entry.filename}`, merged);
      await fileIO.deleteFile(projectRef, `screenplay/${nextEntry.filename}`);
      const newIndex = renumberScenes(index.filter(s => s.id !== nextEntry.id));
      const updatedIndex = newIndex.map(s =>
        s.id === entry.id ? { ...s, summary: merged.meta?.summary ?? '' } : s
      );
      await fileIO.writeJSON(projectRef, 'screenplay/_index.json', { scenes: updatedIndex });
      setIndex(updatedIndex);
      setCurrentScene(entry.id, merged);
    } catch (err) {
      console.error('씬 합치기 실패:', err);
    }
  }, [projectRef, index, setIndex, setCurrentScene]);

  const handleReorderScene = useCallback(async (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= index.length) return;
    reorderScenes(fromIndex, toIndex);
    const newIndex = useSceneStore.getState().index;
    if (projectRef) {
      await fileIO.writeJSON(projectRef, 'screenplay/_index.json', { scenes: newIndex });
    }
  }, [index.length, reorderScenes, projectRef]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
      const state = useSceneStore.getState();
      const cur = state.currentSceneId;
      if (!cur) return;
      const i = state.index.findIndex(s => s.id === cur);
      if (i === -1) return;
      e.preventDefault();
      handleReorderScene(i, e.key === 'ArrowUp' ? i - 1 : i + 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleReorderScene]);

  const handleDragEnd = useCallback(async () => {
    if (dragIndex === null || dragOverIndex === null || dragIndex === dragOverIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    reorderScenes(dragIndex, dragOverIndex);
    const newIndex = useSceneStore.getState().index;
    if (projectRef) {
      await fileIO.writeJSON(projectRef, 'screenplay/_index.json', { scenes: newIndex });
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }, [dragIndex, dragOverIndex, reorderScenes, projectRef]);

  return {
    isAdding,
    dragIndex,
    dragOverIndex,
    setDragIndex,
    setDragOverIndex,
    handleSelectScene,
    handleAddScene,
    handleDeleteScene,
    handleDuplicateScene,
    handleMergeScene,
    handleReorderScene,
    handleDragEnd,
    currentSceneId,
  };
}
