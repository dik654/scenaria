export type EventType =
  | 'inciting_incident'
  | 'midpoint'
  | 'crisis'
  | 'climax'
  | 'resolution'
  | 'plot_point'
  | 'character_moment'
  | 'other';

export type EventStatus = 'confirmed' | 'draft' | 'cut';

export interface PlotEvent {
  id: string;
  title: string;
  description: string;
  eventType: EventType;
  act: number;
  actSection?: string;
  sceneStart?: number;
  sceneEnd?: number;
  characterIds: string[];
  pov?: string;
  location?: string;
  causalParentId?: string | null;
  causalChildIds: string[];
  foreshadowingScene?: string | null;
  payoffScene?: string | null;
  tensionLevel: number;
  emotionalTone: string;
  status: EventStatus;
  tags: string[];
  cardColor?: string;
  notes?: string;
  sortOrder: number;
  storyClockPosition?: number;
}

export interface EventIndex {
  events: { id: string; filename: string; title: string }[];
}

export interface PlotThread {
  id: string;
  name: string;
  color: string;
  description: string;
  characterIds: string[];
  eventIds: string[];
  sceneIds?: string[];
}

export interface ThreadIndex {
  threads: { id: string; filename: string; name: string }[];
}

export interface ActDefinition {
  name: string;
  label: string;
  startPercent: number;
  endPercent: number;
}

export interface BeatDefinition {
  id: string;
  name: string;
  description: string;
  relativePosition: number;
  act: number;
  isRequired: boolean;
  linkedEventId: string | null;
}

export interface StoryStructure {
  templateName: string;
  acts: ActDefinition[];
  beats: BeatDefinition[];
  availableTemplates: string[];
}

export interface ForeshadowingItem {
  id: string;
  type: 'foreshadowing' | 'payoff';
  plantedIn: {
    scene: string;
    blockIndex: number;
    description: string;
  };
  payoff: {
    scene: string;
    blockIndex: number;
    description: string;
    strength: 'weak' | 'medium' | 'strong';
  } | null;
  status: 'planted' | 'resolved' | 'abandoned';
  importance: 'minor' | 'major' | 'critical';
  notes?: string;
}

export interface ForeshadowingIndex {
  items: ForeshadowingItem[];
}
