export type ConsistencyIssueType =
  | 'time_contradiction'
  | 'location_contradiction'
  | 'character_behavior'
  | 'emotional_gap'
  | 'unresolved_foreshadowing'
  | 'speech_inconsistency'
  | 'other';

export type IssueSeverity = 'error' | 'warning' | 'info';
export type IssueStatus = 'open' | 'resolved' | 'ignored';

export interface ConsistencyIssue {
  id: string;
  type: ConsistencyIssueType;
  severity: IssueSeverity;
  description: string;
  scenes?: string[];
  characters?: string[];
  suggestion?: string;
  linkedForeshadowing?: string;
  status: IssueStatus;
}

export interface ConsistencyRule {
  id: string;
  name: string;
  enabled: boolean;
  requiresAI: boolean;
}

export interface ConsistencyData {
  lastChecked: string;
  issues: ConsistencyIssue[];
  rules: ConsistencyRule[];
}
