export interface ProjectHandle {
  name: string;
  dirHandle: FileSystemDirectoryHandle;
}

export interface FileIO {
  openProject(): Promise<ProjectHandle>;
  createProject(name: string, parentDirHandle?: FileSystemDirectoryHandle): Promise<ProjectHandle>;
  readJSON<T>(dirHandle: FileSystemDirectoryHandle, path: string): Promise<T>;
  writeJSON(dirHandle: FileSystemDirectoryHandle, path: string, data: unknown): Promise<void>;
  listFiles(dirHandle: FileSystemDirectoryHandle, dirPath: string): Promise<string[]>;
  fileExists(dirHandle: FileSystemDirectoryHandle, path: string): Promise<boolean>;
  copyFile(dirHandle: FileSystemDirectoryHandle, from: string, to: string): Promise<void>;
  deleteFile(dirHandle: FileSystemDirectoryHandle, path: string): Promise<void>;
  readBinary(dirHandle: FileSystemDirectoryHandle, path: string): Promise<ArrayBuffer>;
  writeBinary(dirHandle: FileSystemDirectoryHandle, path: string, data: ArrayBuffer): Promise<void>;
}
