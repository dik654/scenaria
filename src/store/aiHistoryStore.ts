import { create } from 'zustand';
import { nanoid } from 'nanoid';

export interface AIAlternative {
  id: string;
  content: string;
  tone?: string;
  characterMatch?: number;
  applied: boolean;
}

export interface AIHistoryEntry {
  id: string;
  timestamp: string;
  sceneId: string;
  blockIndex?: number;
  original: string;
  alternatives: AIAlternative[];
  appliedId: string | null;
  instruction?: string;
}

interface AIHistoryState {
  entries: AIHistoryEntry[];
  addEntry: (entry: Omit<AIHistoryEntry, 'id' | 'timestamp'>) => void;
  markApplied: (entryId: string, alternativeId: string) => void;
  clearOld: (maxEntries?: number) => void;
}

export const useAIHistoryStore = create<AIHistoryState>((set) => ({
  entries: [],

  addEntry: (entry) =>
    set((state) => ({
      entries: [
        {
          id: nanoid(),
          timestamp: new Date().toISOString(),
          ...entry,
        },
        ...state.entries,
      ],
    })),

  markApplied: (entryId, alternativeId) =>
    set((state) => ({
      entries: state.entries.map((e) =>
        e.id === entryId
          ? {
              ...e,
              appliedId: alternativeId,
              alternatives: e.alternatives.map((a) =>
                ({ ...a, applied: a.id === alternativeId })
              ),
            }
          : e
      ),
    })),

  clearOld: (maxEntries = 500) =>
    set((state) => ({ entries: state.entries.slice(0, maxEntries) })),
}));
