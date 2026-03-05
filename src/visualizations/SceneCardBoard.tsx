import { useState } from 'react';
import { useSceneStore } from '../store/sceneStore';
import { useCharacterStore } from '../store/characterStore';
import type { SceneIndexEntry } from '../types/scene';

type BoardLayout = 'kanban' | 'grid' | 'list';
type FilterKey = 'all' | string;

const TENSION_COLOR = (level: number) => {
  if (level >= 8) return '#DC2626';
  if (level >= 6) return '#EA580C';
  if (level >= 4) return '#D97706';
  return '#059669';
};

const TIME_LABEL: Record<string, string> = {
  DAY: '낮', NIGHT: '밤', DAWN: '새벽', DUSK: '황혼', CONTINUOUS: '연속',
};

function SceneCard({ entry, isActive, compact, onSelect }: {
  entry: SceneIndexEntry;
  isActive: boolean;
  compact?: boolean;
  onSelect: () => void;
}) {
  const { characters, index: charIndex } = useCharacterStore();
  const sceneChars = (entry as SceneIndexEntry & { characters?: string[] }).characters ?? [];

  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer border rounded-xl transition-all hover:shadow-lg ${
        isActive ? 'border-red-500 shadow-red-900/30 shadow-lg' : 'border-gray-700 hover:border-gray-500'
      } ${compact ? 'p-2' : 'p-3'} bg-gray-900`}
      style={entry.cardColor ? { borderTopColor: entry.cardColor, borderTopWidth: 3 } : {}}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xs font-bold text-red-400 font-mono">S#{entry.number}</span>
        <span className="text-xs text-gray-500">{entry.interior}</span>
        <span className="text-xs text-gray-400">{TIME_LABEL[entry.timeOfDay] ?? entry.timeOfDay}</span>
        <div className="flex gap-1 ml-auto">
          {entry.hasConsistencyIssue && <span title="정합성 이슈" className="text-xs">🔴</span>}
          {entry.hasUnresolvedForeshadowing && <span title="미회수 떡밥" className="text-xs">🟡</span>}
        </div>
      </div>

      {/* Location */}
      <p className="text-sm text-white font-medium truncate mb-1">{entry.location}</p>

      {/* Summary */}
      {!compact && entry.summary && (
        <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-2">{entry.summary}</p>
      )}

      {/* Character dots */}
      {!compact && sceneChars.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {sceneChars.slice(0, 5).map(charId => {
            const charEntry = charIndex.find(c => c.id === charId);
            return charEntry ? (
              <span
                key={charId}
                title={charEntry.name}
                className="w-4 h-4 rounded-full text-xs"
                style={{ backgroundColor: charEntry.color }}
              />
            ) : null;
          })}
          {sceneChars.length > 5 && (
            <span className="text-xs text-gray-600">+{sceneChars.length - 5}</span>
          )}
        </div>
      )}

      {/* Tags */}
      {!compact && entry.tags && entry.tags.length > 0 && (
        <div className="flex gap-1 flex-wrap mt-1.5">
          {entry.tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-xs bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded-full">{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export function SceneCardBoard({ onSceneSelect }: { onSceneSelect?: (id: string) => void }) {
  const { index: scenes, currentSceneId } = useSceneStore();
  const [layout, setLayout] = useState<BoardLayout>('kanban');
  const [filterChar, setFilterChar] = useState<FilterKey>('all');
  const { index: charIndex } = useCharacterStore();

  const ACT_LABELS = ['1막', '2막 전반', '2막 후반', '3막'];
  const ACT_THRESHOLDS = [0, 0.25, 0.5, 0.75, 1.0];

  const getAct = (idx: number) => {
    const pct = scenes.length > 1 ? idx / (scenes.length - 1) : 0;
    for (let i = 0; i < 4; i++) {
      if (pct < ACT_THRESHOLDS[i + 1]) return i;
    }
    return 3;
  };

  const filtered = filterChar === 'all'
    ? scenes
    : scenes.filter(s => ((s as SceneIndexEntry & { characters?: string[] }).characters ?? []).includes(filterChar));

  const scenesByAct = ACT_LABELS.map((_, i) => filtered.filter((_, idx) => getAct(scenes.indexOf(filtered[idx])) === i));

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 flex-wrap">
        {/* Layout toggle */}
        <div className="flex border border-gray-700 rounded-lg overflow-hidden">
          {(['kanban', 'grid', 'list'] as BoardLayout[]).map(l => (
            <button
              key={l}
              onClick={() => setLayout(l)}
              className={`px-2.5 py-1 text-xs transition-colors ${layout === l ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              {l === 'kanban' ? '칸반' : l === 'grid' ? '그리드' : '목록'}
            </button>
          ))}
        </div>

        {/* Character filter */}
        <select
          value={filterChar}
          onChange={(e) => setFilterChar(e.target.value)}
          className="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-gray-300 focus:outline-none"
        >
          <option value="all">모든 캐릭터</option>
          {charIndex.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <span className="text-xs text-gray-600 ml-auto">{filtered.length}씬</span>
      </div>

      {/* Board content */}
      <div className="flex-1 overflow-auto p-3">
        {layout === 'kanban' && (
          <div className="flex gap-3 h-full min-w-max">
            {ACT_LABELS.map((actLabel, actIdx) => (
              <div key={actIdx} className="flex flex-col w-52 flex-shrink-0">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 px-1">
                  {actLabel}
                  <span className="text-gray-700 ml-2">{scenesByAct[actIdx].length}</span>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto">
                  {scenesByAct[actIdx].map(s => (
                    <SceneCard
                      key={s.id}
                      entry={s}
                      isActive={s.id === currentSceneId}
                      onSelect={() => onSceneSelect?.(s.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {layout === 'grid' && (
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
            {filtered.map(s => (
              <SceneCard
                key={s.id}
                entry={s}
                isActive={s.id === currentSceneId}
                compact
                onSelect={() => onSceneSelect?.(s.id)}
              />
            ))}
          </div>
        )}

        {layout === 'list' && (
          <div className="space-y-1">
            {filtered.map(s => (
              <div
                key={s.id}
                onClick={() => onSceneSelect?.(s.id)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  s.id === currentSceneId ? 'bg-gray-800' : 'hover:bg-gray-900'
                }`}
              >
                <span className="text-xs font-mono text-red-400 w-10 flex-shrink-0">S#{s.number}</span>
                <span className="text-xs text-gray-500 w-8 flex-shrink-0">{s.interior}</span>
                <span className="text-sm text-white flex-1 truncate">{s.location}</span>
                <span className="text-xs text-gray-600">{TIME_LABEL[s.timeOfDay]}</span>
                <div className="flex gap-1">
                  {s.hasConsistencyIssue && <span className="text-xs">🔴</span>}
                  {s.hasUnresolvedForeshadowing && <span className="text-xs">🟡</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
