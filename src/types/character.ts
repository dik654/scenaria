export interface RelationshipEvolution {
  scene: string;
  state: string;
}

export interface CharacterRelationship {
  targetId: string;
  type: string;
  description: string;
  evolution?: RelationshipEvolution[];
}

export interface CharacterPersonality {
  traits: string[];
  speechStyle: string;
  speechExamples?: string[];
  speechTaboos?: string;
}

export interface CharacterDrama {
  goal: string;
  need: string;
  flaw: string;
  lie: string;
  ghost: string;
  arc: string;
  stakes: string;
}

export interface Character {
  id: string;
  version: number;
  name: string;
  alias?: string;
  age?: number;
  ageDescription?: string;
  gender?: string;
  occupation?: string;
  description: string;
  personality: CharacterPersonality;
  drama: CharacterDrama;
  relationships: CharacterRelationship[];
  color: string;
  voiceProfileId?: string | null;
  visualDescription?: string;
  referenceImages?: string[];
}

export interface CharacterIndexEntry {
  id: string;
  name: string;
  alias?: string;
  color: string;
  filename: string;
}

export interface CharacterIndex {
  characters: CharacterIndexEntry[];
}
