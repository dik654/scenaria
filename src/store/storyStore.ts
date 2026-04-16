import { create } from 'zustand';
import type {
  PlotEvent,
  EventIndex,
  PlotThread,
  ThreadIndex,
  StoryStructure,
  ForeshadowingIndex,
  ForeshadowingItem,
} from '../types/story';

interface StoryState {
  // Events
  eventIndex: EventIndex['events'];
  events: Record<string, PlotEvent>;
  setEventIndex: (events: EventIndex['events']) => void;
  loadEvent: (id: string, event: PlotEvent) => void;
  updateEvent: (id: string, updates: Partial<PlotEvent>) => void;
  addEventToIndex: (entry: EventIndex['events'][number]) => void;
  removeEventFromIndex: (id: string) => void;

  // Threads
  threadIndex: ThreadIndex['threads'];
  threads: Record<string, PlotThread>;
  setThreadIndex: (threads: ThreadIndex['threads']) => void;
  loadThread: (id: string, thread: PlotThread) => void;
  updateThread: (id: string, updates: Partial<PlotThread>) => void;
  addThreadToIndex: (entry: ThreadIndex['threads'][number]) => void;
  removeThreadFromIndex: (id: string) => void;

  // Structure
  structure: StoryStructure | null;
  setStructure: (structure: StoryStructure) => void;
  updateBeatLink: (beatId: string, linkedEventId: string | null) => void;

  // Foreshadowing
  foreshadowing: ForeshadowingIndex | null;
  setForeshadowing: (data: ForeshadowingIndex) => void;
  addForeshadowingItem: (item: ForeshadowingItem) => void;
  updateForeshadowingItem: (id: string, updates: Partial<ForeshadowingItem>) => void;
  removeForeshadowingItem: (id: string) => void;

  // Reset
  resetStory: () => void;

  // Helpers
  unresolvedForeshadowing: () => ForeshadowingItem[];
}

export const useStoryStore = create<StoryState>((set, get) => ({
  // Events
  eventIndex: [],
  events: {},
  setEventIndex: (events) => set({ eventIndex: events }),
  loadEvent: (id, event) =>
    set((state) => ({ events: { ...state.events, [id]: event } })),
  updateEvent: (id, updates) =>
    set((state) => ({
      events: { ...state.events, [id]: { ...state.events[id], ...updates } },
    })),
  addEventToIndex: (entry) =>
    set((state) => ({ eventIndex: [...state.eventIndex, entry] })),
  removeEventFromIndex: (id) =>
    set((state) => ({
      eventIndex: state.eventIndex.filter((e) => e.id !== id),
      events: Object.fromEntries(Object.entries(state.events).filter(([k]) => k !== id)),
    })),

  // Threads
  threadIndex: [],
  threads: {},
  setThreadIndex: (threads) => set({ threadIndex: threads }),
  loadThread: (id, thread) =>
    set((state) => ({ threads: { ...state.threads, [id]: thread } })),
  updateThread: (id, updates) =>
    set((state) => ({
      threads: { ...state.threads, [id]: { ...state.threads[id], ...updates } },
    })),
  addThreadToIndex: (entry) =>
    set((state) => ({ threadIndex: [...state.threadIndex, entry] })),
  removeThreadFromIndex: (id) =>
    set((state) => ({
      threadIndex: state.threadIndex.filter((t) => t.id !== id),
      threads: Object.fromEntries(Object.entries(state.threads).filter(([k]) => k !== id)),
    })),

  // Structure
  structure: null,
  setStructure: (structure) => set({ structure }),
  updateBeatLink: (beatId, linkedEventId) =>
    set((state) => {
      if (!state.structure) return {};
      return {
        structure: {
          ...state.structure,
          beats: state.structure.beats.map((b) =>
            b.id === beatId ? { ...b, linkedEventId } : b
          ),
        },
      };
    }),

  // Foreshadowing
  foreshadowing: null,
  setForeshadowing: (data) => set({ foreshadowing: data }),
  addForeshadowingItem: (item) =>
    set((state) => ({
      foreshadowing: {
        items: [...(state.foreshadowing?.items ?? []), item],
      },
    })),
  updateForeshadowingItem: (id, updates) =>
    set((state) => ({
      foreshadowing: {
        items: (state.foreshadowing?.items ?? []).map((i) =>
          i.id === id ? { ...i, ...updates } : i
        ),
      },
    })),
  removeForeshadowingItem: (id) =>
    set((state) => ({
      foreshadowing: {
        items: (state.foreshadowing?.items ?? []).filter((i) => i.id !== id),
      },
    })),

  // Reset
  resetStory: () =>
    set({
      eventIndex: [],
      events: {},
      threadIndex: [],
      threads: {},
      structure: null,
      foreshadowing: null,
    }),

  // Helpers
  unresolvedForeshadowing: () => {
    const fs = get().foreshadowing;
    return (fs?.items ?? []).filter((i) => i.status === 'planted');
  },
}));
