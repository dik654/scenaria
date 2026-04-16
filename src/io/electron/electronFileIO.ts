import type { FileIO, ProjectHandle, ProjectRef } from '../types';

function ipc(): Record<string, (...args: unknown[]) => Promise<unknown>> {
  return (window as unknown as Record<string, unknown>).__ELECTRON_IPC__ as Record<string, (...args: unknown[]) => Promise<unknown>>;
}

export class ElectronFileIO implements FileIO {
  async openProject(): Promise<ProjectHandle> {
    return ipc().openProject() as Promise<ProjectHandle>;
  }

  async createProject(name: string, parentRef?: ProjectRef): Promise<ProjectHandle> {
    return ipc().createProject(name, parentRef as string) as Promise<ProjectHandle>;
  }

  async readJSON<T>(ref: ProjectRef, path: string): Promise<T> {
    return ipc().readJSON(ref as string, path) as Promise<T>;
  }

  async writeJSON(ref: ProjectRef, path: string, data: unknown): Promise<void> {
    await ipc().writeJSON(ref as string, path, data);
  }

  async listFiles(ref: ProjectRef, dirPath: string): Promise<string[]> {
    return ipc().listFiles(ref as string, dirPath) as Promise<string[]>;
  }

  async fileExists(ref: ProjectRef, path: string): Promise<boolean> {
    return ipc().fileExists(ref as string, path) as Promise<boolean>;
  }

  async copyFile(ref: ProjectRef, from: string, to: string): Promise<void> {
    await ipc().copyFile(ref as string, from, to);
  }

  async deleteFile(ref: ProjectRef, path: string): Promise<void> {
    await ipc().deleteFile(ref as string, path);
  }

  async readBinary(ref: ProjectRef, path: string): Promise<ArrayBuffer> {
    return ipc().readBinary(ref as string, path) as Promise<ArrayBuffer>;
  }

  async writeBinary(ref: ProjectRef, path: string, data: ArrayBuffer): Promise<void> {
    await ipc().writeBinary(ref as string, path, data);
  }
}
