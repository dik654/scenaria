import type {
  SavePoint,
  SaveIndex,
  BranchInfo,
  Milestone,
  DiffResult,
  SceneChange,
  MergeResult,
} from './types';
import type { ProjectRef } from '../types';
import { buildDiffResult } from './diffEngine';
import {
  ensureDir,
  readJSON,
  writeJSON,
  readText,
  writeText,
  captureSnapshot,
  restoreSnapshot,
  listDir,
  deleteEntry,
} from './historyFS';

const HISTORY_DIR = '.history';
const SAVES_DIR = '.history/saves';
const BRANCHES_DIR = '.history/branches';
const MILESTONES_DIR = '.history/milestones';

export class HistoryManager {
  private projectRef: ProjectRef;
  private currentBranch = '원본';

  constructor(projectRef: ProjectRef) {
    this.projectRef = projectRef;
  }

  async init() {
    await ensureDir(this.projectRef, HISTORY_DIR);
    await ensureDir(this.projectRef, SAVES_DIR);
    await ensureDir(this.projectRef, BRANCHES_DIR);
    await ensureDir(this.projectRef, MILESTONES_DIR);

    const idx = await readJSON<SaveIndex>(this.projectRef, HISTORY_DIR, 'index.json');
    if (!idx) {
      await writeJSON(this.projectRef, { nextId: 1, savePoints: [] }, HISTORY_DIR, 'index.json');
    }

    const branchFile = await readText(this.projectRef, BRANCHES_DIR, '_current');
    if (!branchFile) {
      const branchInfo: BranchInfo = {
        name: '원본',
        currentSaveId: '0000',
        createdAt: new Date().toISOString(),
      };
      await writeJSON(this.projectRef, branchInfo, BRANCHES_DIR, '원본.json');
      await writeText(this.projectRef, '원본', BRANCHES_DIR, '_current');
    } else {
      this.currentBranch = branchFile.trim();
    }
  }

  async getCurrentBranch(): Promise<string> {
    return this.currentBranch;
  }

  async createSavePoint(memo?: string, auto = false): Promise<SavePoint> {
    const idx = (await readJSON<SaveIndex>(this.projectRef, HISTORY_DIR, 'index.json'))!;
    const idNum = idx.nextId;
    const id = String(idNum).padStart(4, '0');

    const snapshot = await captureSnapshot(this.projectRef);

    const parentId = idx.savePoints.length > 0
      ? idx.savePoints[idx.savePoints.length - 1].id
      : null;

    const parentSnap = parentId
      ? await readJSON<Record<string, string>>(this.projectRef, SAVES_DIR, parentId, 'files.json')
      : null;

    let changedFiles: string[] = [];
    if (parentSnap) {
      changedFiles = Object.keys(snapshot).filter(k => snapshot[k] !== parentSnap[k]);
    } else {
      changedFiles = Object.keys(snapshot);
    }

    const scenesModified = changedFiles.filter(f => f.startsWith('screenplay/')).length;
    const charactersModified = changedFiles
      .filter(f => f.startsWith('characters/') && !f.includes('_index'))
      .map(f => f.replace('characters/', '').replace('.json', ''));

    let dialoguesChanged = 0;
    for (const f of changedFiles.filter(f => f.startsWith('screenplay/') && f.endsWith('.json'))) {
      try {
        const newBlocks: Array<{ type: string }> = JSON.parse(snapshot[f]).blocks ?? [];
        const oldBlocks: Array<{ type: string }> = parentSnap?.[f] ? JSON.parse(parentSnap[f]).blocks ?? [] : [];
        dialoguesChanged += Math.abs(
          newBlocks.filter(b => b.type === 'dialogue').length -
          oldBlocks.filter(b => b.type === 'dialogue').length
        );
      } catch { /* ignore parse errors */ }
    }

    const savePoint: SavePoint = {
      id,
      memo: memo ?? `자동 저장 #${idNum}`,
      auto,
      timestamp: new Date().toISOString(),
      branch: this.currentBranch,
      changedFiles,
      stats: { scenesModified, dialoguesChanged, charactersModified },
      parentId,
    };

    await ensureDir(this.projectRef, SAVES_DIR, id);
    await writeJSON(this.projectRef, savePoint, SAVES_DIR, id, 'meta.json');
    await writeJSON(this.projectRef, snapshot, SAVES_DIR, id, 'files.json');

    idx.nextId = idNum + 1;
    idx.savePoints.push({ id, timestamp: savePoint.timestamp, memo: savePoint.memo, auto });
    await writeJSON(this.projectRef, idx, HISTORY_DIR, 'index.json');

    return savePoint;
  }

  async listSavePoints(branch?: string): Promise<SavePoint[]> {
    const idx = await readJSON<SaveIndex>(this.projectRef, HISTORY_DIR, 'index.json');
    if (!idx) return [];

    const all: SavePoint[] = [];
    for (const entry of idx.savePoints) {
      const sp = await readJSON<SavePoint>(this.projectRef, SAVES_DIR, entry.id, 'meta.json');
      if (sp && (!branch || sp.branch === branch)) all.push(sp);
    }
    return all.reverse();
  }

  async restore(saveId: string): Promise<void> {
    await this.createSavePoint('되돌리기 전 자동 저장', true);
    const snapshot = await readJSON<Record<string, string>>(this.projectRef, SAVES_DIR, saveId, 'files.json');
    if (!snapshot) throw new Error(`저장 지점 ${saveId}를 찾을 수 없습니다`);
    await restoreSnapshot(this.projectRef, snapshot);
  }

  async diff(saveIdA: string, saveIdB: string): Promise<DiffResult> {
    const snapA = (await readJSON<Record<string, string>>(this.projectRef, SAVES_DIR, saveIdA, 'files.json')) ?? {};
    const snapB = (await readJSON<Record<string, string>>(this.projectRef, SAVES_DIR, saveIdB, 'files.json')) ?? {};
    return buildDiffResult(saveIdA, saveIdB, snapA, snapB);
  }

  async sceneHistory(sceneId: string): Promise<SceneChange[]> {
    const all = await this.listSavePoints();
    return all
      .map(sp => {
        const changed = sp.changedFiles.find(f => f.includes(sceneId));
        return changed ? { saveId: sp.id, timestamp: sp.timestamp, memo: sp.memo, changedFields: [changed] } : null;
      })
      .filter(Boolean) as SceneChange[];
  }

  async createMilestone(name: string): Promise<void> {
    const all = await this.listSavePoints();
    if (all.length === 0) throw new Error('저장 지점이 없습니다');
    const milestone: Milestone = {
      name,
      saveId: all[0].id,
      createdAt: new Date().toISOString(),
    };
    const safeName = name.replace(/[/\\:*?"<>|]/g, '_');
    await writeJSON(this.projectRef, milestone, MILESTONES_DIR, `${safeName}.json`);
  }

  async listMilestones(): Promise<Milestone[]> {
    const files = await listDir(this.projectRef, MILESTONES_DIR);
    const milestones: Milestone[] = [];
    for (const name of files) {
      if (name.endsWith('.json')) {
        const m = await readJSON<Milestone>(this.projectRef, MILESTONES_DIR, name);
        if (m) milestones.push(m);
      }
    }
    return milestones.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listBranches(): Promise<{ branches: BranchInfo[]; current: string }> {
    const files = await listDir(this.projectRef, BRANCHES_DIR);
    const branches: BranchInfo[] = [];
    for (const name of files) {
      if (name.endsWith('.json')) {
        const b = await readJSON<BranchInfo>(this.projectRef, BRANCHES_DIR, name);
        if (b) branches.push(b);
      }
    }
    return {
      branches: branches.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      current: this.currentBranch,
    };
  }

  async createBranch(name: string): Promise<void> {
    const allSaves = await this.listSavePoints(this.currentBranch);
    const branchInfo: BranchInfo = {
      name,
      currentSaveId: allSaves[0]?.id ?? '0000',
      createdAt: new Date().toISOString(),
    };
    const safeName = name.replace(/[/\\:*?"<>|]/g, '_');
    await writeJSON(this.projectRef, branchInfo, BRANCHES_DIR, `${safeName}.json`);
  }

  async switchBranch(name: string): Promise<void> {
    this.currentBranch = name;
    await writeText(this.projectRef, name, BRANCHES_DIR, '_current');
  }

  async mergeBranch(sourceBranch: string): Promise<MergeResult> {
    // Load latest snapshots from both branches
    const targetSaves = await this.listSavePoints(this.currentBranch);
    const sourceSaves = await this.listSavePoints(sourceBranch);

    if (sourceSaves.length === 0) {
      return { success: false, conflicts: [] };
    }

    const targetSnap: Record<string, string> = targetSaves.length > 0
      ? (await readJSON<Record<string, string>>(this.projectRef, SAVES_DIR, targetSaves[0].id, 'files.json')) ?? {}
      : {};
    const sourceSnap: Record<string, string> =
      (await readJSON<Record<string, string>>(this.projectRef, SAVES_DIR, sourceSaves[0].id, 'files.json')) ?? {};

    // Find common ancestor: latest save point that exists on both branches (by parentId chain)
    const targetIds = new Set(targetSaves.map(s => s.id));
    const ancestor = sourceSaves.find(s => targetIds.has(s.id));
    const ancestorSnap: Record<string, string> = ancestor
      ? (await readJSON<Record<string, string>>(this.projectRef, SAVES_DIR, ancestor.id, 'files.json')) ?? {}
      : {};

    // Three-way merge
    const allKeys = new Set([...Object.keys(targetSnap), ...Object.keys(sourceSnap)]);
    const merged: Record<string, string> = { ...targetSnap };
    const conflicts: MergeResult['conflicts'] = [];

    for (const key of allKeys) {
      const base = ancestorSnap[key] ?? null;
      const ours = targetSnap[key] ?? null;
      const theirs = sourceSnap[key] ?? null;

      if (ours === theirs) continue; // identical — no action needed
      if (theirs === base) continue; // only target changed — keep ours
      if (ours === base) {
        // only source changed — take theirs
        if (theirs === null) delete merged[key];
        else merged[key] = theirs;
      } else {
        // both changed — conflict
        conflicts.push({ path: key, ourContent: ours ?? '', theirContent: theirs ?? '' });
      }
    }

    if (conflicts.length > 0) {
      return { success: false, conflicts };
    }

    // Apply merged snapshot and create a save point
    await restoreSnapshot(this.projectRef, merged);
    await this.createSavePoint(`브랜치 병합: ${sourceBranch} → ${this.currentBranch}`, false);
    return { success: true, conflicts: [] };
  }

  async applyConflictResolution(resolved: Record<string, string>): Promise<void> {
    const currentSnap = await captureSnapshot(this.projectRef);
    const merged = { ...currentSnap, ...resolved };
    await restoreSnapshot(this.projectRef, merged);
    await this.createSavePoint('충돌 수동 해결 후 병합', false);
  }

  async stash(): Promise<void> {
    const snapshot = await captureSnapshot(this.projectRef);
    await writeJSON(this.projectRef, snapshot, HISTORY_DIR, 'stash', 'stash.json');
  }

  async unstash(): Promise<void> {
    const snapshot = await readJSON<Record<string, string>>(this.projectRef, HISTORY_DIR, 'stash', 'stash.json');
    if (!snapshot) throw new Error('임시 보관된 내용이 없습니다');
    await restoreSnapshot(this.projectRef, snapshot);
  }

  async cleanup(): Promise<void> {
    const idx = await readJSON<SaveIndex>(this.projectRef, HISTORY_DIR, 'index.json');
    if (!idx) return;

    const autoSaves = idx.savePoints.filter(s => s.auto);
    if (autoSaves.length <= 100) return;

    const toDelete = autoSaves.slice(100);
    for (const entry of toDelete) {
      try {
        await deleteEntry(this.projectRef, SAVES_DIR, entry.id);
        idx.savePoints = idx.savePoints.filter(s => s.id !== entry.id);
      } catch {
        // ignore cleanup errors
      }
    }
    await writeJSON(this.projectRef, idx, HISTORY_DIR, 'index.json');
  }
}
