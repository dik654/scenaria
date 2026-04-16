"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("__ELECTRON_IPC__", {
  // FileIO
  openProject: () => electron.ipcRenderer.invoke("fileio:openProject"),
  createProject: (name, parentRef) => electron.ipcRenderer.invoke("fileio:createProject", name, parentRef),
  readJSON: (ref, path) => electron.ipcRenderer.invoke("fileio:readJSON", ref, path),
  writeJSON: (ref, path, data) => electron.ipcRenderer.invoke("fileio:writeJSON", ref, path, data),
  listFiles: (ref, dirPath) => electron.ipcRenderer.invoke("fileio:listFiles", ref, dirPath),
  fileExists: (ref, path) => electron.ipcRenderer.invoke("fileio:fileExists", ref, path),
  copyFile: (ref, from, to) => electron.ipcRenderer.invoke("fileio:copyFile", ref, from, to),
  deleteFile: (ref, path) => electron.ipcRenderer.invoke("fileio:deleteFile", ref, path),
  readBinary: (ref, path) => electron.ipcRenderer.invoke("fileio:readBinary", ref, path),
  writeBinary: (ref, path, data) => electron.ipcRenderer.invoke("fileio:writeBinary", ref, path, data),
  // HistoryFS
  historyFS: {
    ensureDir: (ref, ...parts) => electron.ipcRenderer.invoke("historyfs:ensureDir", ref, ...parts),
    readJSON: (ref, ...pathParts) => electron.ipcRenderer.invoke("historyfs:readJSON", ref, ...pathParts),
    writeJSON: (ref, data, ...pathParts) => electron.ipcRenderer.invoke("historyfs:writeJSON", ref, data, ...pathParts),
    readText: (ref, ...pathParts) => electron.ipcRenderer.invoke("historyfs:readText", ref, ...pathParts),
    writeText: (ref, text, ...pathParts) => electron.ipcRenderer.invoke("historyfs:writeText", ref, text, ...pathParts),
    captureSnapshot: (ref) => electron.ipcRenderer.invoke("historyfs:captureSnapshot", ref),
    restoreSnapshot: (ref, snapshot) => electron.ipcRenderer.invoke("historyfs:restoreSnapshot", ref, snapshot),
    listDir: (ref, ...pathParts) => electron.ipcRenderer.invoke("historyfs:listDir", ref, ...pathParts),
    deleteEntry: (ref, ...pathParts) => electron.ipcRenderer.invoke("historyfs:deleteEntry", ref, ...pathParts)
  },
  // Safe Storage
  safeStorage: {
    encrypt: (text) => electron.ipcRenderer.invoke("safeStorage:encrypt", text),
    decrypt: (encrypted) => electron.ipcRenderer.invoke("safeStorage:decrypt", encrypted)
  },
  // Recent Projects
  recentProjects: {
    get: () => electron.ipcRenderer.invoke("recent:get"),
    save: (projects) => electron.ipcRenderer.invoke("recent:save", projects)
  },
  // Claude Code CLI
  claudeCode: {
    authStatus: () => electron.ipcRenderer.invoke("claude-code:auth-status"),
    call: (opts) => electron.ipcRenderer.invoke("claude-code:call", opts),
    stream: (opts) => electron.ipcRenderer.invoke("claude-code:stream", opts),
    chatStream: (opts) => electron.ipcRenderer.invoke("claude-code:chat-stream", opts),
    onStreamChunk: (requestId, cb) => {
      const channel = `claude-code:stream-chunk:${requestId}`;
      const handler = (_, text) => cb(text);
      electron.ipcRenderer.on(channel, handler);
      return () => electron.ipcRenderer.removeListener(channel, handler);
    },
    onStreamError: (requestId, cb) => {
      const channel = `claude-code:stream-error:${requestId}`;
      const handler = (_, err) => cb(err);
      electron.ipcRenderer.on(channel, handler);
      return () => electron.ipcRenderer.removeListener(channel, handler);
    },
    onStreamDone: (requestId, cb) => {
      const channel = `claude-code:stream-done:${requestId}`;
      const handler = () => cb();
      electron.ipcRenderer.on(channel, handler);
      return () => electron.ipcRenderer.removeListener(channel, handler);
    }
  }
});
