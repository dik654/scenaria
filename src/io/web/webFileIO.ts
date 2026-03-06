import type { FileIO, ProjectHandle } from '../types';

async function getNestedHandle(
  dirHandle: FileSystemDirectoryHandle,
  pathParts: string[],
  create = false
): Promise<FileSystemDirectoryHandle> {
  let current = dirHandle;
  for (const part of pathParts) {
    current = await current.getDirectoryHandle(part, { create });
  }
  return current;
}

async function getFileHandle(
  dirHandle: FileSystemDirectoryHandle,
  path: string,
  create = false
): Promise<FileSystemFileHandle> {
  const parts = path.split('/');
  const filename = parts.pop()!;
  const dir = parts.length > 0
    ? await getNestedHandle(dirHandle, parts, create)
    : dirHandle;
  return dir.getFileHandle(filename, { create });
}

export class WebFileIO implements FileIO {
  async openProject(): Promise<ProjectHandle> {
    const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    return { name: dirHandle.name, dirHandle };
  }

  async createProject(name: string, parentDirHandle?: FileSystemDirectoryHandle): Promise<ProjectHandle> {
    const parent = parentDirHandle ?? await window.showDirectoryPicker({ mode: 'readwrite' });
    const projectName = name.endsWith('.scenaria') ? name : `${name}.scenaria`;
    const dirHandle = await parent.getDirectoryHandle(projectName, { create: true });
    return { name: projectName, dirHandle };
  }

  async readJSON<T>(dirHandle: FileSystemDirectoryHandle, path: string): Promise<T> {
    const fileHandle = await getFileHandle(dirHandle, path);
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text) as T;
  }

  async writeJSON(dirHandle: FileSystemDirectoryHandle, path: string, data: unknown): Promise<void> {
    const fileHandle = await getFileHandle(dirHandle, path, true);
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
  }

  async listFiles(dirHandle: FileSystemDirectoryHandle, dirPath: string): Promise<string[]> {
    const dir = dirPath
      ? await getNestedHandle(dirHandle, dirPath.split('/'))
      : dirHandle;
    const names: string[] = [];
    for await (const entry of dir.values()) {
      names.push(entry.name);
    }
    return names;
  }

  async fileExists(dirHandle: FileSystemDirectoryHandle, path: string): Promise<boolean> {
    try {
      await getFileHandle(dirHandle, path);
      return true;
    } catch {
      return false;
    }
  }

  async copyFile(dirHandle: FileSystemDirectoryHandle, from: string, to: string): Promise<void> {
    const data = await this.readBinary(dirHandle, from);
    await this.writeBinary(dirHandle, to, data);
  }

  async deleteFile(dirHandle: FileSystemDirectoryHandle, path: string): Promise<void> {
    const parts = path.split('/');
    const filename = parts.pop()!;
    const dir = parts.length > 0
      ? await getNestedHandle(dirHandle, parts)
      : dirHandle;
    await dir.removeEntry(filename);
  }

  async readBinary(dirHandle: FileSystemDirectoryHandle, path: string): Promise<ArrayBuffer> {
    const fileHandle = await getFileHandle(dirHandle, path);
    const file = await fileHandle.getFile();
    return file.arrayBuffer();
  }

  async writeBinary(dirHandle: FileSystemDirectoryHandle, path: string, data: ArrayBuffer): Promise<void> {
    const fileHandle = await getFileHandle(dirHandle, path, true);
    const writable = await fileHandle.createWritable();
    await writable.write(data);
    await writable.close();
  }
}
