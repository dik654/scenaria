export interface SavePointStats {
  scenesModified: number;
  dialoguesChanged: number;
  charactersModified: string[];
}

export interface SavePoint {
  id: string;
  memo: string;
  auto: boolean;
  timestamp: string;
  branch: string;
  changedFiles: string[];
  stats: SavePointStats;
  parentId: string | null;
}

export interface SaveIndex {
  nextId: number;
  savePoints: { id: string; timestamp: string; memo: string; auto: boolean }[];
}

export interface BranchInfo {
  name: string;
  currentSaveId: string;
  createdAt: string;
  description?: string;
}

export interface Milestone {
  name: string;
  saveId: string;
  createdAt: string;
  notes?: string;
}

export interface DiffHunk {
  path: string;
  oldContent: string | null;
  newContent: string | null;
}

export interface DiffResult {
  saveIdA: string;
  saveIdB: string;
  hunks: DiffHunk[];
}

export interface SceneChange {
  saveId: string;
  timestamp: string;
  memo: string;
  changedFields: string[];
}

export interface MergeResult {
  success: boolean;
  conflicts: { path: string; ourContent: string; theirContent: string }[];
}
