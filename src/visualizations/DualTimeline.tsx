import { useState, useEffect, useCallback } from 'react';
import { useSceneStore } from '../store/sceneStore';
import { useProjectStore } from '../store/projectStore';
import { fileIO } from '../io';

interface StoryTimeEntry {
  sceneId: string;
  storyOrder: number; // User-assigned chronological order
}

interface StoryTimeStore {
  entries: StoryTimeEntry[];
}

const TIME_COLORS: Record<string, string> = {
  DAY: '#F59E0B',
  NIGHT: '#3B82F6',
  DAWN: '#EC4899',
  DUSK: '#F97316',
  CONTINUOUS: '#6B7280',
};

const TIME_LABELS: Record<string, string> = {
  DAY: '낮', NIGHT: '밤', DAWN: '새벽', DUSK: '황혼', CONTINUOUS: '연속',
};

export function DualTimeline({ onSceneClick }: { onSceneClick?: (id: string) => void }) {
  const { index: scenes } = useSceneStore();
  const { dirHandle } = useProjectStore();
  const [storyOrders, setStoryOrders] = useState<Record<string, number>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!dirHandle) return;
    try {
      const data = await fileIO.readJSON<StoryTimeStore>(dirHandle, 'story/timeline_order.json');
      const map: Record<string, number> = {};
      for (const e of data?.entries ?? []) map[e.sceneId] = e.storyOrder;
      setStoryOrders(map);
    } catch {
      setStoryOrders({});
    }
  }, [dirHandle]);

  const saveOrders = useCallback(async (orders: Record<string, number>) => {
    if (!dirHandle) return;
    const entries: StoryTimeEntry[] = Object.entries(orders).map(([sceneId, storyOrder]) => ({ sceneId, storyOrder }));
    try { await fileIO.writeJSON(dirHandle, 'story/timeline_order.json', { entries }); } catch { /* ignore */ }
  }, [dirHandle]);

  useEffect(() => { load(); }, [load]);

  // Narrative order (top row): scenes in index order (S#1, S#2...)
  const narrativeScenes = [...scenes].sort((a, b) => a.number - b.number);

  // Story time order (bottom row): scenes sorted by user-assigned storyOrder, then narrative order as fallback
  const storyTimeScenes = [...scenes].sort((a, b) => {
    const ao = storyOrders[a.id] ?? a.number;
    const bo = storyOrders[b.id] ?? b.number;
    return ao - bo;
  });

  const handleDragStart = (sceneId: string) => setDraggingId(sceneId);
  const handleDragEnd = () => {
    if (draggingId !== null && dragTarget !== null) {
      const newOrder = { ...storyOrders };
      newOrder[draggingId] = dragTarget;
      setStoryOrders(newOrder);
      saveOrders(newOrder);
    }
    setDraggingId(null);
    setDragTarget(null);
  };

  const resetOrder = () => {
    setStoryOrders({});
    saveOrders({});
  };

  if (scenes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-sm">
        씬을 추가하면 이중 타임라인이 표시됩니다
      </div>
    );
  }

  const CELL_W = Math.max(28, Math.min(52, Math.floor(700 / scenes.length)));
  const hasCustomOrder = Object.keys(storyOrders).length > 0;

  // Map sceneId → narrative position index
  const narrativePos = new Map(narrativeScenes.map((s, i) => [s.id, i]));
  // Map sceneId → story time position index
  const storyPos = new Map(storyTimeScenes.map((s, i) => [s.id, i]));

  return (
    <div className="flex flex-col h-full p-4 overflow-auto">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h3 className="text-sm font-medium text-gray-300">이중 타임라인</h3>
          <p className="text-xs text-gray-600 mt-0.5">
            위: 서사 순서 (화면에 보이는 순서) · 아래: 이야기 내 실제 시간 순서
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasCustomOrder && (
            <button onClick={resetOrder} className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 rounded">
              순서 초기화
            </button>
          )}
          <div className="flex gap-3 text-xs text-gray-600">
            {Object.entries(TIME_LABELS).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: TIME_COLORS[k] }} />
                {v}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ minWidth: scenes.length * CELL_W + 80 }}>
        {/* Narrative order row */}
        <div className="mb-1">
          <span className="text-xs text-gray-500 w-16 inline-block flex-shrink-0">서사 순서</span>
        </div>
        <div className="flex items-end gap-0.5 mb-1" style={{ paddingLeft: 64 }}>
          {narrativeScenes.map(s => (
            <div
              key={s.id}
              title={`S#${s.number}. ${s.location} (${TIME_LABELS[s.timeOfDay] ?? s.timeOfDay})`}
              className="flex-shrink-0 rounded-sm cursor-pointer hover:opacity-80 transition-opacity relative group"
              style={{
                width: CELL_W - 2,
                height: 32,
                backgroundColor: TIME_COLORS[s.timeOfDay] ?? '#6B7280',
                opacity: 0.8,
              }}
              onClick={() => onSceneClick?.(s.id)}
            >
              <span className="absolute inset-0 flex items-center justify-center text-xs font-mono text-white/80 font-medium" style={{ fontSize: 9 }}>
                {s.number}
              </span>
            </div>
          ))}
        </div>

        {/* Connection lines SVG */}
        {hasCustomOrder && (
          <svg
            width={scenes.length * CELL_W + 10}
            height={28}
            style={{ marginLeft: 64, display: 'block' }}
          >
            {scenes.map(s => {
              const ni = narrativePos.get(s.id) ?? 0;
              const si = storyPos.get(s.id) ?? 0;
              if (ni === si) return null;
              const x1 = ni * CELL_W + CELL_W / 2;
              const x2 = si * CELL_W + CELL_W / 2;
              return (
                <line
                  key={s.id}
                  x1={x1} y1={0}
                  x2={x2} y2={28}
                  stroke={TIME_COLORS[s.timeOfDay] ?? '#555'}
                  strokeOpacity={0.4}
                  strokeWidth={1}
                />
              );
            })}
          </svg>
        )}

        {/* Story time row */}
        <div className="mb-1 mt-1">
          <span className="text-xs text-gray-500 w-16 inline-block flex-shrink-0">이야기 시간</span>
        </div>
        <div className="flex items-end gap-0.5" style={{ paddingLeft: 64 }}>
          {storyTimeScenes.map((s, storyIdx) => (
            <div
              key={s.id}
              draggable
              onDragStart={() => handleDragStart(s.id)}
              onDragOver={e => { e.preventDefault(); setDragTarget(storyIdx); }}
              onDrop={handleDragEnd}
              onDragEnd={handleDragEnd}
              title={`S#${s.number}. ${s.location} — 드래그로 순서 변경`}
              className="flex-shrink-0 rounded-sm cursor-grab hover:opacity-80 transition-opacity relative"
              style={{
                width: CELL_W - 2,
                height: 32,
                backgroundColor: TIME_COLORS[s.timeOfDay] ?? '#6B7280',
                opacity: draggingId === s.id ? 0.4 : (storyOrders[s.id] !== undefined ? 1 : 0.5),
                border: dragTarget === storyIdx && draggingId !== s.id ? '2px solid white' : '2px solid transparent',
              }}
              onClick={() => onSceneClick?.(s.id)}
            >
              <span className="absolute inset-0 flex items-center justify-center text-xs font-mono text-white/80 font-medium" style={{ fontSize: 9 }}>
                {s.number}
              </span>
            </div>
          ))}
        </div>

        {!hasCustomOrder && (
          <p className="text-xs text-gray-600 mt-3 ml-16">
            아래 줄의 씬을 드래그해 이야기 내 실제 시간 순서를 지정하세요
          </p>
        )}
      </div>
    </div>
  );
}
