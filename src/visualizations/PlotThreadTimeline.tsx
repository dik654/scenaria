import { useState, useRef, useMemo } from 'react';
import { useSceneStore } from '../store/sceneStore';
import { useProjectStore } from '../store/projectStore';
import { useStoryStore } from '../store/storyStore';
import { useConfirm } from '../components/ConfirmDialog';
import { fileIO } from '../io';
import { nanoid } from 'nanoid';
import { Sparkles, Loader2, Cable } from 'lucide-react';
import type { PlotThread } from '../types/story';
import { useVisualizationAI } from './hooks/useVisualizationAI';
import {
  SYSTEM_THREAD_GENERATION,
  buildThreadGenPrompt,
  type ThreadGenResult,
} from '../ai/prompts/visualizationGen';

const THREAD_COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
];

const SCENE_DOT_WIDTH = 36;
const LANE_HEIGHT = 40;
const LABEL_WIDTH = 140;

export function PlotThreadTimeline({ onSceneSelect }: { onSceneSelect?: (sceneId: string) => void }) {
  const { index: scenes } = useSceneStore();
  const { projectRef } = useProjectStore();
  const { threadIndex, threads: threadMap, loadThread, addThreadToIndex, removeThreadFromIndex, updateThread, setThreadIndex } = useStoryStore();
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [dragging, setDragging] = useState<{ threadId: string; sceneId: string } | null>(null);
  const [hoveredScene, setHoveredScene] = useState<string | null>(null);
  const [editingThread, setEditingThread] = useState<string | null>(null);
  const [aiRequirements, setAiRequirements] = useState('');
  const [showRequirements, setShowRequirements] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { generate, generating, streamText, error, stop } = useVisualizationAI<ThreadGenResult>({
    systemPrompt: SYSTEM_THREAD_GENERATION,
    buildUserPrompt: buildThreadGenPrompt,
    maxTokens: 2048,
  });

  // Derive thread list from store
  const threads = useMemo(() =>
    threadIndex.map(t => threadMap[t.id]).filter(Boolean) as PlotThread[],
    [threadIndex, threadMap],
  );

  const persistAll = async (threadList: PlotThread[]) => {
    if (!projectRef) return;
    const legacyThreads = threadList.map(t => ({
      id: t.id, name: t.name, color: t.color,
      description: t.description, sceneIds: t.sceneIds ?? [],
    }));
    await fileIO.writeJSON(projectRef, 'story/plot_threads.json', { threads: legacyThreads }).catch(console.error);
  };

  const addThread = () => {
    if (!newName.trim()) return;
    const used = threads.map(t => t.color);
    const color = THREAD_COLORS.find(c => !used.includes(c)) ?? THREAD_COLORS[threads.length % THREAD_COLORS.length];
    const id = nanoid(8);
    const thread: PlotThread = { id, name: newName.trim(), color, description: '', characterIds: [], eventIds: [], sceneIds: [] };
    loadThread(id, thread);
    addThreadToIndex({ id, filename: `${id}.json`, name: newName.trim() });
    setNewName('');
    setAdding(false);
    setTimeout(() => {
      const all = useStoryStore.getState();
      const list = all.threadIndex.map(t => all.threads[t.id]).filter(Boolean) as PlotThread[];
      persistAll(list);
    }, 0);
  };

  const deleteThread = (id: string) => {
    removeThreadFromIndex(id);
    setTimeout(() => {
      const all = useStoryStore.getState();
      const list = all.threadIndex.map(t => all.threads[t.id]).filter(Boolean) as PlotThread[];
      persistAll(list);
    }, 0);
  };

  const toggleSceneInThread = (threadId: string, sceneId: string) => {
    const thread = threadMap[threadId];
    if (!thread) return;
    const sceneIds = thread.sceneIds ?? [];
    const has = sceneIds.includes(sceneId);
    const newSceneIds = has ? sceneIds.filter(s => s !== sceneId) : [...sceneIds, sceneId];
    updateThread(threadId, { sceneIds: newSceneIds });
    setTimeout(() => {
      const all = useStoryStore.getState();
      const list = all.threadIndex.map(t => all.threads[t.id]).filter(Boolean) as PlotThread[];
      persistAll(list);
    }, 0);
  };

  const handleDropOnThread = (threadId: string, sceneId: string) => {
    if (!dragging) return;
    if (dragging.threadId !== threadId) {
      const srcThread = threadMap[dragging.threadId];
      if (srcThread) {
        updateThread(dragging.threadId, { sceneIds: (srcThread.sceneIds ?? []).filter(s => s !== sceneId) });
      }
    }
    const dstThread = threadMap[threadId];
    if (dstThread && !(dstThread.sceneIds ?? []).includes(sceneId)) {
      updateThread(threadId, { sceneIds: [...(dstThread.sceneIds ?? []), sceneId] });
    }
    setDragging(null);
    setTimeout(() => {
      const all = useStoryStore.getState();
      const list = all.threadIndex.map(t => all.threads[t.id]).filter(Boolean) as PlotThread[];
      persistAll(list);
    }, 0);
  };

  const changeColor = (threadId: string, color: string) => {
    updateThread(threadId, { color });
    setTimeout(() => {
      const all = useStoryStore.getState();
      const list = all.threadIndex.map(t => all.threads[t.id]).filter(Boolean) as PlotThread[];
      persistAll(list);
    }, 0);
  };

  const handleAIGenerate = async (requirements?: string) => {
    if (threads.length > 0) {
      const ok = await confirm('기존 스레드를 AI 생성 결과로 대체합니다. 계속하시겠습니까?');
      if (!ok) return;
    }
    const result = await generate(requirements);
    if (!result?.threads?.length) return;

    // Remove existing threads
    for (const t of threadIndex) {
      removeThreadFromIndex(t.id);
    }

    // Add AI-generated threads
    const newThreadIdx: { id: string; filename: string; name: string }[] = [];
    const legacyThreads: { id: string; name: string; color: string; description: string; sceneIds: string[] }[] = [];

    for (let i = 0; i < result.threads.length; i++) {
      const t = result.threads[i];
      const id = nanoid(8);
      const color = t.color && THREAD_COLORS.includes(t.color) ? t.color : THREAD_COLORS[i % THREAD_COLORS.length];
      const thread: PlotThread = {
        id, name: t.name, color, description: t.description,
        characterIds: [], eventIds: [], sceneIds: [],
      };
      loadThread(id, thread);
      newThreadIdx.push({ id, filename: `${id}.json`, name: t.name });
      legacyThreads.push({ id, name: t.name, color, description: t.description, sceneIds: [] });
    }

    setThreadIndex(newThreadIdx);
    if (projectRef) {
      await fileIO.writeJSON(projectRef, 'story/plot_threads.json', { threads: legacyThreads }).catch(console.error);
    }
    setShowRequirements(false);
    setAiRequirements('');
  };

  const totalWidth = LABEL_WIDTH + scenes.length * SCENE_DOT_WIDTH + 32;

  // AI generating state
  if (generating) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 flex-shrink-0">
          <span className="text-xs font-medium text-gray-400">플롯 스레드 타임라인</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
          <span className="text-xs text-gray-500">AI가 플롯 스레드를 생성하고 있습니다...</span>
          {streamText && (
            <pre className="text-xs text-gray-400 whitespace-pre-wrap max-h-40 overflow-y-auto font-mono leading-relaxed w-full max-w-lg">
              {streamText.slice(-400)}
            </pre>
          )}
          <button onClick={stop} className="text-xs text-red-500 hover:text-red-400 border border-red-200 rounded px-3 py-1">중단</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 flex-shrink-0">
        <span className="text-xs font-medium text-gray-400">플롯 스레드 타임라인</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleAIGenerate()}
            className="text-xs text-violet-500 hover:text-violet-700 border border-violet-200 rounded px-2 py-0.5 transition-colors flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3" />
            AI 생성
          </button>
          <button
            onClick={() => setAdding(true)}
            className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded px-2 py-0.5 transition-colors"
          >
            + 스레드 추가
          </button>
        </div>
      </div>

      {/* Add thread form */}
      {adding && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addThread(); if (e.key === 'Escape') setAdding(false); }}
            placeholder="스레드 이름 (예: 주인공 내적 갈등)"
            className="flex-1 bg-gray-100 text-gray-800 text-xs px-3 py-1.5 rounded border border-gray-200 focus:outline-none focus:border-gray-400"
          />
          <button onClick={addThread} className="text-xs text-green-400 hover:text-green-300">추가</button>
          <button onClick={() => setAdding(false)} className="text-xs text-gray-500 hover:text-gray-400">취소</button>
        </div>
      )}

      {error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-100 text-xs text-red-500 flex-shrink-0">
          {error}
        </div>
      )}

      {/* Timeline */}
      <div className="flex-1 overflow-auto" ref={scrollRef}>
        {threads.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full px-8 gap-3">
            <Sparkles className="w-8 h-8 text-violet-300" />
            <p className="text-sm text-gray-500 text-center">AI가 프로젝트 정보를 바탕으로 플롯 스레드를 생성합니다</p>
            <p className="text-xs text-gray-400 text-center">캐릭터, 로그라인, 장르 등을 자동으로 참고합니다</p>
            {!showRequirements ? (
              <div className="flex flex-col gap-2 w-full max-w-sm mt-2">
                <button
                  onClick={() => handleAIGenerate()}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium bg-violet-500 hover:bg-violet-600 text-white rounded transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  AI로 자동 생성
                </button>
                <button
                  onClick={() => setShowRequirements(true)}
                  className="w-full py-2 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded transition-colors"
                >
                  요구사항 직접 입력
                </button>
                <button
                  onClick={() => setAdding(true)}
                  className="text-xs text-gray-400 hover:text-gray-600 underline mt-1"
                >
                  직접 스레드 추가하기
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 w-full max-w-sm mt-2">
                <textarea
                  value={aiRequirements}
                  onChange={e => setAiRequirements(e.target.value)}
                  placeholder="원하는 방향을 설명해주세요 (예: 주인공과 악당의 대립, 로맨스 서브플롯 포함)"
                  rows={3}
                  className="w-full bg-gray-50 text-gray-800 text-xs px-3 py-2 rounded border border-gray-200 focus:outline-none focus:border-violet-400 resize-none"
                />
                <div className="flex gap-2">
                  <button onClick={() => setShowRequirements(false)} className="flex-1 py-2 text-xs border border-gray-200 rounded text-gray-500 hover:bg-gray-50">취소</button>
                  <button
                    onClick={() => handleAIGenerate(aiRequirements)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium bg-violet-500 hover:bg-violet-600 text-white rounded"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    생성
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {threads.length > 0 && (
          <div style={{ minWidth: totalWidth }}>
            {/* Scene header row */}
            <div
              className="flex items-center sticky top-0 bg-white border-b border-gray-200 z-10"
              style={{ paddingLeft: LABEL_WIDTH }}
            >
              {scenes.map(scene => (
                <div
                  key={scene.id}
                  className={`flex-shrink-0 flex flex-col items-center justify-center py-1 cursor-pointer transition-colors ${
                    hoveredScene === scene.id ? 'bg-gray-100' : 'hover:bg-gray-50'
                  }`}
                  style={{ width: SCENE_DOT_WIDTH }}
                  onClick={() => onSceneSelect?.(scene.id)}
                  onMouseEnter={() => setHoveredScene(scene.id)}
                  onMouseLeave={() => setHoveredScene(null)}
                >
                  <span className="text-xs font-mono text-blue-500 font-bold leading-none">
                    {scene.number}
                  </span>
                  <span className="text-[9px] text-gray-600 truncate w-full text-center px-0.5 leading-none mt-0.5">
                    {scene.location.slice(0, 4)}
                  </span>
                </div>
              ))}
            </div>

            {/* Thread rows */}
            {threads.map(thread => (
              <div
                key={thread.id}
                className="flex items-center border-b border-gray-100 hover:bg-gray-50 transition-colors"
                style={{ height: LANE_HEIGHT }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  const sceneId = e.dataTransfer.getData('sceneId');
                  if (sceneId) handleDropOnThread(thread.id, sceneId);
                }}
              >
                {/* Thread label */}
                <div
                  className="flex items-center gap-2 flex-shrink-0 px-3 cursor-pointer group"
                  style={{ width: LABEL_WIDTH }}
                  onClick={() => setEditingThread(editingThread === thread.id ? null : thread.id)}
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: thread.color }} />
                  <span className="text-xs text-gray-600 truncate flex-1">{thread.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteThread(thread.id); }}
                    className="text-gray-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                  >
                    ×
                  </button>
                </div>

                {/* Scene cells */}
                {scenes.map(scene => {
                  const active = (thread.sceneIds ?? []).includes(scene.id);
                  const isHovered = hoveredScene === scene.id;

                  return (
                    <div
                      key={scene.id}
                      className={`flex-shrink-0 flex items-center justify-center cursor-pointer transition-all ${
                        isHovered ? 'bg-gray-50' : ''
                      }`}
                      style={{ width: SCENE_DOT_WIDTH, height: LANE_HEIGHT }}
                      draggable={active}
                      onDragStart={e => {
                        e.dataTransfer.setData('sceneId', scene.id);
                        setDragging({ threadId: thread.id, sceneId: scene.id });
                      }}
                      onMouseEnter={() => setHoveredScene(scene.id)}
                      onMouseLeave={() => setHoveredScene(null)}
                      onClick={() => toggleSceneInThread(thread.id, scene.id)}
                      title={active ? `장면 ${scene.number} 제거` : `장면 ${scene.number} 추가`}
                    >
                      {active ? (
                        <div
                          className="rounded-full shadow-lg transition-transform hover:scale-110"
                          style={{
                            width: 18,
                            height: 18,
                            backgroundColor: thread.color,
                            boxShadow: `0 0 8px ${thread.color}80`,
                          }}
                        />
                      ) : (
                        <div className="rounded-full border border-gray-200 opacity-30 hover:opacity-60 transition-opacity"
                          style={{ width: 12, height: 12 }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Vertical scene guides */}
            {hoveredScene && (
              <div
                className="pointer-events-none absolute top-0 bottom-0 border-l border-gray-300/40"
                style={{
                  left: LABEL_WIDTH + scenes.findIndex(s => s.id === hoveredScene) * SCENE_DOT_WIDTH + SCENE_DOT_WIDTH / 2,
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* Legend / Edit panel */}
      {editingThread && (() => {
        const thread = threadMap[editingThread];
        if (!thread) return null;
        return (
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 flex-shrink-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: thread.color }} />
              <span className="text-xs font-medium text-gray-800">{thread.name}</span>
              <span className="text-xs text-gray-500 ml-auto">{(thread.sceneIds ?? []).length}씬 활성</span>
            </div>
            {thread.description && (
              <p className="text-xs text-gray-500 mb-2">{thread.description}</p>
            )}
            <div className="flex gap-2 flex-wrap">
              {THREAD_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => changeColor(editingThread, c)}
                  className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${thread.color === c ? 'ring-2 ring-gray-800 ring-offset-1 ring-offset-white' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
