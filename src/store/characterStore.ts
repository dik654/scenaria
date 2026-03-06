import { create } from 'zustand';
import type { Character, CharacterIndexEntry } from '../types/character';

interface CharacterState {
  index: CharacterIndexEntry[];
  characters: Record<string, Character>;
  selectedCharacterId: string | null;

  setIndex: (index: CharacterIndexEntry[]) => void;
  setCharacter: (id: string, character: Character) => void;
  updateCharacter: (id: string, updates: Partial<Character>) => void;
  removeCharacter: (id: string) => void;
  selectCharacter: (id: string | null) => void;
  addToIndex: (entry: CharacterIndexEntry) => void;
}

export const useCharacterStore = create<CharacterState>((set) => ({
  index: [],
  characters: {},
  selectedCharacterId: null,

  setIndex: (index) => set({ index }),
  setCharacter: (id, character) =>
    set((state) => ({ characters: { ...state.characters, [id]: character } })),
  updateCharacter: (id, updates) =>
    set((state) => ({
      characters: {
        ...state.characters,
        [id]: { ...state.characters[id], ...updates },
      },
    })),
  removeCharacter: (id) =>
    set((state) => {
      const next = { ...state.characters };
      delete next[id];
      return {
        characters: next,
        index: state.index.filter((c) => c.id !== id),
      };
    }),
  selectCharacter: (selectedCharacterId) => set({ selectedCharacterId }),
  addToIndex: (entry) =>
    set((state) => ({ index: [...state.index, entry] })),
}));
