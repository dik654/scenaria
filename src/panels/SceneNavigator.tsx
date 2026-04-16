import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useSceneStore } from '../store/sceneStore';
import type { SceneStatus } from '../types/scene';
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

  const STATUS_COLORS: Record<string, { active: string; dot: string }> = {
    all:      { active: 'bg-zinc-100 text-zinc-700', dot: '' },
    outline:  { active: 'bg-zinc-100 text-zinc-600', dot: 'bg-zinc-400' },
    draft:    { active: 'bg-blue-50 text-blue-600', dot: 'bg-blue-400' },
    revision: { active: 'bg-amber-50 text-amber-600', dot: 'bg-amber-400' },
    done:     { active: 'bg-emerald-50 text-emerald-600', dot: 'bg-emerald-400' },
  };

  return (
    <div className="w-56 flex-shrink-0 bg-white border-r border-zinc-200/80 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="text-[13px] font-semibold text-zinc-700 tracking-tight">씬 목록</span>
        <button
          onClick={handleAddScene}
          disabled={isAdding}
          title="새 씬 추가 (Ctrl+Shift+S)"
          className="w-6 h-6 flex items-center justify-center rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-40"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75"><line x1="7" y1="2" x2="7" y2="12"/><line x1="2" y1="7" x2="12" y2="7"/></svg>
        </button>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="px-3 pb-2">
          <div className="flex h-1 rounded-full overflow-hidden bg-zinc-100" title={`완료 ${statusCounts.done} · 수정 ${statusCounts.revision} · 초고 ${statusCounts.draft} · 아웃라인 ${statusCounts.outline}`}>
            {statusCounts.done > 0    && <div style={{ width: `${statusCounts.done    / total * 100}%` }} className="bg-emerald-400" />}
            {statusCounts.revision > 0 && <div style={{ width: `${statusCounts.revision / total * 100}%` }} className="bg-amber-400" />}
            {statusCounts.draft > 0   && <div style={{ width: `${statusCounts.draft   / total * 100}%` }} className="bg-blue-400" />}
            {statusCounts.outline > 0 && <div style={{ width: `${statusCounts.outline / total * 100}%` }} className="bg-zinc-300" />}
          </div>
        </div>
      )}

      {/* Status filter chips */}
      <div className="px-2 pb-2 flex flex-wrap gap-1">
        {([
          { id: 'all',      label: `전체 ${total}` },
          { id: 'outline',  label: `아웃 ${statusCounts.outline}` },
          { id: 'draft',    label: `초고 ${statusCounts.draft}` },
          { id: 'revision', label: `수정 ${statusCounts.revision}` },
          { id: 'done',     label: `완료 ${statusCounts.done}` },
        ] as const).map(chip => {
          const colors = STATUS_COLORS[chip.id];
          return (
            <button
              key={chip.id}
              onClick={() => setStatusFilter(chip.id as SceneStatus | 'all')}
              className={`text-[11px] px-2 py-0.5 rounded-full transition-colors ${
                statusFilter === chip.id ? colors.active + ' font-medium' : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="px-2 pb-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-300" strokeWidth={1.5} />
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="검색..."
            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg pl-7 pr-2 py-1.5 text-xs text-zinc-700 placeholder-zinc-400 focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100 transition-colors"
          />
        </div>
      </div>

      {/* Scene list */}
      <div className="flex-1 overflow-y-auto px-1.5">
        {index.length === 0 ? (
          <div className="text-center py-10 px-3">
            <p className="text-sm text-zinc-400">씬이 없습니다</p>
            <button onClick={handleAddScene} className="mt-3 text-xs text-blue-600 hover:text-blue-700 font-medium">
              + 첫 씬 추가
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 px-3">
            <p className="text-xs text-zinc-400">"{filter}" 결과 없음</p>
            <button onClick={() => setFilter('')} className="mt-1 text-xs text-blue-600 hover:text-blue-700">초기화</button>
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
                className={`transition-all ${dragOverIndex === i && dragIndex !== i ? 'border-t-2 border-blue-400' : ''}`}
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

      {/* Footer */}
      <div className="px-3 py-2 border-t border-zinc-200/80 text-[11px] text-zinc-400">
        {filter ? `${filtered.length}/${index.length}씬` : `총 ${index.length}씬`}
      </div>
    </div>
  );
}
