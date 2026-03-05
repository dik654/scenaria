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

const HISTORY_DIR = '.history';
const SAVES_DIR = '.history/saves';
const BRANCHES_DIR = '.history/branches';
const MILESTONES_DIR = '.history/milestones';

async function ensureDir(root: FileSystemDirectoryHandle, ...parts: string[]) {
  let cur = root;
  for (const part of parts) {
    cur = await cur.getDirectoryHandle(part, { create: true });
  }
  return cur;
}

async function readJSON<T>(root: FileSystemDirectoryHandle, ...pathParts: string[]): Promise<T | null> {
  try {
    let cur = root;
    for (let i = 0; i < pathParts.length - 1; i++) {
      cur = await cur.getDirectoryHandle(pathParts[i]);
    }
    const fh = await cur.getFileHandle(pathParts[pathParts.length - 1]);
    const file = await fh.getFile();
    return JSON.parse(await file.text()) as T;
  } catch {
    return null;
  }
}

async function writeJSON(root: FileSystemDirectoryHandle, data: unknown, ...pathParts: string[]) {
  let cur = root;
  for (let i = 0; i < pathParts.length - 1; i++) {
    cur = await cur.getDirectoryHandle(pathParts[i], { create: true });
  }
  const fh = await cur.getFileHandle(pathParts[pathParts.length - 1], { create: true });
  const writable = await fh.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

async function readText(root: FileSystemDirectoryHandle, ...pathParts: string[]): Promise<string | null> {
  try {
    let cur = root;
    for (let i = 0; i < pathParts.length - 1; i++) {
      cur = await cur.getDirectoryHandle(pathParts[i]);
    }
    const fh = await cur.getFileHandle(pathParts[pathParts.length - 1]);
    const file = await fh.getFile();
    return file.text();
  } catch {
    return null;
  }
}

/**
 * Reads all tracked project files and returns their JSON content as strings.
 * Excludes .history/ and storyboard/audio/video binaries.
 */
async function captureSnapshot(dirHandle: FileSystemDirectoryHandle): Promise<Record<string, string>> {
  const snapshot: Record<string, string> = {};
  const EXCLUDED = new Set(['.history', 'storyboard', 'audio', 'video', '.scenaria-version']);

  async function walk(dir: FileSystemDirectoryHandle, prefix: string) {
    for await (const entry of dir.values()) {
      if (EXCLUDED.has(entry.name)) continue;
      const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.kind === 'directory') {
        await walk(entry as FileSystemDirectoryHandle, entryPath);
      } else if (entry.name.endsWith('.json')) {
        try {
          const fh = entry as FileSystemFileHandle;
          const file = await fh.getFile();
          snapshot[entryPath] = await file.text();
        } catch {
          // skip unreadable files
        }
      }
    }
  }

  await walk(dirHandle, '');
  return snapshot;
}

async function restoreSnapshot(
  dirHandle: FileSystemDirectoryHandle,
  snapshot: Record<string, string>
) {
  for (const [path, content] of Object.entries(snapshot)) {
    const parts = path.split('/');
    const filename = parts.pop()!;
    let cur = dirHandle;
    for (const part of parts) {
      cur = await cur.getDirectoryHandle(part, { create: true });
    }
    const fh = await cur.getFileHandle(filename, { create: true });
    const writable = await fh.createWritable();
    await writable.write(content);
    await writable.close();
  }
}

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
      const newIdx: SaveIndex = { nextId: 1, savePoints: [] };
      await writeJSON(this.dirHandle, newIdx, HISTORY_DIR, 'index.json');
    }

    const branchFile = await readText(this.dirHandle, BRANCHES_DIR, '_current');
    if (!branchFile) {
      const branchInfo: BranchInfo = {
        name: '원본',
        currentSaveId: '0000',
        createdAt: new Date().toISOString(),
      };
      await writeJSON(this.dirHandle, branchInfo, BRANCHES_DIR, '원본.json');
      const fh = await (await ensureDir(this.dirHandle, BRANCHES_DIR)).getFileHandle('_current', { create: true });
      const writable = await fh.createWritable();
      await writable.write('원본');
      await writable.close();
    } else {
      this.currentBranch = branchFile.trim();
    }
  }

  async createSavePoint(memo?: string, auto = false): Promise<SavePoint> {
    const idx = (await readJSON<SaveIndex>(this.dirHandle, HISTORY_DIR, 'index.json'))!;
    const idNum = idx.nextId;
    const id = String(idNum).padStart(4, '0');

    const snapshot = await captureSnapshot(this.dirHandle);

    // Compute changed files by comparing to parent
    const parentId = idx.savePoints.length > 0
      ? idx.savePoints[idx.savePoints.length - 1].id
      : null;

    let changedFiles: string[] = [];
    if (parentId) {
      const parentSnap = await readJSON<Record<string, string>>(
        this.dirHandle, SAVES_DIR, parentId, 'files.json'
      );
      if (parentSnap) {
        changedFiles = Object.keys(snapshot).filter(k => snapshot[k] !== parentSnap[k]);
      }
    } else {
      changedFiles = Object.keys(snapshot);
    }

    const scenesModified = changedFiles.filter(f => f.startsWith('screenplay/')).length;
    const charactersModified = changedFiles
      .filter(f => f.startsWith('characters/') && !f.includes('_index'))
      .map(f => f.replace('characters/', '').replace('.json', ''));
    const dialoguesChanged = 0; // TODO: count dialogue block diffs

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

    // Store snapshot
    const filesFh = await saveDir.getFileHandle('files.json', { create: true });
    const filesWritable = await filesFh.createWritable();
    await filesWritable.write(JSON.stringify(snapshot, null, 2));
    await filesWritable.close();

    // Update index
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
      if (sp && (!branch || sp.branch === branch)) {
        all.push(sp);
      }
    }
    return all.reverse(); // newest first
  }

  async restore(saveId: string): Promise<void> {
    // First create a safety save point
    await this.createSavePoint('되돌리기 전 자동 저장', true);

    const snapshot = await readJSON<Record<string, string>>(
      this.dirHandle, SAVES_DIR, saveId, 'files.json'
    );
    if (!snapshot) throw new Error(`저장 지점 ${saveId}를 찾을 수 없습니다`);

    await restoreSnapshot(this.dirHandle, snapshot);
  }

  async diff(saveIdA: string, saveIdB: string): Promise<DiffResult> {
    const snapA = (await readJSON<Record<string, string>>(
      this.dirHandle, SAVES_DIR, saveIdA, 'files.json'
    )) ?? {};
    const snapB = (await readJSON<Record<string, string>>(
      this.dirHandle, SAVES_DIR, saveIdB, 'files.json'
    )) ?? {};
    return buildDiffResult(saveIdA, saveIdB, snapA, snapB);
  }

  async sceneHistory(sceneId: string): Promise<SceneChange[]> {
    const all = await this.listSavePoints();
    const result: SceneChange[] = [];
    for (const sp of all) {
      const changed = sp.changedFiles.find(f => f.includes(sceneId));
      if (changed) {
        result.push({
          saveId: sp.id,
          timestamp: sp.timestamp,
          memo: sp.memo,
          changedFields: [changed],
        });
      }
    }
    return result;
  }

  async createMilestone(name: string): Promise<void> {
    const all = await this.listSavePoints();
    if (all.length === 0) throw new Error('저장 지점이 없습니다');
    const latest = all[0];
    const milestone: Milestone = {
      name,
      saveId: latest.id,
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
        const m = JSON.parse(await file.text()) as Milestone;
        milestones.push(m);
      }
    }
    return milestones.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createBranch(name: string): Promise<void> {
    const allSaves = await this.listSavePoints(this.currentBranch);
    const currentSaveId = allSaves[0]?.id ?? '0000';
    const branchInfo: BranchInfo = {
      name,
      currentSaveId,
      createdAt: new Date().toISOString(),
    };
    const safeName = name.replace(/[/\\:*?"<>|]/g, '_');
    await writeJSON(this.dirHandle, branchInfo, BRANCHES_DIR, `${safeName}.json`);
  }

  async switchBranch(name: string): Promise<void> {
    this.currentBranch = name;
    const fh = await (await ensureDir(this.dirHandle, BRANCHES_DIR))
      .getFileHandle('_current', { create: true });
    const writable = await fh.createWritable();
    await writable.write(name);
    await writable.close();
  }

  async mergeBranch(_sourceBranch: string): Promise<MergeResult> {
    // MVP stub — full merge logic in Phase 1.3c
    return { success: true, conflicts: [] };
  }

  async stash(): Promise<void> {
    const stashDir = await ensureDir(this.dirHandle, HISTORY_DIR, 'stash');
    const snapshot = await captureSnapshot(this.dirHandle);
    const fh = await stashDir.getFileHandle('stash.json', { create: true });
    const writable = await fh.createWritable();
    await writable.write(JSON.stringify(snapshot, null, 2));
    await writable.close();
  }

  async unstash(): Promise<void> {
    const snapshot = await readJSON<Record<string, string>>(
      this.dirHandle, HISTORY_DIR, 'stash', 'stash.json'
    );
    if (!snapshot) throw new Error('임시 보관된 내용이 없습니다');
    await restoreSnapshot(this.dirHandle, snapshot);
  }

  async cleanup(): Promise<void> {
    // Keep last 100 auto-saves; remove older ones
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
