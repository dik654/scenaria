import { create } from 'zustand';
import type { ConsistencyData, ConsistencyIssue } from '../types/consistency';

interface ConsistencyState {
  data: ConsistencyData | null;
  openIssues: ConsistencyIssue[];
  isChecking: boolean;

  setData: (data: ConsistencyData) => void;
  resolveIssue: (id: string) => void;
  ignoreIssue: (id: string) => void;
  setChecking: (checking: boolean) => void;
  addIssue: (issue: ConsistencyIssue) => void;
}

export const useConsistencyStore = create<ConsistencyState>((set) => ({
  data: null,
  openIssues: [],
  isChecking: false,

  setData: (data) =>
    set({ data, openIssues: data.issues.filter((i) => i.status === 'open') }),

  resolveIssue: (id) =>
    set((state) => ({
      openIssues: state.openIssues.filter((i) => i.id !== id),
      data: state.data
        ? {
            ...state.data,
            issues: state.data.issues.map((i) =>
              i.id === id ? { ...i, status: 'resolved' as const } : i
            ),
          }
        : null,
    })),

  ignoreIssue: (id) =>
    set((state) => ({
      openIssues: state.openIssues.filter((i) => i.id !== id),
      data: state.data
        ? {
            ...state.data,
            issues: state.data.issues.map((i) =>
              i.id === id ? { ...i, status: 'ignored' as const } : i
            ),
          }
        : null,
    })),

  setChecking: (isChecking) => set({ isChecking }),
  addIssue: (issue) =>
    set((state) => ({
      openIssues: [...state.openIssues, issue],
      data: state.data
        ? { ...state.data, issues: [...state.data.issues, issue] }
        : null,
    })),
}));
