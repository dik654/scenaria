import { useState } from 'react';
import type { SceneIndexEntry, TimeOfDay } from '../../types/scene';
import { STATUS_LABELS, STATUS_BG_ACTIVE } from '../../utils/statusMapping';

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

export function SceneCard({ entry, isActive, isLast, onSelect, onDelete, onDuplicate, onMergeNext }: SceneCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      className={`relative group cursor-pointer border-l-2 transition-all ${
        isActive ? 'border-red-500 bg-gray-800' : 'border-transparent hover:border-gray-600 hover:bg-gray-900/50'
      }`}
      onClick={onSelect}
      onContextMenu={(e) => { e.preventDefault(); setShowMenu(true); }}
    >
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-mono text-red-400 font-bold">S#{entry.number}</span>
          <span className={`text-xs ${TIME_COLOR[entry.timeOfDay]}`}>{TIME_ICON[entry.timeOfDay]}</span>
          {entry.interior && <span className="text-xs text-gray-500 font-mono">{entry.interior}</span>}
          <div className="flex gap-1 ml-auto items-center">
            {entry.status && (
              <span title={`작성 상태: ${STATUS_LABELS[entry.status]}`} className={`w-2 h-2 rounded-full ${STATUS_BG_ACTIVE[entry.status]}`} />
            )}
            {entry.hasConsistencyIssue && <span title="정합성 이슈" className="text-xs">🔴</span>}
            {entry.hasUnresolvedForeshadowing && <span title="미회수 떡밥" className="text-xs">🟡</span>}
            {entry.characterCount != null && entry.characterCount > 0 && (
              <span className="text-xs text-gray-600 font-mono">👤{entry.characterCount}</span>
            )}
          </div>
        </div>
        <p className="text-xs text-white font-medium truncate">{entry.location}</p>
        {entry.summary && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-tight">{entry.summary}</p>}
      </div>

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
