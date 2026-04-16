import { app, BrowserWindow, ipcMain, dialog, safeStorage, session } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#f9fafb',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  // Bypass CORS for AI API calls (Anthropic, OpenAI, local endpoints)
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const url = details.url;
    const isAI = /api\.(anthropic|openai)\.com/.test(url)
      || /localhost|127\.0\.0\.1/.test(url);
    if (isAI) {
      const headers = { ...details.responseHeaders };
      headers['access-control-allow-origin'] = ['*'];
      headers['access-control-allow-headers'] = ['*'];
      headers['access-control-allow-methods'] = ['GET, POST, OPTIONS'];
      callback({ responseHeaders: headers });
    } else {
      callback({ responseHeaders: details.responseHeaders });
    }
  });

  createWindow();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!mainWindow) createWindow(); });

// ── File I/O IPC ──

async function ensureDir(dirPath: string) {
  if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true });
}

ipcMain.handle('fileio:openProject', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
    title: '프로젝트 열기',
  });
  if (result.canceled || result.filePaths.length === 0) throw new Error('AbortError');
  const dirPath = result.filePaths[0];
  return { name: path.basename(dirPath), ref: dirPath };
});

ipcMain.handle('fileio:createProject', async (_, name: string, parentPath?: string) => {
  let parent: string;
  if (parentPath) {
    parent = parentPath;
  } else {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
      title: '프로젝트 저장 위치',
    });
    if (result.canceled) throw new Error('AbortError');
    parent = result.filePaths[0];
  }
  const projectName = name.endsWith('.scenaria') ? name : `${name}.scenaria`;
  const projectPath = path.join(parent, projectName);
  await fs.mkdir(projectPath, { recursive: true });
  return { name: projectName, ref: projectPath };
});

ipcMain.handle('fileio:readJSON', async (_, basePath: string, relPath: string) => {
  const fullPath = path.join(basePath, ...relPath.split('/'));
  const text = await fs.readFile(fullPath, 'utf-8');
  return JSON.parse(text);
});

ipcMain.handle('fileio:writeJSON', async (_, basePath: string, relPath: string, data: unknown) => {
  const fullPath = path.join(basePath, ...relPath.split('/'));
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, JSON.stringify(data, null, 2), 'utf-8');
});

ipcMain.handle('fileio:listFiles', async (_, basePath: string, dirPath: string) => {
  const fullPath = dirPath ? path.join(basePath, ...dirPath.split('/')) : basePath;
  try {
    const entries = await fs.readdir(fullPath);
    return entries;
  } catch {
    return [];
  }
});

ipcMain.handle('fileio:fileExists', async (_, basePath: string, relPath: string) => {
  const fullPath = path.join(basePath, ...relPath.split('/'));
  return existsSync(fullPath);
});

ipcMain.handle('fileio:copyFile', async (_, basePath: string, from: string, to: string) => {
  const srcPath = path.join(basePath, ...from.split('/'));
  const destPath = path.join(basePath, ...to.split('/'));
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await fs.copyFile(srcPath, destPath);
});

ipcMain.handle('fileio:deleteFile', async (_, basePath: string, relPath: string) => {
  const fullPath = path.join(basePath, ...relPath.split('/'));
  await fs.unlink(fullPath);
});

ipcMain.handle('fileio:readBinary', async (_, basePath: string, relPath: string) => {
  const fullPath = path.join(basePath, ...relPath.split('/'));
  const buffer = await fs.readFile(fullPath);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
});

ipcMain.handle('fileio:writeBinary', async (_, basePath: string, relPath: string, data: ArrayBuffer) => {
  const fullPath = path.join(basePath, ...relPath.split('/'));
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, Buffer.from(data));
});

// ── History FS IPC ──

ipcMain.handle('historyfs:ensureDir', async (_, basePath: string, ...parts: string[]) => {
  const fullPath = path.join(basePath, ...parts);
  await fs.mkdir(fullPath, { recursive: true });
});

ipcMain.handle('historyfs:readJSON', async (_, basePath: string, ...pathParts: string[]) => {
  try {
    const fullPath = path.join(basePath, ...pathParts);
    const text = await fs.readFile(fullPath, 'utf-8');
    return JSON.parse(text);
  } catch {
    return null;
  }
});

ipcMain.handle('historyfs:writeJSON', async (_, basePath: string, data: unknown, ...pathParts: string[]) => {
  const fullPath = path.join(basePath, ...pathParts);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, JSON.stringify(data, null, 2), 'utf-8');
});

ipcMain.handle('historyfs:readText', async (_, basePath: string, ...pathParts: string[]) => {
  try {
    const fullPath = path.join(basePath, ...pathParts);
    return await fs.readFile(fullPath, 'utf-8');
  } catch {
    return null;
  }
});

ipcMain.handle('historyfs:writeText', async (_, basePath: string, text: string, ...pathParts: string[]) => {
  const fullPath = path.join(basePath, ...pathParts);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, text, 'utf-8');
});

ipcMain.handle('historyfs:captureSnapshot', async (_, basePath: string) => {
  const EXCLUDED = new Set(['.history', 'storyboard', 'audio', 'video', '.scenaria-version']);
  const snapshot: Record<string, string> = {};

  async function walk(dir: string, prefix: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (EXCLUDED.has(entry.name)) continue;
      const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(path.join(dir, entry.name), entryPath);
      } else if (entry.name.endsWith('.json')) {
        try {
          snapshot[entryPath] = await fs.readFile(path.join(dir, entry.name), 'utf-8');
        } catch { /* skip */ }
      }
    }
  }

  await walk(basePath, '');
  return snapshot;
});

ipcMain.handle('historyfs:restoreSnapshot', async (_, basePath: string, snapshot: Record<string, string>) => {
  for (const [relPath, content] of Object.entries(snapshot)) {
    const fullPath = path.join(basePath, ...relPath.split('/'));
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
  }
});

ipcMain.handle('historyfs:listDir', async (_, basePath: string, ...pathParts: string[]) => {
  const fullPath = path.join(basePath, ...pathParts);
  try {
    return await fs.readdir(fullPath);
  } catch {
    return [];
  }
});

ipcMain.handle('historyfs:deleteEntry', async (_, basePath: string, ...pathParts: string[]) => {
  const fullPath = path.join(basePath, ...pathParts);
  await fs.rm(fullPath, { recursive: true, force: true });
});

// ── Safe Storage ──

ipcMain.handle('safeStorage:encrypt', (_, text: string) => {
  if (!safeStorage.isEncryptionAvailable()) return text;
  return safeStorage.encryptString(text).toString('base64');
});

ipcMain.handle('safeStorage:decrypt', (_, encrypted: string) => {
  if (!safeStorage.isEncryptionAvailable()) return encrypted;
  return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
});

// ── Recent Projects ──

function getRecentProjectsPath(): string {
  return path.join(app.getPath('userData'), 'recent-projects.json');
}

ipcMain.handle('recent:get', async () => {
  try {
    const text = await fs.readFile(getRecentProjectsPath(), 'utf-8');
    return JSON.parse(text);
  } catch {
    return [];
  }
});

ipcMain.handle('recent:save', async (_, projects: unknown) => {
  ensureDir(app.getPath('userData'));
  await fs.writeFile(getRecentProjectsPath(), JSON.stringify(projects, null, 2), 'utf-8');
});

// ── Claude Code CLI IPC ──

/** Resolve the `claude` binary path, preferring the global npm install */
function findClaudeBin(): string {
  return 'claude'; // relies on $PATH
}

/** Common args to skip unnecessary CLI initialization for faster calls */
const FAST_CLI_ARGS = [
  '--no-session-persistence',   // 세션 저장 안함
  '--tools', '',                // 도구 사용 안함
  '--strict-mcp-config',        // MCP 서버 로드 안함
  '--disable-slash-commands',   // 스킬 로드 안함
  '--max-turns', '1',           // 단일 턴 (라우팅 오버헤드 제거)
];

ipcMain.handle('claude-code:auth-status', async () => {
  return new Promise<{ loggedIn: boolean; email?: string; subscriptionType?: string }>((resolve) => {
    const proc = spawn(findClaudeBin(), ['auth', 'status'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    let stdout = '';
    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.on('close', () => {
      try {
        const info = JSON.parse(stdout);
        resolve({ loggedIn: !!info.loggedIn, email: info.email, subscriptionType: info.subscriptionType });
      } catch {
        resolve({ loggedIn: false });
      }
    });
    proc.on('error', () => resolve({ loggedIn: false }));
  });
});

/** Non-streaming call — returns final text */
ipcMain.handle('claude-code:call', async (_, opts: {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  maxTurns?: number;
}) => {
  console.log('[claude-code] non-stream call, model:', opts.model ?? 'default');
  return new Promise<string>((resolve, reject) => {
    const args = [
      '-p', opts.userPrompt,
      '--output-format', 'json',
      '--system-prompt', opts.systemPrompt,
      ...FAST_CLI_ARGS,
    ];
    if (opts.model) args.push('--model', opts.model);
    if (opts.maxTurns) args.push('--max-turns', String(opts.maxTurns));

    const proc = spawn(findClaudeBin(), args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code !== 0 && !stdout) {
        reject(new Error(stderr || `Claude Code 종료 (코드: ${code})`));
        return;
      }
      // --output-format json: single JSON object with .result field
      const lines = stdout.trim().split('\n');
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.result !== undefined) {
            const resultText = parsed.result ?? '';
            console.log('[claude-code] result length:', resultText.length, 'preview:', resultText.slice(0, 200));
            resolve(resultText);
            return;
          }
        } catch { /* skip non-JSON lines */ }
      }
      console.log('[claude-code] no result field found, raw stdout length:', stdout.length);
      resolve(stdout);
    });

    proc.on('error', (err) => {
      reject(new Error(`Claude Code 실행 실패: ${err.message}. claude CLI가 설치되어 있는지 확인해주세요.`));
    });
  });
});

/** Streaming call — sends text chunks via IPC events, returns final text */
ipcMain.handle('claude-code:stream', async (event, opts: {
  requestId: string;
  systemPrompt: string;
  userPrompt: string;
  model?: string;
}) => {
  console.log('[claude-code] stream call, model:', opts.model ?? 'default', 'requestId:', opts.requestId);
  return new Promise<string>((resolve, reject) => {
    const args = [
      '-p', opts.userPrompt,
      '--output-format', 'stream-json',
      '--verbose',
      '--system-prompt', opts.systemPrompt,
      ...FAST_CLI_ARGS,
    ];
    if (opts.model) args.push('--model', opts.model);

    const proc = spawn(findClaudeBin(), args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let result = '';
    let buffer = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === 'assistant' && parsed.message?.content) {
            for (const block of parsed.message.content) {
              if (block.type === 'text' && block.text) {
                event.sender.send(`claude-code:stream-chunk:${opts.requestId}`, block.text);
              }
            }
          }
          if (parsed.type === 'result') {
            result = parsed.result ?? '';
            if (parsed.is_error) {
              event.sender.send(`claude-code:stream-error:${opts.requestId}`, result);
            }
          }
        } catch { /* skip non-JSON lines */ }
      }
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      const errText = chunk.toString();
      if (errText.includes('authentication') || errText.includes('login')) {
        event.sender.send(`claude-code:stream-error:${opts.requestId}`,
          'Claude Code 로그인이 필요합니다. 터미널에서 `claude login`을 실행해주세요.');
      }
    });

    proc.on('close', (code) => {
      event.sender.send(`claude-code:stream-done:${opts.requestId}`);
      if (code !== 0 && !result) {
        reject(new Error(`Claude Code 프로세스 종료 (코드: ${code})`));
      } else {
        resolve(result);
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Claude Code 실행 실패: ${err.message}. claude CLI가 설치되어 있는지 확인해주세요.`));
    });
  });
});

/** Chat streaming — supports multi-turn messages */
ipcMain.handle('claude-code:chat-stream', async (event, opts: {
  requestId: string;
  systemPrompt: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  model?: string;
}) => {
  console.log('[claude-code] chat-stream call, model:', opts.model ?? 'default', 'messages:', opts.messages.length);
  // For chat, we build a single combined prompt with conversation context
  const conversationContext = opts.messages.map(m =>
    m.role === 'user' ? `사용자: ${m.content}` : `어시스턴트: ${m.content}`
  ).join('\n\n');

  const userPrompt = conversationContext;

  return new Promise<string>((resolve, reject) => {
    const args = [
      '-p', userPrompt,
      '--output-format', 'stream-json',
      '--verbose',
      '--system-prompt', opts.systemPrompt,
      ...FAST_CLI_ARGS,
    ];
    if (opts.model) args.push('--model', opts.model);

    const proc = spawn(findClaudeBin(), args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let result = '';
    let buffer = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === 'assistant' && parsed.message?.content) {
            for (const block of parsed.message.content) {
              if (block.type === 'text' && block.text) {
                event.sender.send(`claude-code:stream-chunk:${opts.requestId}`, block.text);
              }
            }
          }
          if (parsed.type === 'result') {
            result = parsed.result ?? '';
            if (parsed.is_error) {
              event.sender.send(`claude-code:stream-error:${opts.requestId}`, result);
            }
          }
        } catch { /* skip */ }
      }
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      const errText = chunk.toString();
      if (errText.includes('authentication') || errText.includes('login')) {
        event.sender.send(`claude-code:stream-error:${opts.requestId}`,
          'Claude Code 로그인이 필요합니다. 터미널에서 `claude login`을 실행해주세요.');
      }
    });

    proc.on('close', (code) => {
      event.sender.send(`claude-code:stream-done:${opts.requestId}`);
      if (code !== 0 && !result) {
        reject(new Error(`Claude Code 프로세스 종료 (코드: ${code})`));
      } else {
        resolve(result);
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Claude Code 실행 실패: ${err.message}`));
    });
  });
});
