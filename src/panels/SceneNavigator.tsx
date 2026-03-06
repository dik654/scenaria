import { useMemo, useState } from 'react';
import { useSceneStore } from '../store/sceneStore';
import type { SceneStatus } from '../types/scene';
import { STATUS_BG_BUTTON } from '../utils/statusMapping';
import { SceneCard } from './sceneNavigator/SceneCard';
import { useSceneOps } from './sceneNavigator/useSceneOps';

export function SceneNavigator() {
  const { index } = useSceneStore();
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<SceneStatus | 'all'>('all');

  const {
    isAdding,
    dragIndex,
    dragOverIndex,
    setDragIndex,
    setDragOverIndex,
    handleSelectScene,
    handleAddScene,
    handleDeleteScene,
    handleDuplicateScene,
    handleMergeScene,
    handleDragEnd,
    currentSceneId,
  } = useSceneOps();

  const filtered = useMemo(() => index.filter(e => {
    const matchText = !filter.trim() || e.location.includes(filter) || e.summary?.includes(filter) || String(e.number).includes(filter);
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchText && matchStatus;
  }), [index, filter, statusFilter]);

  const indexPositionMap = useMemo(
    () => new Map(index.map((e, i) => [e.id, i])),
    [index]
  );

  const statusCounts = useMemo(() => {
    const counts = { outline: 0, draft: 0, revision: 0, done: 0, none: 0 };
    index.forEach(s => { if (s.status) counts[s.status]++; else counts.none++; });
    return counts;
  }, [index]);

  const total = index.length;

  return (
    <div className="w-52 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">씬 목록</span>
        <button
          onClick={handleAddScene}
          disabled={isAdding}
          title="새 씬 추가 (Ctrl+Shift+S)"
          className="text-gray-500 hover:text-red-400 transition-colors text-lg leading-none disabled:opacity-50"
        >
          +
        </button>
      </div>

      {total > 0 && (
        <div className="px-2 pt-1.5">
          <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-800" title={`완료 ${statusCounts.done} · 수정 ${statusCounts.revision} · 초고 ${statusCounts.draft} · 아웃라인 ${statusCounts.outline}`}>
            {statusCounts.done > 0    && <div style={{ width: `${statusCounts.done    / total * 100}%` }} className="bg-green-500" />}
            {statusCounts.revision > 0 && <div style={{ width: `${statusCounts.revision / total * 100}%` }} className="bg-yellow-500" />}
            {statusCounts.draft > 0   && <div style={{ width: `${statusCounts.draft   / total * 100}%` }} className="bg-blue-500" />}
            {statusCounts.outline > 0 && <div style={{ width: `${statusCounts.outline / total * 100}%` }} className="bg-gray-500" />}
          </div>
          <p className="text-xs text-gray-700 mt-0.5">완료 {statusCounts.done}/{total}</p>
        </div>
      )}

      <div className="px-2 pb-1 flex flex-wrap gap-1">
        {([
          { id: 'all',      label: `전체 ${total}`,                   active: 'bg-gray-600 text-white' },
          { id: 'outline',  label: `아웃 ${statusCounts.outline}`,    active: `${STATUS_BG_BUTTON.outline} text-white` },
          { id: 'draft',    label: `초고 ${statusCounts.draft}`,      active: `${STATUS_BG_BUTTON.draft} text-white` },
          { id: 'revision', label: `수정 ${statusCounts.revision}`,   active: `${STATUS_BG_BUTTON.revision} text-white` },
          { id: 'done',     label: `완료 ${statusCounts.done}`,       active: `${STATUS_BG_BUTTON.done} text-white` },
        ] as const).map(chip => (
          <button
            key={chip.id}
            onClick={() => setStatusFilter(chip.id as SceneStatus | 'all')}
            className={`text-xs px-1.5 py-0.5 rounded-full transition-colors ${
              statusFilter === chip.id ? chip.active : 'text-gray-600 hover:text-gray-400'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="px-2 py-1.5 border-b border-gray-800">
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="위치/요약 검색..."
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {index.length === 0 ? (
          <div className="text-center py-8 px-3">
            <p className="text-xs text-gray-600">씬이 없습니다</p>
            <button onClick={handleAddScene} className="mt-2 text-xs text-red-500 hover:text-red-400">
              첫 씬 추가
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-6 px-3">
            <p className="text-xs text-gray-600">"{filter}" 결과 없음</p>
            <button onClick={() => setFilter('')} className="mt-1 text-xs text-gray-600 hover:text-gray-400">초기화</button>
          </div>
        ) : (
          filtered.map((entry) => {
            const i = indexPositionMap.get(entry.id) ?? 0;
            return (
              <div
                key={entry.id}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => { e.preventDefault(); setDragOverIndex(i); }}
                onDragEnd={handleDragEnd}
                className={`transition-all ${dragOverIndex === i && dragIndex !== i ? 'border-t-2 border-red-500' : ''}`}
              >
                <SceneCard
                  entry={entry}
                  isActive={entry.id === currentSceneId}
                  isLast={i === index.length - 1}
                  onSelect={() => handleSelectScene(entry)}
                  onDelete={() => handleDeleteScene(entry)}
                  onDuplicate={() => handleDuplicateScene(entry)}
                  onMergeNext={() => handleMergeScene(entry)}
                />
              </div>
            );
          })
        )}
      </div>

      <div className="px-3 py-2 border-t border-gray-800 text-xs text-gray-600">
        {filter ? `${filtered.length}/${index.length}씬` : `총 ${index.length}씬`}
      </div>
    </div>
  );
}
