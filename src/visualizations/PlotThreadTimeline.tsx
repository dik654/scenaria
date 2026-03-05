import { useState, useEffect, useRef, useCallback } from 'react';
import { useSceneStore } from '../store/sceneStore';
import { useProjectStore } from '../store/projectStore';
import { fileIO } from '../io';
import { nanoid } from 'nanoid';

interface PlotThread {
  id: string;
  name: string;
  color: string;
  description: string;
  sceneIds: string[];
}

interface ThreadStore {
  threads: PlotThread[];
}

const THREAD_COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
];

const SCENE_DOT_WIDTH = 36;
const LANE_HEIGHT = 40;
const LABEL_WIDTH = 140;

export function PlotThreadTimeline({ onSceneSelect }: { onSceneSelect?: (sceneId: string) => void }) {
  const { index: scenes } = useSceneStore();
  const { dirHandle } = useProjectStore();
  const [threads, setThreads] = useState<PlotThread[]>([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [dragging, setDragging] = useState<{ threadId: string; sceneId: string } | null>(null);
  const [hoveredScene, setHoveredScene] = useState<string | null>(null);
  const [editingThread, setEditingThread] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!dirHandle) return;
    try {
      const data = await fileIO.readJSON<ThreadStore>(dirHandle, 'story/plot_threads.json');
      setThreads(data.threads ?? []);
    } catch {
      setThreads([]);
    }
  }, [dirHandle]);

  useEffect(() => { load(); }, [load]);

  const save = async (next: PlotThread[]) => {
    setThreads(next);
    if (!dirHandle) return;
    try {
      await fileIO.writeJSON(dirHandle, 'story/plot_threads.json', { threads: next });
    } catch (e) {
      console.error('플롯 스레드 저장 실패:', e);
    }
  };

  const addThread = () => {
    if (!newName.trim()) return;
    const used = threads.map(t => t.color);
    const color = THREAD_COLORS.find(c => !used.includes(c)) ?? THREAD_COLORS[threads.length % THREAD_COLORS.length];
    const next = [...threads, { id: nanoid(8), name: newName.trim(), color, description: '', sceneIds: [] }];
    save(next);
    setNewName('');
    setAdding(false);
  };

  const deleteThread = (id: string) => {
    save(threads.filter(t => t.id !== id));
  };

  const toggleSceneInThread = (threadId: string, sceneId: string) => {
    const next = threads.map(t => {
      if (t.id !== threadId) return t;
      const has = t.sceneIds.includes(sceneId);
      return { ...t, sceneIds: has ? t.sceneIds.filter(id => id !== sceneId) : [...t.sceneIds, sceneId] };
    });
    save(next);
  };

  const handleDropOnThread = (threadId: string, sceneId: string) => {
    if (!dragging) return;
    // Remove from source thread if different
    const next = threads.map(t => {
      if (t.id === dragging.threadId && t.id !== threadId) {
        return { ...t, sceneIds: t.sceneIds.filter(id => id !== sceneId) };
      }
      if (t.id === threadId) {
        if (!t.sceneIds.includes(sceneId)) return { ...t, sceneIds: [...t.sceneIds, sceneId] };
      }
      return t;
    });
    save(next);
    setDragging(null);
  };

  const totalWidth = LABEL_WIDTH + scenes.length * SCENE_DOT_WIDTH + 32;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 flex-shrink-0">
        <span className="text-xs font-medium text-gray-400">플롯 스레드 타임라인</span>
        <button
          onClick={() => setAdding(true)}
          className="text-xs text-gray-500 hover:text-gray-300 border border-gray-700 rounded px-2 py-0.5 transition-colors"
        >
          + 스레드 추가
        </button>
      </div>

      {/* Add thread form */}
      {adding && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800 bg-gray-900/50 flex-shrink-0">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addThread(); if (e.key === 'Escape') setAdding(false); }}
            placeholder="스레드 이름 (예: 주인공 내적 갈등)"
            className="flex-1 bg-gray-800 text-white text-xs px-3 py-1.5 rounded border border-gray-700 focus:outline-none focus:border-gray-500"
          />
          <button onClick={addThread} className="text-xs text-green-400 hover:text-green-300">추가</button>
          <button onClick={() => setAdding(false)} className="text-xs text-gray-500 hover:text-gray-400">취소</button>
        </div>
      )}

      {/* Timeline */}
      <div className="flex-1 overflow-auto" ref={scrollRef}>
        {threads.length === 0 && scenes.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-600 text-sm gap-2">
            <span className="text-3xl">🧵</span>
            <p>씬과 플롯 스레드를 추가하세요</p>
          </div>
        )}

        {threads.length === 0 && scenes.length > 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-600 text-sm gap-2">
            <span className="text-3xl">🧵</span>
            <p>플롯 스레드를 추가하면 씬을 타임라인에 배치할 수 있습니다</p>
            <button onClick={() => setAdding(true)} className="text-xs text-blue-400 hover:text-blue-300 underline">
              스레드 추가하기
            </button>
          </div>
        )}

        {threads.length > 0 && (
          <div style={{ minWidth: totalWidth }}>
            {/* Scene header row */}
            <div
              className="flex items-center sticky top-0 bg-gray-950 border-b border-gray-800 z-10"
              style={{ paddingLeft: LABEL_WIDTH }}
            >
              {scenes.map(scene => (
                <div
                  key={scene.id}
                  className={`flex-shrink-0 flex flex-col items-center justify-center py-1 cursor-pointer transition-colors ${
                    hoveredScene === scene.id ? 'bg-gray-800/50' : 'hover:bg-gray-900/50'
                  }`}
                  style={{ width: SCENE_DOT_WIDTH }}
                  onClick={() => onSceneSelect?.(scene.id)}
                  onMouseEnter={() => setHoveredScene(scene.id)}
                  onMouseLeave={() => setHoveredScene(null)}
                >
                  <span className="text-xs font-mono text-red-400 font-bold leading-none">
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
                className="flex items-center border-b border-gray-900 hover:bg-gray-900/20 transition-colors"
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
                  <span className="text-xs text-gray-300 truncate flex-1">{thread.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteThread(thread.id); }}
                    className="text-gray-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                  >
                    ×
                  </button>
                </div>

                {/* Scene cells */}
                {scenes.map(scene => {
                  const active = thread.sceneIds.includes(scene.id);
                  const isHovered = hoveredScene === scene.id;

                  return (
                    <div
                      key={scene.id}
                      className={`flex-shrink-0 flex items-center justify-center cursor-pointer transition-all ${
                        isHovered ? 'bg-gray-800/30' : ''
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
                      title={active ? `S#${scene.number} 제거` : `S#${scene.number} 추가`}
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
                        <div className="rounded-full border border-gray-800 opacity-30 hover:opacity-60 transition-opacity"
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
                className="pointer-events-none absolute top-0 bottom-0 border-l border-gray-600/40"
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
        const thread = threads.find(t => t.id === editingThread);
        if (!thread) return null;
        return (
          <div className="border-t border-gray-800 bg-gray-900/50 px-4 py-3 flex-shrink-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: thread.color }} />
              <span className="text-xs font-medium text-white">{thread.name}</span>
              <span className="text-xs text-gray-500 ml-auto">{thread.sceneIds.length}씬 활성</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {THREAD_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => {
                    const next = threads.map(t => t.id === editingThread ? { ...t, color: c } : t);
                    save(next);
                  }}
                  className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${thread.color === c ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-900' : ''}`}
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
