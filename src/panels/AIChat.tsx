import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useSceneStore } from '../store/sceneStore';
import { useCharacterStore } from '../store/characterStore';
import { useStoryStore } from '../store/storyStore';
import { callAIChatStream } from '../ai/aiClient';
import { useAIActivityStore } from '../store/aiActivityStore';
import { useAIChatStore } from '../store/aiChatStore';
import { buildContextMarkdown } from '../ai/contextBuilder';
import { SYSTEM_CHAT } from '../ai/prompts/chat';
import { fileIO } from '../io';
import type { Scene } from '../types/scene';
import { marked } from 'marked';

marked.setOptions({ breaks: true, gfm: true });

function MarkdownContent({ content }: { content: string }) {
  const html = useMemo(() => marked.parse(content) as string, [content]);
  return <div className="prose-chat" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function AIChat() {
  const { settings, projectRef, meta } = useProjectStore();
  const { currentScene, currentSceneId, index: sceneIndex } = useSceneStore();
  const { characters: loadedCharacters } = useCharacterStore();
  const { threadIndex, threads: threadMap, unresolvedForeshadowing } = useStoryStore();
  const aiActivity = useAIActivityStore();
  const { messages, setMessages, clearMessages } = useAIChatStore();
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const buildFullContext = useCallback(async (): Promise<string> => {
    if (!currentScene || !currentSceneId || !projectRef) return '';

    const prevScene = sceneIndex.findIndex(s => s.id === currentSceneId);
    let prevSceneData: Scene | null = null;
    let nextSceneData: Scene | null = null;

    if (prevScene > 0) {
      try {
        prevSceneData = await fileIO.readJSON<Scene>(projectRef, `screenplay/${sceneIndex[prevScene - 1].filename}`);
      } catch { /* skip */ }
    }
    if (prevScene < sceneIndex.length - 1) {
      try {
        nextSceneData = await fileIO.readJSON<Scene>(projectRef, `screenplay/${sceneIndex[prevScene + 1].filename}`);
      } catch { /* skip */ }
    }

    // 활성 플롯 스레드
    const plotThreads = threadIndex.map(t => {
      const full = threadMap[t.id];
      return { name: t.name, description: full?.description ?? '' };
    }).filter(t => t.description);

    // 미해결 복선
    const unresolvedFs = unresolvedForeshadowing();

    return buildContextMarkdown({
      project: {
        title: meta?.title ?? '',
        logline: meta?.logline ?? '',
        genre: meta?.genre ?? [],
      },
      currentScene,
      prevScene: prevSceneData ?? undefined,
      nextScene: nextSceneData ?? undefined,
      characters: Object.values(loadedCharacters),
      plotThreads: plotThreads.length > 0 ? plotThreads : undefined,
      foreshadowing: unresolvedFs.length > 0 ? unresolvedFs : undefined,
      totalTokens: 0,
    });
  }, [currentScene, currentSceneId, sceneIndex, projectRef, loadedCharacters, meta, threadIndex, threadMap, unresolvedForeshadowing]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    const userMsg = input.trim();
    setInput('');
    setError(null);
    abortRef.current = false;

    const newMessages = [...messages, { role: 'user' as const, content: userMsg }];
    setMessages([...newMessages, { role: 'assistant', content: '' }]);
    setIsStreaming(true);
    aiActivity.start();

    try {
      const context = await buildFullContext();
      const systemWithContext = context
        ? `${SYSTEM_CHAT}\n\n## 현재 시나리오 컨텍스트\n${context}`
        : SYSTEM_CHAT;

      let accumulated = '';
      for await (const chunk of callAIChatStream(settings.ai, systemWithContext, newMessages)) {
        if (abortRef.current) break;
        accumulated += chunk;
        setMessages([...newMessages, { role: 'assistant', content: accumulated }]);
      }

      setMessages([...newMessages, { role: 'assistant', content: accumulated }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 호출 실패');
      setMessages(newMessages);
    } finally {
      setIsStreaming(false);
      aiActivity.stop();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStop = () => {
    abortRef.current = true;
  };

  const handleClear = () => {
    clearMessages();
    setError(null);
  };

  const hasApiKey = !!settings.ai.apiKey || settings.ai.provider === 'local-vllm' || settings.ai.provider === 'claude-code';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-gray-400 flex-1">
          {currentScene ? `장면 ${currentScene.id.replace('s', '').replace(/^0+/, '')} 컨텍스트` : '컨텍스트 없음'}
        </span>
        {messages.length > 0 && (
          <button onClick={handleClear} className="text-xs text-gray-400 hover:text-gray-600">초기화</button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8 space-y-2">
            <p className="text-gray-600 text-sm">시나리오에 대해 물어보세요</p>
            <div className="space-y-1">
              {[
                '이 씬의 몰입도를 높이려면?',
                '캐릭터 아크가 자연스러운가요?',
                '3막 전환이 약한데 개선 방법은?',
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); textareaRef.current?.focus(); }}
                  className="block w-full text-left text-xs text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg px-3 py-2 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-50 text-gray-700 whitespace-pre-wrap'
                  : 'bg-gray-50 text-gray-700'
              }`}
            >
              {msg.content ? (
                msg.role === 'assistant' ? <MarkdownContent content={msg.content} /> : msg.content
              ) : (isStreaming && i === messages.length - 1 ? (
                <span className="flex items-center gap-1.5 text-gray-400 text-xs">
                  <span className="flex gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                  생성 중...
                </span>
              ) : null)}
            </div>
          </div>
        ))}

        {error && (
          <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 p-3">
        {!hasApiKey ? (
          <p className="text-xs text-gray-400 text-center">설정에서 AI API 키를 입력해주세요</p>
        ) : (
          <div className="flex gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="메시지 입력... (Shift+Enter: 줄바꿈)"
              rows={1}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 resize-none focus:outline-none focus:border-blue-300 placeholder-gray-400"
              style={{ minHeight: '2.5rem', maxHeight: '6rem' }}
            />
            {isStreaming ? (
              <button onClick={handleStop} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs text-gray-600 flex-shrink-0">
                중지
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="px-3 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-xs text-white flex-shrink-0 disabled:opacity-50"
              >
                전송
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
