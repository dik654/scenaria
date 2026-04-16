import { app, session, ipcMain, dialog, safeStorage, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
let mainWindow = null;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: "#f9fafb",
    webPreferences: {
      preload: path.join(__dirname$1, "../preload/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname$1, "../renderer/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const url = details.url;
    const isAI = /api\.(anthropic|openai)\.com/.test(url) || /localhost|127\.0\.0\.1/.test(url);
    if (isAI) {
      const headers = { ...details.responseHeaders };
      headers["access-control-allow-origin"] = ["*"];
      headers["access-control-allow-headers"] = ["*"];
      headers["access-control-allow-methods"] = ["GET, POST, OPTIONS"];
      callback({ responseHeaders: headers });
    } else {
      callback({ responseHeaders: details.responseHeaders });
    }
  });
  createWindow();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (!mainWindow) createWindow();
});
async function ensureDir(dirPath) {
  if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true });
}
ipcMain.handle("fileio:openProject", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    title: "프로젝트 열기"
  });
  if (result.canceled || result.filePaths.length === 0) throw new Error("AbortError");
  const dirPath = result.filePaths[0];
  return { name: path.basename(dirPath), ref: dirPath };
});
ipcMain.handle("fileio:createProject", async (_, name, parentPath) => {
  let parent;
  if (parentPath) {
    parent = parentPath;
  } else {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
      title: "프로젝트 저장 위치"
    });
    if (result.canceled) throw new Error("AbortError");
    parent = result.filePaths[0];
  }
  const projectName = name.endsWith(".scenaria") ? name : `${name}.scenaria`;
  const projectPath = path.join(parent, projectName);
  await fs.mkdir(projectPath, { recursive: true });
  return { name: projectName, ref: projectPath };
});
ipcMain.handle("fileio:readJSON", async (_, basePath, relPath) => {
  const fullPath = path.join(basePath, ...relPath.split("/"));
  const text = await fs.readFile(fullPath, "utf-8");
  return JSON.parse(text);
});
ipcMain.handle("fileio:writeJSON", async (_, basePath, relPath, data) => {
  const fullPath = path.join(basePath, ...relPath.split("/"));
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, JSON.stringify(data, null, 2), "utf-8");
});
ipcMain.handle("fileio:listFiles", async (_, basePath, dirPath) => {
  const fullPath = dirPath ? path.join(basePath, ...dirPath.split("/")) : basePath;
  try {
    const entries = await fs.readdir(fullPath);
    return entries;
  } catch {
    return [];
  }
});
ipcMain.handle("fileio:fileExists", async (_, basePath, relPath) => {
  const fullPath = path.join(basePath, ...relPath.split("/"));
  return existsSync(fullPath);
});
ipcMain.handle("fileio:copyFile", async (_, basePath, from, to) => {
  const srcPath = path.join(basePath, ...from.split("/"));
  const destPath = path.join(basePath, ...to.split("/"));
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await fs.copyFile(srcPath, destPath);
});
ipcMain.handle("fileio:deleteFile", async (_, basePath, relPath) => {
  const fullPath = path.join(basePath, ...relPath.split("/"));
  await fs.unlink(fullPath);
});
ipcMain.handle("fileio:readBinary", async (_, basePath, relPath) => {
  const fullPath = path.join(basePath, ...relPath.split("/"));
  const buffer = await fs.readFile(fullPath);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
});
ipcMain.handle("fileio:writeBinary", async (_, basePath, relPath, data) => {
  const fullPath = path.join(basePath, ...relPath.split("/"));
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, Buffer.from(data));
});
ipcMain.handle("historyfs:ensureDir", async (_, basePath, ...parts) => {
  const fullPath = path.join(basePath, ...parts);
  await fs.mkdir(fullPath, { recursive: true });
});
ipcMain.handle("historyfs:readJSON", async (_, basePath, ...pathParts) => {
  try {
    const fullPath = path.join(basePath, ...pathParts);
    const text = await fs.readFile(fullPath, "utf-8");
    return JSON.parse(text);
  } catch {
    return null;
  }
});
ipcMain.handle("historyfs:writeJSON", async (_, basePath, data, ...pathParts) => {
  const fullPath = path.join(basePath, ...pathParts);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, JSON.stringify(data, null, 2), "utf-8");
});
ipcMain.handle("historyfs:readText", async (_, basePath, ...pathParts) => {
  try {
    const fullPath = path.join(basePath, ...pathParts);
    return await fs.readFile(fullPath, "utf-8");
  } catch {
    return null;
  }
});
ipcMain.handle("historyfs:writeText", async (_, basePath, text, ...pathParts) => {
  const fullPath = path.join(basePath, ...pathParts);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, text, "utf-8");
});
ipcMain.handle("historyfs:captureSnapshot", async (_, basePath) => {
  const EXCLUDED = /* @__PURE__ */ new Set([".history", "storyboard", "audio", "video", ".scenaria-version"]);
  const snapshot = {};
  async function walk(dir, prefix) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (EXCLUDED.has(entry.name)) continue;
      const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(path.join(dir, entry.name), entryPath);
      } else if (entry.name.endsWith(".json")) {
        try {
          snapshot[entryPath] = await fs.readFile(path.join(dir, entry.name), "utf-8");
        } catch {
        }
      }
    }
  }
  await walk(basePath, "");
  return snapshot;
});
ipcMain.handle("historyfs:restoreSnapshot", async (_, basePath, snapshot) => {
  for (const [relPath, content] of Object.entries(snapshot)) {
    const fullPath = path.join(basePath, ...relPath.split("/"));
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, "utf-8");
  }
});
ipcMain.handle("historyfs:listDir", async (_, basePath, ...pathParts) => {
  const fullPath = path.join(basePath, ...pathParts);
  try {
    return await fs.readdir(fullPath);
  } catch {
    return [];
  }
});
ipcMain.handle("historyfs:deleteEntry", async (_, basePath, ...pathParts) => {
  const fullPath = path.join(basePath, ...pathParts);
  await fs.rm(fullPath, { recursive: true, force: true });
});
ipcMain.handle("safeStorage:encrypt", (_, text) => {
  if (!safeStorage.isEncryptionAvailable()) return text;
  return safeStorage.encryptString(text).toString("base64");
});
ipcMain.handle("safeStorage:decrypt", (_, encrypted) => {
  if (!safeStorage.isEncryptionAvailable()) return encrypted;
  return safeStorage.decryptString(Buffer.from(encrypted, "base64"));
});
function getRecentProjectsPath() {
  return path.join(app.getPath("userData"), "recent-projects.json");
}
ipcMain.handle("recent:get", async () => {
  try {
    const text = await fs.readFile(getRecentProjectsPath(), "utf-8");
    return JSON.parse(text);
  } catch {
    return [];
  }
});
ipcMain.handle("recent:save", async (_, projects) => {
  ensureDir(app.getPath("userData"));
  await fs.writeFile(getRecentProjectsPath(), JSON.stringify(projects, null, 2), "utf-8");
});
function findClaudeBin() {
  return "claude";
}
const FAST_CLI_ARGS = [
  "--no-session-persistence",
  // 세션 저장 안함
  "--tools",
  "",
  // 도구 사용 안함
  "--strict-mcp-config",
  // MCP 서버 로드 안함
  "--disable-slash-commands",
  // 스킬 로드 안함
  "--max-turns",
  "1"
  // 단일 턴 (라우팅 오버헤드 제거)
];
ipcMain.handle("claude-code:auth-status", async () => {
  return new Promise((resolve) => {
    const proc = spawn(findClaudeBin(), ["auth", "status"], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env }
    });
    let stdout = "";
    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.on("close", () => {
      try {
        const info = JSON.parse(stdout);
        resolve({ loggedIn: !!info.loggedIn, email: info.email, subscriptionType: info.subscriptionType });
      } catch {
        resolve({ loggedIn: false });
      }
    });
    proc.on("error", () => resolve({ loggedIn: false }));
  });
});
ipcMain.handle("claude-code:call", async (_, opts) => {
  console.log("[claude-code] non-stream call, model:", opts.model ?? "default");
  return new Promise((resolve, reject) => {
    const args = [
      "-p",
      opts.userPrompt,
      "--output-format",
      "json",
      "--system-prompt",
      opts.systemPrompt,
      ...FAST_CLI_ARGS
    ];
    if (opts.model) args.push("--model", opts.model);
    if (opts.maxTurns) args.push("--max-turns", String(opts.maxTurns));
    const proc = spawn(findClaudeBin(), args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env }
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("close", (code) => {
      if (code !== 0 && !stdout) {
        reject(new Error(stderr || `Claude Code 종료 (코드: ${code})`));
        return;
      }
      const lines = stdout.trim().split("\n");
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.result !== void 0) {
            const resultText = parsed.result ?? "";
            console.log("[claude-code] result length:", resultText.length, "preview:", resultText.slice(0, 200));
            resolve(resultText);
            return;
          }
        } catch {
        }
      }
      console.log("[claude-code] no result field found, raw stdout length:", stdout.length);
      resolve(stdout);
    });
    proc.on("error", (err) => {
      reject(new Error(`Claude Code 실행 실패: ${err.message}. claude CLI가 설치되어 있는지 확인해주세요.`));
    });
  });
});
ipcMain.handle("claude-code:stream", async (event, opts) => {
  console.log("[claude-code] stream call, model:", opts.model ?? "default", "requestId:", opts.requestId);
  return new Promise((resolve, reject) => {
    const args = [
      "-p",
      opts.userPrompt,
      "--output-format",
      "stream-json",
      "--verbose",
      "--system-prompt",
      opts.systemPrompt,
      ...FAST_CLI_ARGS
    ];
    if (opts.model) args.push("--model", opts.model);
    const proc = spawn(findClaudeBin(), args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env }
    });
    let result = "";
    let buffer = "";
    proc.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === "assistant" && parsed.message?.content) {
            for (const block of parsed.message.content) {
              if (block.type === "text" && block.text) {
                event.sender.send(`claude-code:stream-chunk:${opts.requestId}`, block.text);
              }
            }
          }
          if (parsed.type === "result") {
            result = parsed.result ?? "";
            if (parsed.is_error) {
              event.sender.send(`claude-code:stream-error:${opts.requestId}`, result);
            }
          }
        } catch {
        }
      }
    });
    proc.stderr.on("data", (chunk) => {
      const errText = chunk.toString();
      if (errText.includes("authentication") || errText.includes("login")) {
        event.sender.send(
          `claude-code:stream-error:${opts.requestId}`,
          "Claude Code 로그인이 필요합니다. 터미널에서 `claude login`을 실행해주세요."
        );
      }
    });
    proc.on("close", (code) => {
      event.sender.send(`claude-code:stream-done:${opts.requestId}`);
      if (code !== 0 && !result) {
        reject(new Error(`Claude Code 프로세스 종료 (코드: ${code})`));
      } else {
        resolve(result);
      }
    });
    proc.on("error", (err) => {
      reject(new Error(`Claude Code 실행 실패: ${err.message}. claude CLI가 설치되어 있는지 확인해주세요.`));
    });
  });
});
ipcMain.handle("claude-code:chat-stream", async (event, opts) => {
  console.log("[claude-code] chat-stream call, model:", opts.model ?? "default", "messages:", opts.messages.length);
  const conversationContext = opts.messages.map(
    (m) => m.role === "user" ? `사용자: ${m.content}` : `어시스턴트: ${m.content}`
  ).join("\n\n");
  const userPrompt = conversationContext;
  return new Promise((resolve, reject) => {
    const args = [
      "-p",
      userPrompt,
      "--output-format",
      "stream-json",
      "--verbose",
      "--system-prompt",
      opts.systemPrompt,
      ...FAST_CLI_ARGS
    ];
    if (opts.model) args.push("--model", opts.model);
    const proc = spawn(findClaudeBin(), args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env }
    });
    let result = "";
    let buffer = "";
    proc.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === "assistant" && parsed.message?.content) {
            for (const block of parsed.message.content) {
              if (block.type === "text" && block.text) {
                event.sender.send(`claude-code:stream-chunk:${opts.requestId}`, block.text);
              }
            }
          }
          if (parsed.type === "result") {
            result = parsed.result ?? "";
            if (parsed.is_error) {
              event.sender.send(`claude-code:stream-error:${opts.requestId}`, result);
            }
          }
        } catch {
        }
      }
    });
    proc.stderr.on("data", (chunk) => {
      const errText = chunk.toString();
      if (errText.includes("authentication") || errText.includes("login")) {
        event.sender.send(
          `claude-code:stream-error:${opts.requestId}`,
          "Claude Code 로그인이 필요합니다. 터미널에서 `claude login`을 실행해주세요."
        );
      }
    });
    proc.on("close", (code) => {
      event.sender.send(`claude-code:stream-done:${opts.requestId}`);
      if (code !== 0 && !result) {
        reject(new Error(`Claude Code 프로세스 종료 (코드: ${code})`));
      } else {
        resolve(result);
      }
    });
    proc.on("error", (err) => {
      reject(new Error(`Claude Code 실행 실패: ${err.message}`));
    });
  });
});
