import { create } from 'zustand';

interface AIActivityState {
  activeCount: number;
  start: () => void;
  stop: () => void;
}

export const useAIActivityStore = create<AIActivityState>((set) => ({
  activeCount: 0,
  start: () => set((s) => ({ activeCount: s.activeCount + 1 })),
  stop: () => set((s) => ({ activeCount: Math.max(0, s.activeCount - 1) })),
}));
