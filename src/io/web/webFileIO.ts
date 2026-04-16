import type { FileIO, ProjectHandle, ProjectRef } from '../types';

function asDirHandle(ref: ProjectRef): FileSystemDirectoryHandle {
  return ref as FileSystemDirectoryHandle;
}

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
    return { name: dirHandle.name, ref: dirHandle };
  }

  async createProject(name: string, parentRef?: ProjectRef): Promise<ProjectHandle> {
    const parent = parentRef
      ? asDirHandle(parentRef)
      : await window.showDirectoryPicker({ mode: 'readwrite' });
    const projectName = name.endsWith('.scenaria') ? name : `${name}.scenaria`;
    const dirHandle = await parent.getDirectoryHandle(projectName, { create: true });
    return { name: projectName, ref: dirHandle };
  }

  async readJSON<T>(ref: ProjectRef, path: string): Promise<T> {
    const fileHandle = await getFileHandle(asDirHandle(ref), path);
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text) as T;
  }

  async writeJSON(ref: ProjectRef, path: string, data: unknown): Promise<void> {
    const fileHandle = await getFileHandle(asDirHandle(ref), path, true);
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
  }

  async listFiles(ref: ProjectRef, dirPath: string): Promise<string[]> {
    const dh = asDirHandle(ref);
    const dir = dirPath
      ? await getNestedHandle(dh, dirPath.split('/'))
      : dh;
    const names: string[] = [];
    for await (const entry of dir.values()) {
      names.push(entry.name);
    }
    return names;
  }

  async fileExists(ref: ProjectRef, path: string): Promise<boolean> {
    try {
      await getFileHandle(asDirHandle(ref), path);
      return true;
    } catch {
      return false;
    }
  }

  async copyFile(ref: ProjectRef, from: string, to: string): Promise<void> {
    const data = await this.readBinary(ref, from);
    await this.writeBinary(ref, to, data);
  }

  async deleteFile(ref: ProjectRef, path: string): Promise<void> {
    const parts = path.split('/');
    const filename = parts.pop()!;
    const dh = asDirHandle(ref);
    const dir = parts.length > 0
      ? await getNestedHandle(dh, parts)
      : dh;
    await dir.removeEntry(filename);
  }

  async readBinary(ref: ProjectRef, path: string): Promise<ArrayBuffer> {
    const fileHandle = await getFileHandle(asDirHandle(ref), path);
    const file = await fileHandle.getFile();
    return file.arrayBuffer();
  }

  async writeBinary(ref: ProjectRef, path: string, data: ArrayBuffer): Promise<void> {
    const fileHandle = await getFileHandle(asDirHandle(ref), path, true);
    const writable = await fileHandle.createWritable();
    await writable.write(data);
    await writable.close();
  }
}
