import { useState, useRef, type ReactNode } from 'react';
import type { SceneIndexEntry, TimeOfDay } from '../../types/scene';
import { STATUS_LABELS } from '../../utils/statusMapping';
import { Sun, Moon, Sunrise, Sunset, ArrowRight, User, MoreHorizontal } from 'lucide-react';

const TIME_COLOR: Record<TimeOfDay, string> = {
  DAY: 'text-amber-500',
  NIGHT: 'text-indigo-400',
  DAWN: 'text-orange-400',
  DUSK: 'text-rose-400',
  CONTINUOUS: 'text-zinc-400',
};

const TIME_ICON: Record<TimeOfDay, ReactNode> = {
  DAY: <Sun className="w-3 h-3" />,
  NIGHT: <Moon className="w-3 h-3" />,
  DAWN: <Sunrise className="w-3 h-3" />,
  DUSK: <Sunset className="w-3 h-3" />,
  CONTINUOUS: <ArrowRight className="w-3 h-3" />,
};

const INTERIOR_LABEL: Record<string, string> = {
  INT: '실내',
  EXT: '실외',
  'INT/EXT': '실내/실외',
};

const STATUS_DOT: Record<string, string> = {
  outline: 'bg-zinc-300',
  draft: 'bg-blue-400',
  revision: 'bg-amber-400',
  done: 'bg-emerald-400',
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
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const openMenu = () => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.top, left: rect.right + 4 });
    }
    setShowMenu(true);
  };

  return (
    <div
      ref={cardRef}
      className={`relative group cursor-pointer rounded-lg mx-0.5 mb-0.5 transition-all ${
        isActive
          ? 'bg-blue-50 text-zinc-800'
          : 'hover:bg-zinc-50 text-zinc-700'
      }`}
      onClick={onSelect}
      onContextMenu={(e) => { e.preventDefault(); openMenu(); }}
    >
      <div className="px-2.5 py-2">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={`text-[11px] font-mono font-semibold ${isActive ? 'text-blue-600' : 'text-zinc-400'}`}>
            장면 {entry.number}
          </span>
          <span className={`${TIME_COLOR[entry.timeOfDay]}`}>{TIME_ICON[entry.timeOfDay]}</span>
          {entry.interior && <span className="text-[10px] text-zinc-400 font-mono">{INTERIOR_LABEL[entry.interior] ?? entry.interior}</span>}
          <div className="flex gap-1 ml-auto items-center group-hover:invisible">
            {entry.status && (
              <span title={STATUS_LABELS[entry.status]} className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[entry.status] ?? 'bg-zinc-300'}`} />
            )}
            {entry.hasConsistencyIssue && <span className="w-1.5 h-1.5 rounded-full bg-red-400" title="정합성 이슈" />}
            {entry.characterCount != null && entry.characterCount > 0 && (
              <span className="text-[10px] text-zinc-400 flex items-center gap-0.5"><User className="w-2.5 h-2.5" />{entry.characterCount}</span>
            )}
          </div>
        </div>
        <p className={`text-xs font-medium truncate ${isActive ? 'text-zinc-800' : 'text-zinc-600'}`}>{entry.location}</p>
        {entry.summary && <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-2 leading-snug">{entry.summary}</p>}
      </div>

      {/* Hover menu button */}
      <button
        onClick={(e) => { e.stopPropagation(); openMenu(); }}
        className="absolute right-1.5 top-1.5 opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-200 transition-all"
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="fixed z-50 bg-white border border-zinc-200 rounded-xl shadow-lg py-1 min-w-36" style={{ top: menuPos.top, left: menuPos.left }}>
            <button
              onClick={(e) => { e.stopPropagation(); onDuplicate(); setShowMenu(false); }}
              className="w-full text-left px-3 py-1.5 text-[13px] text-zinc-600 hover:bg-zinc-50 hover:text-zinc-800 transition-colors"
            >
              복제
            </button>
            {!isLast && (
              <button
                onClick={(e) => { e.stopPropagation(); onMergeNext(); setShowMenu(false); }}
                className="w-full text-left px-3 py-1.5 text-[13px] text-zinc-600 hover:bg-zinc-50 hover:text-zinc-800 transition-colors"
              >
                다음 씬과 합치기
              </button>
            )}
            <div className="border-t border-zinc-100 my-1" />
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); setShowMenu(false); }}
              className="w-full text-left px-3 py-1.5 text-[13px] text-red-500 hover:bg-red-50 transition-colors"
            >
              삭제
            </button>
          </div>
        </>
      )}
    </div>
  );
}
