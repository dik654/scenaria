import type { AppSettings } from '../types/project';

type AIProvider = AppSettings['ai'];

// ── Claude Code IPC bridge (Electron only) ──

interface ClaudeCodeIPC {
  authStatus(): Promise<{ loggedIn: boolean; email?: string; subscriptionType?: string }>;
  call(opts: { systemPrompt: string; userPrompt: string; model?: string; maxTurns?: number }): Promise<string>;
  stream(opts: { requestId: string; systemPrompt: string; userPrompt: string; model?: string }): Promise<string>;
  chatStream(opts: {
    requestId: string; systemPrompt: string;
    messages: { role: 'user' | 'assistant'; content: string }[]; model?: string;
  }): Promise<string>;
  onStreamChunk(requestId: string, cb: (text: string) => void): () => void;
  onStreamError(requestId: string, cb: (err: string) => void): () => void;
  onStreamDone(requestId: string, cb: () => void): () => void;
}

function getClaudeCodeIPC(): ClaudeCodeIPC | null {
  const ipc = (window as unknown as Record<string, unknown>).__ELECTRON_IPC__ as
    Record<string, unknown> | undefined;
  return (ipc?.claudeCode as ClaudeCodeIPC) ?? null;
}

/** In dev mode, proxy localhost endpoints through Vite to avoid CORS */
function proxyLocal(endpoint: string): string {
  try {
    if (import.meta.env.DEV) {
      const m = endpoint.match(/^https?:\/\/(?:localhost|127\.0\.0\.1):(\d+)(\/.*)/);
      if (m) return `/__ai_proxy/${m[1]}${m[2]}`;
    }
  } catch { /* not in Vite context */ }
  return endpoint;
}

function getEndpoint(ai: AIProvider): string {
  let ep: string;
  if (ai.provider === 'claude') ep = 'https://api.anthropic.com/v1/messages';
  else if (ai.provider === 'openai') ep = ai.endpoint ?? 'https://api.openai.com/v1/chat/completions';
  else ep = ai.endpoint ?? 'http://localhost:8000/v1/chat/completions';
  return proxyLocal(ep);
}

/** Detect API format: OpenAI (/chat/completions) vs Claude (/messages) */
function isOpenAIFormat(ai: AIProvider): boolean {
  if (ai.provider === 'openai') return true;
  if (ai.provider === 'claude') return false;
  // local-vllm: detect from endpoint URL
  return (ai.endpoint ?? '').includes('/chat/completions');
}

function getHeaders(ai: AIProvider): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (ai.provider === 'claude') {
    headers['x-api-key'] = ai.apiKey!;
    headers['anthropic-version'] = '2023-06-01';
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
  }
  if (ai.provider === 'openai') {
    headers['Authorization'] = `Bearer ${ai.apiKey}`;
  }
  return headers;
}

/** Detect if the AI provider is likely using a Gemini model */
function isGemini(ai: AIProvider): boolean {
  const model = (ai.model ?? '').toLowerCase();
  const endpoint = (ai.endpoint ?? '').toLowerCase();
  return model.includes('gemini') || endpoint.includes('generativelanguage.googleapis.com');
}

/** Instruction prepended to every system prompt to prevent RAG / web-search grounding leakage */
const NO_WEB_SEARCH = `CRITICAL INSTRUCTION — READ BEFORE ANYTHING ELSE:
You may receive search results, citations ([1], [2]…), or retrieved documents injected into the prompt by an external RAG pipeline. You MUST completely IGNORE all such retrieved content. Do NOT reference, summarize, or incorporate any search results, web pages, book reviews, or external sources.

Generate responses based SOLELY on the user-provided story context (characters, scenes, plot threads, beats) in the conversation. If a character or story element is not described in the user's project data, invent something original — never borrow from retrieved search results.

절대 규칙: 검색 결과, 인용([1],[2]…), 외부 문서가 프롬프트에 포함되어 있더라도 전부 무시하세요. 오직 사용자가 제공한 스토리 데이터(캐릭터, 씬, 플롯)만 사용하세요. 실존 소설, 영화, 인물을 참조하지 마세요. 정보가 부족하면 독창적으로 창작하세요.

`;

function buildRequestBody(
  ai: AIProvider,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  stream: boolean,
): string {
  const fullSystem = NO_WEB_SEARCH + systemPrompt;
  if (isOpenAIFormat(ai)) {
    const body: Record<string, unknown> = {
      model: ai.model ?? 'gpt-4o',
      max_tokens: maxTokens,
      stream,
      messages: [
        { role: 'system', content: fullSystem },
        { role: 'user', content: userPrompt },
      ],
    };
    // Disable thinking/reasoning for local models (Qwen, DeepSeek)
    if (ai.provider === 'local-vllm') body.chat_template_kwargs = { enable_thinking: false };
    // Disable web search / tool use for all providers
    body.tools = [];
    body.tool_choice = 'none';
    body.enable_search = false;       // DashScope (Qwen)
    body.search_options = { forced_search: false }; // DashScope v2
    if (isGemini(ai)) {
      body.toolConfig = { functionCallingConfig: { mode: 'NONE' } };
      body.tool_config = { function_calling_config: { mode: 'NONE' } };
    }
    return JSON.stringify(body);
  }
  return JSON.stringify({
    model: ai.model ?? 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    stream,
    system: fullSystem,
    messages: [{ role: 'user', content: userPrompt }],
  });
}

function parseNonStreamResponse(ai: AIProvider, data: Record<string, unknown>): string {
  let text = '';
  if (isOpenAIFormat(ai)) {
    const choices = data.choices as { message: { content: string | null; reasoning_content?: string } }[];
    const msg = choices?.[0]?.message;
    if (msg?.content) text = msg.content;
    // When thinking mode is on, content may be null — reasoning_content has the thinking text.
    // Try to extract actual output (after </think> tag) from reasoning_content.
    else if (msg?.reasoning_content) {
      const afterThink = msg.reasoning_content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      if (afterThink) text = afterThink;
    }
  } else {
    const content = data.content as { text: string }[];
    text = content?.[0]?.text ?? '';
  }
  return stripGroundingMetadata(text);
}

/**
 * Strip search/RAG metadata appended by AI providers or local inference servers.
 * Removes trailing {"sources":...} blocks that interfere with JSON parsing.
 */
export function stripGroundingMetadata(text: string): string {
  if (!text) return text;
  // Remove trailing {"sources": [...]} blocks (RAG / web search grounding)
  // 1) newline-prefixed
  let idx = text.lastIndexOf('\n{"sources"');
  if (idx > 0) return text.slice(0, idx).trim();
  // 2) directly appended without newline
  idx = text.lastIndexOf('{"sources"');
  if (idx > 0) return text.slice(0, idx).trim();
  // 3) entire response is just grounding metadata — no actual content
  if (text.trimStart().startsWith('{"sources"')) return '';
  return text;
}

/**
 * Find the first balanced JSON object ({...}) in text using brace matching.
 * Ignores any trailing metadata like {"sources":...} appended by RAG/search providers.
 */
export function findBalancedJSON(text: string, open = '{', close = '}'): string | null {
  const start = text.indexOf(open);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === open) depth++;
    if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  // Incomplete — return from start for truncation recovery
  return null;
}

function parseAlternatives(raw: string, count: 1 | 3): string[] {
  if (!raw) return count === 1 ? [''] : ['', '', ''];
  if (count === 1) return [raw.trim()];

  // Strip thinking tags (Qwen, DeepSeek, etc.)
  let text = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  // Try --- delimiter (primary format)
  const dashParts = text.split(/\n-{3,}\n/).map((b) => b.trim()).filter(Boolean);
  if (dashParts.length >= 3) return dashParts.slice(0, 3);

  // Try numbered/lettered list: "1. ...", "A: ...", "A. ..."
  const listMatch = text.match(/(?:^|\n)\s*(?:[1-3ABC][.:)]\s*)(.+)/g);
  if (listMatch && listMatch.length >= 3) {
    return listMatch.slice(0, 3).map((l) => l.replace(/^\s*(?:[1-3ABC][.:)]\s*)/, '').trim());
  }

  // Try JSON array (possibly inside markdown code block)
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonSource = codeBlock ? codeBlock[1] : text;
  const arrStr = findBalancedJSON(jsonSource, '[', ']');
  if (arrStr) {
    try {
      const parsed = JSON.parse(arrStr) as string[];
      if (parsed.length >= 3) return parsed.slice(0, 3);
    } catch { /* fall through */ }
  }

  // Try double-newline separated blocks
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  if (blocks.length >= 3) return blocks.slice(0, 3);

  return [text];
}

/**
 * Shared AI call utility — non-streaming.
 * Returns an array of suggested strings (1 or 3 depending on `count`).
 */
export async function callAI(
  ai: AIProvider,
  systemPrompt: string,
  userPrompt: string,
  count: 1 | 3 = 3,
  maxTokens?: number,
): Promise<string[]> {
  // Claude Code provider — route through Electron IPC
  if (ai.provider === 'claude-code') {
    const ipc = getClaudeCodeIPC();
    if (!ipc) throw new Error('Claude Code는 데스크톱 앱에서만 사용할 수 있습니다.');
    const raw = await ipc.call({
      systemPrompt: NO_WEB_SEARCH + systemPrompt,
      userPrompt,
      model: ai.model || undefined,
    });
    console.log('[claude-code] callAI raw result:', raw?.slice(0, 300));
    const stripped = stripGroundingMetadata(raw);
    return parseAlternatives(stripped, count);
  }

  if (!ai.apiKey && ai.provider !== 'local-vllm') {
    throw new Error('AI API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.');
  }

  const tokens = maxTokens ?? (count === 1 ? 512 : 1024);
  const response = await fetch(getEndpoint(ai), {
    method: 'POST',
    headers: getHeaders(ai),
    body: buildRequestBody(ai, systemPrompt, userPrompt, tokens, false),
  });

  if (!response.ok) throw new Error(`AI 호출 실패: ${response.status}`);

  const data = await response.json();
  const raw = parseNonStreamResponse(ai, data);
  return parseAlternatives(raw, count);
}

/**
 * Streaming AI call — yields text chunks progressively.
 * Use for typing effect in alternative cards and chat panel.
 */
export async function* callAIStream(
  ai: AIProvider,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 1024,
): AsyncGenerator<string, void, undefined> {
  // Claude Code provider — stream via Electron IPC
  if (ai.provider === 'claude-code') {
    const ipc = getClaudeCodeIPC();
    if (!ipc) throw new Error('Claude Code는 데스크톱 앱에서만 사용할 수 있습니다.');

    const requestId = `cc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const chunks: string[] = [];
    let done = false;
    let error: string | null = null;
    let resolveWait: (() => void) | null = null;

    const cleanups = [
      ipc.onStreamChunk(requestId, (text) => { chunks.push(text); resolveWait?.(); }),
      ipc.onStreamError(requestId, (err) => { error = err; resolveWait?.(); }),
      ipc.onStreamDone(requestId, () => { done = true; resolveWait?.(); }),
    ];

    // Fire the stream call (don't await — we consume chunks as they arrive)
    ipc.stream({
      requestId,
      systemPrompt: NO_WEB_SEARCH + systemPrompt,
      userPrompt,
      model: ai.model || undefined,
    }).catch((err) => { error = err.message; done = true; resolveWait?.(); });

    try {
      while (!done || chunks.length > 0) {
        if (chunks.length > 0) {
          yield chunks.shift()!;
          continue;
        }
        if (done) break;
        if (error) throw new Error(error);
        // Wait for next event
        await new Promise<void>((r) => { resolveWait = r; });
      }
      if (error) throw new Error(error);
    } finally {
      cleanups.forEach((fn) => fn());
    }
    return;
  }

  if (!ai.apiKey && ai.provider !== 'local-vllm') {
    throw new Error('AI API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.');
  }

  const response = await fetch(getEndpoint(ai), {
    method: 'POST',
    headers: getHeaders(ai),
    body: buildRequestBody(ai, systemPrompt, userPrompt, maxTokens, true),
  });

  if (!response.ok) throw new Error(`AI 호출 실패: ${response.status}`);

  const reader = response.body?.getReader();
  if (!reader) throw new Error('스트리밍 응답 읽기 실패');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') return;

      try {
        const parsed = JSON.parse(data);

        // Claude SSE format
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          yield parsed.delta.text;
        }
        // OpenAI SSE format
        if (parsed.choices?.[0]?.delta?.content) {
          yield parsed.choices[0].delta.content;
        }
      } catch { /* skip non-JSON lines */ }
    }
  }
}

/**
 * Streaming chat call for conversational AI panel.
 * Takes full message history and yields text chunks.
 */
export async function* callAIChatStream(
  ai: AIProvider,
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  maxTokens = 2048,
): AsyncGenerator<string, void, undefined> {
  // Claude Code provider — chat stream via Electron IPC
  if (ai.provider === 'claude-code') {
    const ipc = getClaudeCodeIPC();
    if (!ipc) throw new Error('Claude Code는 데스크톱 앱에서만 사용할 수 있습니다.');

    const requestId = `cc-chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const chunks: string[] = [];
    let done = false;
    let error: string | null = null;
    let resolveWait: (() => void) | null = null;

    const cleanups = [
      ipc.onStreamChunk(requestId, (text) => { chunks.push(text); resolveWait?.(); }),
      ipc.onStreamError(requestId, (err) => { error = err; resolveWait?.(); }),
      ipc.onStreamDone(requestId, () => { done = true; resolveWait?.(); }),
    ];

    ipc.chatStream({
      requestId,
      systemPrompt: NO_WEB_SEARCH + systemPrompt,
      messages,
      model: ai.model || undefined,
    }).catch((err) => { error = err.message; done = true; resolveWait?.(); });

    try {
      while (!done || chunks.length > 0) {
        if (chunks.length > 0) {
          yield chunks.shift()!;
          continue;
        }
        if (done) break;
        if (error) throw new Error(error);
        await new Promise<void>((r) => { resolveWait = r; });
      }
      if (error) throw new Error(error);
    } finally {
      cleanups.forEach((fn) => fn());
    }
    return;
  }

  if (!ai.apiKey && ai.provider !== 'local-vllm') {
    throw new Error('AI API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.');
  }

  const fullSystem = NO_WEB_SEARCH + systemPrompt;
  let body: string;
  if (isOpenAIFormat(ai)) {
    const obj: Record<string, unknown> = {
      model: ai.model ?? 'gpt-4o',
      max_tokens: maxTokens,
      stream: true,
      messages: [
        { role: 'system', content: fullSystem },
        ...messages,
      ],
    };
    if (ai.provider === 'local-vllm') obj.chat_template_kwargs = { enable_thinking: false };
    obj.tools = [];
    obj.tool_choice = 'none';
    obj.enable_search = false;
    obj.search_options = { forced_search: false };
    if (isGemini(ai)) {
      obj.toolConfig = { functionCallingConfig: { mode: 'NONE' } };
      obj.tool_config = { function_calling_config: { mode: 'NONE' } };
    }
    body = JSON.stringify(obj);
  } else {
    body = JSON.stringify({
      model: ai.model ?? 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      stream: true,
      system: fullSystem,
      messages,
    });
  }

  const response = await fetch(getEndpoint(ai), {
    method: 'POST',
    headers: getHeaders(ai),
    body,
  });

  if (!response.ok) throw new Error(`AI 호출 실패: ${response.status}`);

  const reader = response.body?.getReader();
  if (!reader) throw new Error('스트리밍 응답 읽기 실패');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') return;

      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          yield parsed.delta.text;
        }
        if (parsed.choices?.[0]?.delta?.content) {
          yield parsed.choices[0].delta.content;
        }
      } catch { /* skip */ }
    }
  }
}
