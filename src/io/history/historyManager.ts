import type { FileSystemDirectoryHandle } from '../../types/global';
import type {
  SavePoint,
  SaveIndex,
  BranchInfo,
  Milestone,
  DiffResult,
  SceneChange,
  MergeResult,
} from './types';
import { buildDiffResult } from './diffEngine';
import {
  ensureDir,
  readJSON,
  writeJSON,
  readText,
  writeText,
  captureSnapshot,
  restoreSnapshot,
} from './historyFS';

const HISTORY_DIR = '.history';
const SAVES_DIR = '.history/saves';
const BRANCHES_DIR = '.history/branches';
const MILESTONES_DIR = '.history/milestones';

export class HistoryManager {
  private dirHandle: FileSystemDirectoryHandle;
  private currentBranch = '원본';

  constructor(dirHandle: FileSystemDirectoryHandle) {
    this.dirHandle = dirHandle;
  }

  async init() {
    await ensureDir(this.dirHandle, HISTORY_DIR);
    await ensureDir(this.dirHandle, SAVES_DIR);
    await ensureDir(this.dirHandle, BRANCHES_DIR);
    await ensureDir(this.dirHandle, MILESTONES_DIR);

    const idx = await readJSON<SaveIndex>(this.dirHandle, HISTORY_DIR, 'index.json');
    if (!idx) {
      await writeJSON(this.dirHandle, { nextId: 1, savePoints: [] }, HISTORY_DIR, 'index.json');
    }

    const branchFile = await readText(this.dirHandle, BRANCHES_DIR, '_current');
    if (!branchFile) {
      const branchInfo: BranchInfo = {
        name: '원본',
        currentSaveId: '0000',
        createdAt: new Date().toISOString(),
      };
      await writeJSON(this.dirHandle, branchInfo, BRANCHES_DIR, '원본.json');
      await writeText(this.dirHandle, '원본', BRANCHES_DIR, '_current');
    } else {
      this.currentBranch = branchFile.trim();
    }
  }

  async createSavePoint(memo?: string, auto = false): Promise<SavePoint> {
    const idx = (await readJSON<SaveIndex>(this.dirHandle, HISTORY_DIR, 'index.json'))!;
    const idNum = idx.nextId;
    const id = String(idNum).padStart(4, '0');

    const snapshot = await captureSnapshot(this.dirHandle);

    const parentId = idx.savePoints.length > 0
      ? idx.savePoints[idx.savePoints.length - 1].id
      : null;

    const parentSnap = parentId
      ? await readJSON<Record<string, string>>(this.dirHandle, SAVES_DIR, parentId, 'files.json')
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

    const saveDir = await ensureDir(this.dirHandle, SAVES_DIR, id);
    const metaFh = await saveDir.getFileHandle('meta.json', { create: true });
    const metaWritable = await metaFh.createWritable();
    await metaWritable.write(JSON.stringify(savePoint, null, 2));
    await metaWritable.close();

    const filesFh = await saveDir.getFileHandle('files.json', { create: true });
    const filesWritable = await filesFh.createWritable();
    await filesWritable.write(JSON.stringify(snapshot, null, 2));
    await filesWritable.close();

    idx.nextId = idNum + 1;
    idx.savePoints.push({ id, timestamp: savePoint.timestamp, memo: savePoint.memo, auto });
    await writeJSON(this.dirHandle, idx, HISTORY_DIR, 'index.json');

    return savePoint;
  }

  async listSavePoints(branch?: string): Promise<SavePoint[]> {
    const idx = await readJSON<SaveIndex>(this.dirHandle, HISTORY_DIR, 'index.json');
    if (!idx) return [];

    const all: SavePoint[] = [];
    for (const entry of idx.savePoints) {
      const sp = await readJSON<SavePoint>(this.dirHandle, SAVES_DIR, entry.id, 'meta.json');
      if (sp && (!branch || sp.branch === branch)) all.push(sp);
    }
    return all.reverse();
  }

  async restore(saveId: string): Promise<void> {
    await this.createSavePoint('되돌리기 전 자동 저장', true);
    const snapshot = await readJSON<Record<string, string>>(this.dirHandle, SAVES_DIR, saveId, 'files.json');
    if (!snapshot) throw new Error(`저장 지점 ${saveId}를 찾을 수 없습니다`);
    await restoreSnapshot(this.dirHandle, snapshot);
  }

  async diff(saveIdA: string, saveIdB: string): Promise<DiffResult> {
    const snapA = (await readJSON<Record<string, string>>(this.dirHandle, SAVES_DIR, saveIdA, 'files.json')) ?? {};
    const snapB = (await readJSON<Record<string, string>>(this.dirHandle, SAVES_DIR, saveIdB, 'files.json')) ?? {};
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
    await writeJSON(this.dirHandle, milestone, MILESTONES_DIR, `${safeName}.json`);
  }

  async listMilestones(): Promise<Milestone[]> {
    const milestoneDir = await ensureDir(this.dirHandle, MILESTONES_DIR);
    const milestones: Milestone[] = [];
    for await (const entry of milestoneDir.values()) {
      if (entry.kind === 'file' && entry.name.endsWith('.json')) {
        const fh = entry as FileSystemFileHandle;
        const file = await fh.getFile();
        milestones.push(JSON.parse(await file.text()) as Milestone);
      }
    }
    return milestones.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createBranch(name: string): Promise<void> {
    const allSaves = await this.listSavePoints(this.currentBranch);
    const branchInfo: BranchInfo = {
      name,
      currentSaveId: allSaves[0]?.id ?? '0000',
      createdAt: new Date().toISOString(),
    };
    const safeName = name.replace(/[/\\:*?"<>|]/g, '_');
    await writeJSON(this.dirHandle, branchInfo, BRANCHES_DIR, `${safeName}.json`);
  }

  async switchBranch(name: string): Promise<void> {
    this.currentBranch = name;
    await writeText(this.dirHandle, name, BRANCHES_DIR, '_current');
  }

  async mergeBranch(_sourceBranch: string): Promise<MergeResult> {
    return { success: true, conflicts: [] };
  }

  async stash(): Promise<void> {
    const snapshot = await captureSnapshot(this.dirHandle);
    await writeJSON(this.dirHandle, snapshot, HISTORY_DIR, 'stash', 'stash.json');
  }

  async unstash(): Promise<void> {
    const snapshot = await readJSON<Record<string, string>>(this.dirHandle, HISTORY_DIR, 'stash', 'stash.json');
    if (!snapshot) throw new Error('임시 보관된 내용이 없습니다');
    await restoreSnapshot(this.dirHandle, snapshot);
  }

  async cleanup(): Promise<void> {
    const idx = await readJSON<SaveIndex>(this.dirHandle, HISTORY_DIR, 'index.json');
    if (!idx) return;

    const autoSaves = idx.savePoints.filter(s => s.auto);
    if (autoSaves.length <= 100) return;

    const toDelete = autoSaves.slice(100);
    for (const entry of toDelete) {
      try {
        const savesDir = await ensureDir(this.dirHandle, SAVES_DIR);
        await savesDir.removeEntry(entry.id, { recursive: true });
        idx.savePoints = idx.savePoints.filter(s => s.id !== entry.id);
      } catch {
        // ignore cleanup errors
      }
    }
    await writeJSON(this.dirHandle, idx, HISTORY_DIR, 'index.json');
  }
}
