import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSceneStore } from '../store/sceneStore';
import { useProjectStore } from '../store/projectStore';
import { fileIO } from '../io';
import type { Scene, SceneIndexEntry, SceneStatus, TimeOfDay, Interior } from '../types/scene';
import { STATUS_LABELS, STATUS_BG_ACTIVE, STATUS_BG_BUTTON } from '../utils/statusMapping';
import { nanoid } from 'nanoid';
import { nextSceneId, renumberScenes } from '../utils/sceneNumbering';
import { sceneFilename } from '../utils/fileNaming';

const TIME_COLOR: Record<TimeOfDay, string> = {
  DAY: 'text-yellow-400',
  NIGHT: 'text-blue-400',
  DAWN: 'text-orange-300',
  DUSK: 'text-orange-400',
  CONTINUOUS: 'text-gray-400',
};

const TIME_ICON: Record<TimeOfDay, string> = {
  DAY: '☀️',
  NIGHT: '🌙',
  DAWN: '🌅',
  DUSK: '🌆',
  CONTINUOUS: '→',
};

interface SceneCardProps {
  entry: SceneIndexEntry;
  isActive: boolean;
  isLast: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMergeNext: () => void;
}

function SceneCard({ entry, isActive, isLast, onSelect, onDelete, onDuplicate, onMergeNext }: SceneCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      className={`relative group cursor-pointer border-l-2 transition-all ${
        isActive
          ? 'border-red-500 bg-gray-800'
          : 'border-transparent hover:border-gray-600 hover:bg-gray-900/50'
      }`}
      onClick={onSelect}
      onContextMenu={(e) => { e.preventDefault(); setShowMenu(true); }}
    >
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-mono text-red-400 font-bold">
            S#{entry.number}
          </span>
          <span className="text-xs">{TIME_ICON[entry.timeOfDay]}</span>
          {entry.interior && (
            <span className="text-xs text-gray-500 font-mono">{entry.interior}</span>
          )}
          {/* Status indicators */}
          <div className="flex gap-1 ml-auto items-center">
            {entry.status && (
              <span
                title={`작성 상태: ${STATUS_LABELS[entry.status]}`}
                className={`w-2 h-2 rounded-full ${STATUS_BG_ACTIVE[entry.status]}`}
              />
            )}
            {entry.hasConsistencyIssue && <span title="정합성 이슈" className="text-xs">🔴</span>}
            {entry.hasUnresolvedForeshadowing && <span title="미회수 떡밥" className="text-xs">🟡</span>}
            {entry.characterCount != null && entry.characterCount > 0 && (
              <span className="text-xs text-gray-600 font-mono">👤{entry.characterCount}</span>
            )}
          </div>
        </div>
        <p className="text-xs text-white font-medium truncate">{entry.location}</p>
        {entry.summary && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-tight">{entry.summary}</p>
        )}
      </div>

      {/* Context menu */}
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute left-full top-0 ml-1 z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-32">
            <button
              onClick={(e) => { e.stopPropagation(); onDuplicate(); setShowMenu(false); }}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
            >
              복제
            </button>
            {!isLast && (
              <button
                onClick={(e) => { e.stopPropagation(); onMergeNext(); setShowMenu(false); }}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
              >
                다음 씬과 합치기
              </button>
            )}
            <div className="border-t border-gray-700 my-0.5" />
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); setShowMenu(false); }}
              className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-gray-700"
            >
              삭제
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function createDefaultScene(id: string, number: number): Scene {
  return {
    id,
    version: 1,
    header: {
      interior: 'INT',
      location: '장소',
      timeOfDay: 'DAY',
    },
    meta: {
      summary: '',
      emotionalTone: [],
      tensionLevel: 5,
      estimatedMinutes: 1,
      tags: [],
    },
    blocks: [
      { type: 'action', text: '' },
    ],
    characters: [],
  };
}

export function SceneNavigator() {
  const { index, currentSceneId, setCurrentScene, setIndex, addSceneToIndex, removeSceneFromIndex, reorderScenes } = useSceneStore();
  const { dirHandle, autoSave } = useProjectStore();
  const [isAdding, setIsAdding] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<SceneStatus | 'all'>('all');

  const handleSelectScene = useCallback(async (entry: SceneIndexEntry) => {
    if (!dirHandle) return;
    try {
      // Trigger autoSave on scene change (save point if dirty)
      const prevId = useSceneStore.getState().currentSceneId;
      if (prevId && prevId !== entry.id) {
        autoSave?.onSceneChange(prevId);
      }
      const scene = await fileIO.readJSON<Scene>(dirHandle, `screenplay/${entry.filename}`);
      setCurrentScene(entry.id, scene);
    } catch (err) {
      console.error('씬 로드 실패:', err);
    }
  }, [dirHandle, setCurrentScene, autoSave]);

  // Listen for gotoScene events (from Ctrl+G or FindReplace navigation)
  useEffect(() => {
    const handler = (e: Event) => {
      const sceneId = (e as CustomEvent<string>).detail;
      const entry = useSceneStore.getState().index.find(s => s.id === sceneId);
      if (entry) handleSelectScene(entry);
    };
    window.addEventListener('scenaria:gotoScene', handler);
    return () => window.removeEventListener('scenaria:gotoScene', handler);
  }, [handleSelectScene]);

  const handleAddScene = useCallback(async () => {
    if (!dirHandle || isAdding) return;
    setIsAdding(true);
    try {
      const id = nextSceneId(index);
      const number = index.length + 1;
      const scene = createDefaultScene(id, number);
      const filename = sceneFilename(id, scene.header.location);

      await fileIO.writeJSON(dirHandle, `screenplay/${filename}`, scene);

      const entry: SceneIndexEntry = {
        id,
        filename,
        number,
        location: scene.header.location,
        timeOfDay: scene.header.timeOfDay,
        interior: scene.header.interior,
        summary: '',
        characterCount: 0,
      };

      const newIndex = [...index, entry];
      await fileIO.writeJSON(dirHandle, 'screenplay/_index.json', { scenes: newIndex });

      addSceneToIndex(entry);
      setCurrentScene(id, scene);
    } catch (err) {
      console.error('씬 추가 실패:', err);
    } finally {
      setIsAdding(false);
    }
  }, [dirHandle, index, isAdding, addSceneToIndex, setCurrentScene]);

  // Listen for addScene events (from Ctrl+Shift+S or slash menu)
  useEffect(() => {
    const handler = () => handleAddScene();
    window.addEventListener('scenaria:addScene', handler);
    return () => window.removeEventListener('scenaria:addScene', handler);
  }, [handleAddScene]);

  const handleDeleteScene = useCallback(async (entry: SceneIndexEntry) => {
    if (!dirHandle) return;
    if (!confirm(`S#${entry.number} "${entry.location}"를 삭제하시겠습니까?`)) return;
    try {
      await fileIO.deleteFile(dirHandle, `screenplay/${entry.filename}`);
      const newIndex = renumberScenes(index.filter((s) => s.id !== entry.id));
      await fileIO.writeJSON(dirHandle, 'screenplay/_index.json', { scenes: newIndex });
      setIndex(newIndex);
      removeSceneFromIndex(entry.id);
    } catch (err) {
      console.error('씬 삭제 실패:', err);
    }
  }, [dirHandle, index, setIndex, removeSceneFromIndex]);

  const handleDuplicateScene = useCallback(async (entry: SceneIndexEntry) => {
    if (!dirHandle) return;
    try {
      const originalScene = await fileIO.readJSON<Scene>(dirHandle, `screenplay/${entry.filename}`);
      const newId = nextSceneId(index);
      const newNumber = index.findIndex((s) => s.id === entry.id) + 2;
      const newScene: Scene = { ...originalScene, id: newId, version: 1 };
      const newFilename = sceneFilename(newId, newScene.header.location);

      await fileIO.writeJSON(dirHandle, `screenplay/${newFilename}`, newScene);

      const newEntry: SceneIndexEntry = { ...entry, id: newId, filename: newFilename, number: newNumber };
      const insertAt = index.findIndex((s) => s.id === entry.id) + 1;
      const newIndex = [...index.slice(0, insertAt), newEntry, ...index.slice(insertAt)];
      const renumbered = renumberScenes(newIndex);
      await fileIO.writeJSON(dirHandle, 'screenplay/_index.json', { scenes: renumbered });
      setIndex(renumbered);
    } catch (err) {
      console.error('씬 복제 실패:', err);
    }
  }, [dirHandle, index, setIndex]);

  const handleMergeScene = useCallback(async (entry: SceneIndexEntry) => {
    const entryIdx = index.findIndex(s => s.id === entry.id);
    if (entryIdx === -1 || entryIdx === index.length - 1) return;
    const nextEntry = index[entryIdx + 1];
    if (!dirHandle) return;
    if (!confirm(`S#${entry.number} "${entry.location}"과 S#${nextEntry.number} "${nextEntry.location}"를 합치겠습니까?\n두 번째 씬은 삭제됩니다.`)) return;
    try {
      const [scene, nextScene] = await Promise.all([
        fileIO.readJSON<Scene>(dirHandle, `screenplay/${entry.filename}`),
        fileIO.readJSON<Scene>(dirHandle, `screenplay/${nextEntry.filename}`),
      ]);
      const merged: Scene = {
        ...scene,
        blocks: [...scene.blocks, ...nextScene.blocks],
        characters: [...new Set([...(scene.characters ?? []), ...(nextScene.characters ?? [])])],
        meta: {
          ...scene.meta,
          estimatedMinutes: (scene.meta?.estimatedMinutes ?? 0) + (nextScene.meta?.estimatedMinutes ?? 0),
          summary: scene.meta?.summary ? `${scene.meta.summary} / ${nextScene.meta?.summary ?? ''}` : (nextScene.meta?.summary ?? ''),
        },
      };
      await fileIO.writeJSON(dirHandle, `screenplay/${entry.filename}`, merged);
      await fileIO.deleteFile(dirHandle, `screenplay/${nextEntry.filename}`);
      const newIndex = renumberScenes(index.filter(s => s.id !== nextEntry.id));
      const updatedEntry = newIndex.find(s => s.id === entry.id);
      if (updatedEntry) {
        const merged2 = newIndex.map(s => s.id === entry.id ? { ...s, summary: merged.meta?.summary ?? '' } : s);
        await fileIO.writeJSON(dirHandle, 'screenplay/_index.json', { scenes: merged2 });
        setIndex(merged2);
      } else {
        await fileIO.writeJSON(dirHandle, 'screenplay/_index.json', { scenes: newIndex });
        setIndex(newIndex);
      }
      setCurrentScene(entry.id, merged);
    } catch (err) {
      console.error('씬 합치기 실패:', err);
    }
  }, [dirHandle, index, setIndex, setCurrentScene]);

  const handleDragEnd = useCallback(async () => {
    if (dragIndex === null || dragOverIndex === null || dragIndex === dragOverIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    reorderScenes(dragIndex, dragOverIndex);
    const newIndex = useSceneStore.getState().index;
    if (dirHandle) {
      await fileIO.writeJSON(dirHandle, 'screenplay/_index.json', { scenes: newIndex });
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }, [dragIndex, dragOverIndex, reorderScenes, dirHandle]);

  const filtered = useMemo(() => index.filter(e => {
    const matchText = !filter.trim() || e.location.includes(filter) || e.summary?.includes(filter) || String(e.number).includes(filter);
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchText && matchStatus;
  }), [index, filter, statusFilter]);

  // Pre-build id→position map to avoid O(n²) indexOf in render
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
      {/* Header */}
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

      {/* Progress bar */}
      {total > 0 && (
        <div className="px-2 pt-1.5">
          <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-800" title={`완료 ${statusCounts.done} · 수정 ${statusCounts.revision} · 초고 ${statusCounts.draft} · 아웃라인 ${statusCounts.outline}`}>
            {statusCounts.done > 0    && <div style={{ width: `${statusCounts.done    / total * 100}%` }} className="bg-green-500" />}
            {statusCounts.revision > 0 && <div style={{ width: `${statusCounts.revision / total * 100}%` }} className="bg-yellow-500" />}
            {statusCounts.draft > 0   && <div style={{ width: `${statusCounts.draft   / total * 100}%` }} className="bg-blue-500" />}
            {statusCounts.outline > 0 && <div style={{ width: `${statusCounts.outline / total * 100}%` }} className="bg-gray-500" />}
          </div>
          <p className="text-xs text-gray-700 mt-0.5">
            완료 {statusCounts.done}/{total}
          </p>
        </div>
      )}

      {/* Status filter chips */}
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

      {/* Filter input */}
      <div className="px-2 py-1.5 border-b border-gray-800">
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="위치/요약 검색..."
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-500"
        />
      </div>

      {/* Scene list */}
      <div className="flex-1 overflow-y-auto">
        {index.length === 0 ? (
          <div className="text-center py-8 px-3">
            <p className="text-xs text-gray-600">씬이 없습니다</p>
            <button
              onClick={handleAddScene}
              className="mt-2 text-xs text-red-500 hover:text-red-400"
            >
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
            return <div
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
            </div>;
          })
        )}
      </div>

      {/* Footer stats */}
      <div className="px-3 py-2 border-t border-gray-800 text-xs text-gray-600">
        {filter ? `${filtered.length}/${index.length}씬` : `총 ${index.length}씬`}
      </div>
    </div>
  );
}
