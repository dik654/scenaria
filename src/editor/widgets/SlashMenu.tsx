import { useEffect, useRef, useState } from 'react';
import type { SceneBlock } from '../../types/scene';

interface SlashMenuItem {
  id: string;
  label: string;
  shortcut: string;
  description: string;
  blockType: SceneBlock['type'] | 'scene' | 'foreshadowing' | 'payoff';
  icon: string;
}

const ITEMS: SlashMenuItem[] = [
  { id: 'action',       label: '지문',      shortcut: '/ㅈ',   description: '씬 행동/묘사',        blockType: 'action',        icon: '📝' },
  { id: 'character',    label: '캐릭터명',   shortcut: '/ㅋ',   description: '캐릭터 이름',          blockType: 'character',     icon: '👤' },
  { id: 'dialogue',     label: '대사',      shortcut: '/ㄷ',   description: '캐릭터 대사',          blockType: 'dialogue',      icon: '💬' },
  { id: 'parenthetical',label: '지시문',    shortcut: '/ㅅ',   description: '(연기 지시)',          blockType: 'parenthetical', icon: '()' },
  { id: 'transition',   label: '전환',      shortcut: '/전환', description: 'CUT TO / FADE 등',   blockType: 'transition',    icon: '→' },
  { id: 'scene',        label: '새 씬',     shortcut: '/씬',   description: '씬 헤더 추가',         blockType: 'scene',         icon: '🎬' },
  { id: 'foreshadow',   label: '복선 마커', shortcut: '/복선', description: '복선(떡밥) 마커 삽입', blockType: 'foreshadowing', icon: '🔗' },
  { id: 'payoff',       label: '회수 마커', shortcut: '/회수', description: '복선 회수 마커 연결',  blockType: 'payoff',        icon: '🎯' },
];

interface SlashMenuProps {
  anchorEl: HTMLElement | null;
  query: string;
  onSelect: (item: SlashMenuItem) => void;
  onClose: () => void;
}

export function SlashMenu({ anchorEl, query, onSelect, onClose }: SlashMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const filtered = ITEMS.filter(
    (item) =>
      !query ||
      item.label.includes(query) ||
      item.shortcut.includes(query) ||
      item.id.includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) onSelect(filtered[selectedIndex]);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [filtered, selectedIndex, onSelect, onClose]);

  if (!anchorEl || filtered.length === 0) return null;

  const rect = anchorEl.getBoundingClientRect();

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: rect.bottom + 4,
        left: Math.min(rect.left, window.innerWidth - 260),
        zIndex: 1000,
        width: 260,
      }}
      className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden"
    >
      {query && (
        <div className="px-3 py-1.5 border-b border-gray-800 text-xs text-gray-500 font-mono">
          /{query}
        </div>
      )}
      {filtered.map((item, i) => (
        <button
          key={item.id}
          onClick={() => onSelect(item)}
          onMouseEnter={() => setSelectedIndex(i)}
          className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
            i === selectedIndex ? 'bg-gray-700' : 'hover:bg-gray-800'
          }`}
        >
          <span className="text-base w-6 text-center">{item.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm text-white font-medium">{item.label}</span>
              <span className="text-xs text-gray-600 font-mono">{item.shortcut}</span>
            </div>
            <p className="text-xs text-gray-500 truncate">{item.description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

export type { SlashMenuItem };
