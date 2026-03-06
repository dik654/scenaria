import { create } from 'zustand';
import type { SavePoint, Milestone } from '../io/history/types';

interface HistoryState {
  savePoints: SavePoint[];
  milestones: Milestone[];
  currentSaveId: string | null;
  isLoading: boolean;

  setSavePoints: (points: SavePoint[]) => void;
  setMilestones: (milestones: Milestone[]) => void;
  setCurrentSaveId: (id: string | null) => void;
  prependSavePoint: (point: SavePoint) => void;
  setLoading: (loading: boolean) => void;
}

export const useHistoryStore = create<HistoryState>((set) => ({
  savePoints: [],
  milestones: [],
  currentSaveId: null,
  isLoading: false,

  setSavePoints: (savePoints) => set({ savePoints }),
  setMilestones: (milestones) => set({ milestones }),
  setCurrentSaveId: (currentSaveId) => set({ currentSaveId }),
  prependSavePoint: (point) =>
    set((state) => ({ savePoints: [point, ...state.savePoints] })),
  setLoading: (isLoading) => set({ isLoading }),
}));
