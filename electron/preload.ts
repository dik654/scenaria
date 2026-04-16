import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('__ELECTRON_IPC__', {
  // FileIO
  openProject: () => ipcRenderer.invoke('fileio:openProject'),
  createProject: (name: string, parentRef?: string) =>
    ipcRenderer.invoke('fileio:createProject', name, parentRef),
  readJSON: (ref: string, path: string) =>
    ipcRenderer.invoke('fileio:readJSON', ref, path),
  writeJSON: (ref: string, path: string, data: unknown) =>
    ipcRenderer.invoke('fileio:writeJSON', ref, path, data),
  listFiles: (ref: string, dirPath: string) =>
    ipcRenderer.invoke('fileio:listFiles', ref, dirPath),
  fileExists: (ref: string, path: string) =>
    ipcRenderer.invoke('fileio:fileExists', ref, path),
  copyFile: (ref: string, from: string, to: string) =>
    ipcRenderer.invoke('fileio:copyFile', ref, from, to),
  deleteFile: (ref: string, path: string) =>
    ipcRenderer.invoke('fileio:deleteFile', ref, path),
  readBinary: (ref: string, path: string) =>
    ipcRenderer.invoke('fileio:readBinary', ref, path),
  writeBinary: (ref: string, path: string, data: ArrayBuffer) =>
    ipcRenderer.invoke('fileio:writeBinary', ref, path, data),

  // HistoryFS
  historyFS: {
    ensureDir: (ref: string, ...parts: string[]) =>
      ipcRenderer.invoke('historyfs:ensureDir', ref, ...parts),
    readJSON: (ref: string, ...pathParts: string[]) =>
      ipcRenderer.invoke('historyfs:readJSON', ref, ...pathParts),
    writeJSON: (ref: string, data: unknown, ...pathParts: string[]) =>
      ipcRenderer.invoke('historyfs:writeJSON', ref, data, ...pathParts),
    readText: (ref: string, ...pathParts: string[]) =>
      ipcRenderer.invoke('historyfs:readText', ref, ...pathParts),
    writeText: (ref: string, text: string, ...pathParts: string[]) =>
      ipcRenderer.invoke('historyfs:writeText', ref, text, ...pathParts),
    captureSnapshot: (ref: string) =>
      ipcRenderer.invoke('historyfs:captureSnapshot', ref),
    restoreSnapshot: (ref: string, snapshot: Record<string, string>) =>
      ipcRenderer.invoke('historyfs:restoreSnapshot', ref, snapshot),
    listDir: (ref: string, ...pathParts: string[]) =>
      ipcRenderer.invoke('historyfs:listDir', ref, ...pathParts),
    deleteEntry: (ref: string, ...pathParts: string[]) =>
      ipcRenderer.invoke('historyfs:deleteEntry', ref, ...pathParts),
  },

  // Safe Storage
  safeStorage: {
    encrypt: (text: string) => ipcRenderer.invoke('safeStorage:encrypt', text),
    decrypt: (encrypted: string) => ipcRenderer.invoke('safeStorage:decrypt', encrypted),
  },

  // Recent Projects
  recentProjects: {
    get: () => ipcRenderer.invoke('recent:get'),
    save: (projects: unknown) => ipcRenderer.invoke('recent:save', projects),
  },

  // Claude Code CLI
  claudeCode: {
    authStatus: () => ipcRenderer.invoke('claude-code:auth-status'),
    call: (opts: { systemPrompt: string; userPrompt: string; model?: string; maxTurns?: number }) =>
      ipcRenderer.invoke('claude-code:call', opts),
    stream: (opts: { requestId: string; systemPrompt: string; userPrompt: string; model?: string }) =>
      ipcRenderer.invoke('claude-code:stream', opts),
    chatStream: (opts: {
      requestId: string; systemPrompt: string;
      messages: { role: 'user' | 'assistant'; content: string }[]; model?: string;
    }) => ipcRenderer.invoke('claude-code:chat-stream', opts),
    onStreamChunk: (requestId: string, cb: (text: string) => void) => {
      const channel = `claude-code:stream-chunk:${requestId}`;
      const handler = (_: unknown, text: string) => cb(text);
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    },
    onStreamError: (requestId: string, cb: (err: string) => void) => {
      const channel = `claude-code:stream-error:${requestId}`;
      const handler = (_: unknown, err: string) => cb(err);
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    },
    onStreamDone: (requestId: string, cb: () => void) => {
      const channel = `claude-code:stream-done:${requestId}`;
      const handler = () => cb();
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    },
  },
});
