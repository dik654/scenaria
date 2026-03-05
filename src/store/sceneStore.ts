import { create } from 'zustand';
import type { Scene, SceneIndexEntry } from '../types/scene';

interface SceneState {
  index: SceneIndexEntry[];
  currentSceneId: string | null;
  currentScene: Scene | null;
  isDirty: boolean;
  isSaving: boolean;

  setIndex: (index: SceneIndexEntry[]) => void;
  setCurrentScene: (sceneId: string, scene: Scene) => void;
  updateCurrentScene: (scene: Scene) => void;
  markDirty: () => void;
  markClean: () => void;
  setSaving: (saving: boolean) => void;
  addSceneToIndex: (entry: SceneIndexEntry) => void;
  removeSceneFromIndex: (sceneId: string) => void;
  reorderScenes: (fromIndex: number, toIndex: number) => void;
  updateIndexEntry: (sceneId: string, updates: Partial<SceneIndexEntry>) => void;
}

export const useSceneStore = create<SceneState>((set) => ({
  index: [],
  currentSceneId: null,
  currentScene: null,
  isDirty: false,
  isSaving: false,

  setIndex: (index) => set({ index }),
  setCurrentScene: (sceneId, scene) =>
    set({ currentSceneId: sceneId, currentScene: scene, isDirty: false }),
  updateCurrentScene: (scene) => set({ currentScene: scene, isDirty: true }),
  markDirty: () => set({ isDirty: true }),
  markClean: () => set({ isDirty: false }),
  setSaving: (isSaving) => set({ isSaving }),

  addSceneToIndex: (entry) =>
    set((state) => ({ index: [...state.index, entry] })),

  removeSceneFromIndex: (sceneId) =>
    set((state) => ({ index: state.index.filter((s) => s.id !== sceneId) })),

  reorderScenes: (fromIndex, toIndex) =>
    set((state) => {
      const newIndex = [...state.index];
      const [moved] = newIndex.splice(fromIndex, 1);
      newIndex.splice(toIndex, 0, moved);
      return { index: newIndex.map((s, i) => ({ ...s, number: i + 1 })) };
    }),

  updateIndexEntry: (sceneId, updates) =>
    set((state) => ({
      index: state.index.map((s) => (s.id === sceneId ? { ...s, ...updates } : s)),
    })),
}));
