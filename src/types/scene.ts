export type Interior = 'INT' | 'EXT' | 'INT/EXT' | null;
export type TimeOfDay = 'DAY' | 'NIGHT' | 'DAWN' | 'DUSK' | 'CONTINUOUS';
export type VoiceType = 'normal' | 'V.O.' | 'O.S.' | 'E' | 'N';
export type MarkerType = 'foreshadowing' | 'payoff' | 'note' | 'inconsistency' | 'todo';
export type MarkerSeverity = 'info' | 'warning' | 'error';
export type TransitionType = string;

export interface Marker {
  type: MarkerType;
  id: string;
  label: string;
  linkedTo?: string;
  severity?: MarkerSeverity;
}

export interface ActionBlock {
  type: 'action';
  text: string;
  isInsert?: boolean;
  insertLabel?: string;
  markers?: Marker[];
}

export interface CharacterBlock {
  type: 'character';
  characterId: string;
  voiceType: VoiceType;
}

export interface DialogueBlock {
  type: 'dialogue';
  text: string;
  markers?: Marker[];
}

export interface ParentheticalBlock {
  type: 'parenthetical';
  text: string;
}

export interface TransitionBlock {
  type: 'transition';
  transitionType: string;
  customText?: string;
}

export type SceneBlock =
  | ActionBlock
  | CharacterBlock
  | DialogueBlock
  | ParentheticalBlock
  | TransitionBlock;

export interface SceneHeader {
  interior: Interior;
  location: string;
  locationDetail?: string;
  timeOfDay: TimeOfDay;
  timeLabel?: string;
  weather?: string;
}

export interface SceneMeta {
  summary: string;
  emotionalTone: string[];
  tensionLevel: number;
  estimatedMinutes: number;
  pov?: string;
  tags: string[];
  notes?: string;
  cardColor?: string;
}

export interface UnidentifiedCharacter {
  description: string;
  revealedAs?: string;
  revealScene?: string;
}

export interface Scene {
  id: string;
  version: number;
  header: SceneHeader;
  meta: SceneMeta;
  blocks: SceneBlock[];
  characters: string[];
  unidentifiedCharacters?: UnidentifiedCharacter[];
}

export interface SceneIndexEntry {
  id: string;
  filename: string;
  number: number;
  location: string;
  timeOfDay: TimeOfDay;
  interior: Interior;
  summary?: string;
  tags?: string[];
  cardColor?: string;
  hasConsistencyIssue?: boolean;
  hasUnresolvedForeshadowing?: boolean;
  characterCount?: number;
}

export interface SceneIndex {
  scenes: SceneIndexEntry[];
}
