import { useEffect, useRef, useState } from 'react';
import type { CharacterBlock } from '../../types/scene';
import type { BlockProps } from './BlockProps';

const VOICE_LABELS: Record<string, string> = { 'V.O.': 'V.O.', 'O.S.': 'O.S.', 'E': 'E', 'N': 'N', 'normal': '' };

export function CharacterBlockView({ block, index, isSelected, readOnly, characterNames, characterColors, charEntries, onSelect, onChange, onKeyDown }: BlockProps) {
  const b = block as CharacterBlock;
  const resolvedName = characterNames[b.characterId] ?? b.characterId;
  const color = characterColors[b.characterId] ?? '#DC2626';
  const ref = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState(resolvedName);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownIdx, setDropdownIdx] = useState(0);

  useEffect(() => {
    setInputValue(characterNames[b.characterId] ?? b.characterId);
  }, [b.characterId, characterNames]);

  useEffect(() => {
    if (isSelected && ref.current) ref.current.focus();
  }, [isSelected]);

  const filtered = charEntries.filter(c =>
    c.name.toLowerCase().includes(inputValue.toLowerCase()) ||
    (c.alias ?? '').toLowerCase().includes(inputValue.toLowerCase())
  );

  const selectEntry = (entry: typeof charEntries[0]) => {
    onChange(index, { ...b, characterId: entry.id });
    setInputValue(entry.name);
    setShowDropdown(false);
  };

  const useAsNew = () => {
    const newId = inputValue.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    onChange(index, { ...b, characterId: newId || inputValue });
    setShowDropdown(false);
  };

  return (
    <div
      className={`flex justify-center items-baseline gap-2 py-2 ${isSelected ? 'bg-gray-800/50' : ''} rounded cursor-pointer`}
      onClick={() => onSelect(index)}
    >
      <div className="relative">
        <input
          ref={ref}
          value={inputValue}
          readOnly={readOnly}
          onChange={(e) => { setInputValue(e.target.value); setShowDropdown(true); setDropdownIdx(0); }}
          onFocus={() => { onSelect(index); setShowDropdown(true); }}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          onKeyDown={(e) => {
            if (showDropdown) {
              if (e.key === 'ArrowDown') { e.preventDefault(); setDropdownIdx(i => Math.min(i + 1, filtered.length - 1)); return; }
              if (e.key === 'ArrowUp') { e.preventDefault(); setDropdownIdx(i => Math.max(i - 1, 0)); return; }
              if (e.key === 'Enter' && filtered[dropdownIdx]) { e.preventDefault(); selectEntry(filtered[dropdownIdx]); return; }
              if (e.key === 'Escape') { setShowDropdown(false); return; }
            }
            onKeyDown(e, index);
          }}
          className="bg-transparent text-center font-mono font-bold text-sm uppercase tracking-widest focus:outline-none focus:border-b focus:border-dashed"
          style={{ color, width: `${Math.max(inputValue.length, 8) + 2}ch` }}
        />
        {showDropdown && !readOnly && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-36 max-h-48 overflow-y-auto">
            {filtered.map((entry, i) => (
              <button
                key={entry.id}
                onMouseDown={() => selectEntry(entry)}
                className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 ${i === dropdownIdx ? 'bg-gray-700' : 'hover:bg-gray-700'}`}
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                <span style={{ color: entry.color }} className="font-medium">{entry.name}</span>
                {entry.alias && <span className="text-xs text-gray-500">{entry.alias}</span>}
              </button>
            ))}
            {inputValue && !filtered.find(e => e.name.toLowerCase() === inputValue.toLowerCase()) && (
              <button
                onMouseDown={useAsNew}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-700 border-t border-gray-700 mt-0.5 pt-1.5 italic"
              >
                "{inputValue}" 새 캐릭터로 사용
              </button>
            )}
          </div>
        )}
      </div>
      {b.voiceType !== 'normal' && (
        <span className="text-xs text-gray-400 font-mono">({VOICE_LABELS[b.voiceType]})</span>
      )}
    </div>
  );
}
