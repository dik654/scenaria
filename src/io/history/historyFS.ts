import type { ProjectRef } from '../types';

/* eslint-disable @typescript-eslint/no-explicit-any */
function getIPC() {
  return (window as unknown as Record<string, any>).__ELECTRON_IPC__?.historyFS as
    | {
        ensureDir(ref: string, ...parts: string[]): Promise<void>;
        readJSON(ref: string, ...pathParts: string[]): Promise<any>;
        writeJSON(ref: string, data: unknown, ...pathParts: string[]): Promise<void>;
        readText(ref: string, ...pathParts: string[]): Promise<string | null>;
        writeText(ref: string, text: string, ...pathParts: string[]): Promise<void>;
        captureSnapshot(ref: string): Promise<Record<string, string>>;
        restoreSnapshot(ref: string, snapshot: Record<string, string>): Promise<void>;
        listDir(ref: string, ...pathParts: string[]): Promise<string[]>;
        deleteEntry(ref: string, ...pathParts: string[]): Promise<void>;
      }
    | undefined;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── ensureDir ──

export async function ensureDir(root: ProjectRef, ...parts: string[]) {
  if (typeof root === 'string') {
    const ipc = getIPC()!;
    await ipc.ensureDir(root, ...parts);
    return undefined as unknown as FileSystemDirectoryHandle;
  }
  let cur = root as FileSystemDirectoryHandle;
  for (const part of parts) {
    cur = await cur.getDirectoryHandle(part, { create: true });
  }
  return cur;
}

// ── readJSON ──

export async function readJSON<T>(root: ProjectRef, ...pathParts: string[]): Promise<T | null> {
  if (typeof root === 'string') {
    return getIPC()!.readJSON(root, ...pathParts);
  }
  try {
    let cur = root as FileSystemDirectoryHandle;
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

// ── writeJSON ──

export async function writeJSON(root: ProjectRef, data: unknown, ...pathParts: string[]) {
  if (typeof root === 'string') {
    return getIPC()!.writeJSON(root, data, ...pathParts);
  }
  let cur = root as FileSystemDirectoryHandle;
  for (let i = 0; i < pathParts.length - 1; i++) {
    cur = await cur.getDirectoryHandle(pathParts[i], { create: true });
  }
  const fh = await cur.getFileHandle(pathParts[pathParts.length - 1], { create: true });
  const writable = await fh.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

// ── readText ──

export async function readText(root: ProjectRef, ...pathParts: string[]): Promise<string | null> {
  if (typeof root === 'string') {
    return getIPC()!.readText(root, ...pathParts);
  }
  try {
    let cur = root as FileSystemDirectoryHandle;
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

// ── writeText ──

export async function writeText(root: ProjectRef, text: string, ...pathParts: string[]) {
  if (typeof root === 'string') {
    return getIPC()!.writeText(root, text, ...pathParts);
  }
  let cur = root as FileSystemDirectoryHandle;
  for (let i = 0; i < pathParts.length - 1; i++) {
    cur = await cur.getDirectoryHandle(pathParts[i], { create: true });
  }
  const fh = await cur.getFileHandle(pathParts[pathParts.length - 1], { create: true });
  const writable = await fh.createWritable();
  await writable.write(text);
  await writable.close();
}

// ── captureSnapshot ──

const EXCLUDED = new Set(['.history', 'storyboard', 'audio', 'video', '.scenaria-version']);

export async function captureSnapshot(projectRef: ProjectRef): Promise<Record<string, string>> {
  if (typeof projectRef === 'string') {
    return getIPC()!.captureSnapshot(projectRef);
  }
  const dirHandle = projectRef as FileSystemDirectoryHandle;
  const snapshot: Record<string, string> = {};

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

// ── restoreSnapshot ──

export async function restoreSnapshot(
  projectRef: ProjectRef,
  snapshot: Record<string, string>
) {
  if (typeof projectRef === 'string') {
    return getIPC()!.restoreSnapshot(projectRef, snapshot);
  }
  const dirHandle = projectRef as FileSystemDirectoryHandle;
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

// ── listDir ──

export async function listDir(root: ProjectRef, ...pathParts: string[]): Promise<string[]> {
  if (typeof root === 'string') {
    return getIPC()!.listDir(root, ...pathParts);
  }
  let cur = root as FileSystemDirectoryHandle;
  for (const part of pathParts) {
    cur = await cur.getDirectoryHandle(part, { create: true });
  }
  const names: string[] = [];
  for await (const entry of cur.values()) {
    names.push(entry.name);
  }
  return names;
}

// ── deleteEntry ──

export async function deleteEntry(root: ProjectRef, ...pathParts: string[]): Promise<void> {
  if (typeof root === 'string') {
    return getIPC()!.deleteEntry(root, ...pathParts);
  }
  let cur = root as FileSystemDirectoryHandle;
  for (let i = 0; i < pathParts.length - 1; i++) {
    cur = await cur.getDirectoryHandle(pathParts[i]);
  }
  await cur.removeEntry(pathParts[pathParts.length - 1], { recursive: true });
}
