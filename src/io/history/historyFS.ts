import type { FileSystemDirectoryHandle } from '../../types/global';

export async function ensureDir(root: FileSystemDirectoryHandle, ...parts: string[]) {
  let cur = root;
  for (const part of parts) {
    cur = await cur.getDirectoryHandle(part, { create: true });
  }
  return cur;
}

export async function readJSON<T>(root: FileSystemDirectoryHandle, ...pathParts: string[]): Promise<T | null> {
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

export async function writeJSON(root: FileSystemDirectoryHandle, data: unknown, ...pathParts: string[]) {
  let cur = root;
  for (let i = 0; i < pathParts.length - 1; i++) {
    cur = await cur.getDirectoryHandle(pathParts[i], { create: true });
  }
  const fh = await cur.getFileHandle(pathParts[pathParts.length - 1], { create: true });
  const writable = await fh.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

export async function readText(root: FileSystemDirectoryHandle, ...pathParts: string[]): Promise<string | null> {
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

export async function writeText(root: FileSystemDirectoryHandle, text: string, ...pathParts: string[]) {
  let cur = root;
  for (let i = 0; i < pathParts.length - 1; i++) {
    cur = await cur.getDirectoryHandle(pathParts[i], { create: true });
  }
  const fh = await cur.getFileHandle(pathParts[pathParts.length - 1], { create: true });
  const writable = await fh.createWritable();
  await writable.write(text);
  await writable.close();
}

const EXCLUDED = new Set(['.history', 'storyboard', 'audio', 'video', '.scenaria-version']);

export async function captureSnapshot(dirHandle: FileSystemDirectoryHandle): Promise<Record<string, string>> {
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

export async function restoreSnapshot(
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
