/**
 * ProjectRef: opaque reference to a project directory.
 * - Web: FileSystemDirectoryHandle
 * - Electron: string (absolute path)
 */
export type ProjectRef = FileSystemDirectoryHandle | string;

export interface ProjectHandle {
  name: string;
  ref: ProjectRef;
}

export interface FileIO {
  openProject(): Promise<ProjectHandle>;
  createProject(name: string, parentRef?: ProjectRef): Promise<ProjectHandle>;
  readJSON<T>(ref: ProjectRef, path: string): Promise<T>;
  writeJSON(ref: ProjectRef, path: string, data: unknown): Promise<void>;
  listFiles(ref: ProjectRef, dirPath: string): Promise<string[]>;
  fileExists(ref: ProjectRef, path: string): Promise<boolean>;
  copyFile(ref: ProjectRef, from: string, to: string): Promise<void>;
  deleteFile(ref: ProjectRef, path: string): Promise<void>;
  readBinary(ref: ProjectRef, path: string): Promise<ArrayBuffer>;
  writeBinary(ref: ProjectRef, path: string, data: ArrayBuffer): Promise<void>;
}
