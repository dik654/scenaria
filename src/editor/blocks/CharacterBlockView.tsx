import { useEffect, useRef, useState, useCallback } from 'react';
import type { CharacterBlock } from '../../types/scene';
import type { Character, CharacterIndexEntry } from '../../types/character';
import type { BlockProps } from './BlockProps';
import { CharacterForm } from '../../panels/characterPanel/CharacterForm';
import { useCharacterStore } from '../../store/characterStore';
import { useProjectStore } from '../../store/projectStore';
import { fileIO } from '../../io';

const VOICE_LABELS: Record<string, string> = { 'V.O.': 'V.O.', 'O.S.': 'O.S.', 'E': 'E', 'N': 'N', 'normal': '' };

export function CharacterBlockView({ block, index, isSelected, readOnly, characterNames, characterColors, charEntries, onSelect, onChange, onKeyDown }: BlockProps) {
  const b = block as CharacterBlock;
  const resolvedName = characterNames[b.characterId] ?? b.characterId;
  const color = characterColors[b.characterId] ?? '#DC2626';
  const ref = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState(resolvedName);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownIdx, setDropdownIdx] = useState(0);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { projectRef } = useProjectStore();
  const { index: charIndex, setCharacter, addToIndex } = useCharacterStore();

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

  const openCreateForm = () => {
    setShowDropdown(false);
    setShowCreateForm(true);
  };

  const handleCharacterSave = useCallback(async (char: Character) => {
    if (!projectRef) return;
    try {
      const filename = `${char.id}.json`;
      await fileIO.writeJSON(projectRef, `characters/${filename}`, char);
      const entry: CharacterIndexEntry = { id: char.id, name: char.name, alias: char.alias, color: char.color, filename };
      const newIndex = [...charIndex, entry];
      await fileIO.writeJSON(projectRef, 'characters/_index.json', { characters: newIndex });
      addToIndex(entry);
      setCharacter(char.id, char);

      // 블록에 새 캐릭터 연결
      onChange(index, { ...b, characterId: char.id });
      setInputValue(char.name);
      setShowCreateForm(false);
    } catch (err) {
      console.error('캐릭터 저장 실패:', err);
    }
  }, [projectRef, charIndex, addToIndex, setCharacter, onChange, index, b]);

  const isNewName = inputValue.trim() && !charEntries.find(e => e.name.toLowerCase() === inputValue.toLowerCase());

  return (
    <>
      <div
        className={`flex items-baseline gap-2 pt-4 pb-0 transition-colors cursor-pointer ${isSelected ? 'border-l-2 border-blue-400' : 'border-l-2 border-transparent'}`}
        style={{ paddingLeft: '3em' }}
        onClick={() => onSelect(index)}
      >
        <div className="relative">
          <input
            ref={ref}
            value={inputValue}
            readOnly={readOnly}
            onChange={(e) => { setInputValue(e.target.value); setShowDropdown(true); setDropdownIdx(0); }}
            onFocus={() => { onSelect(index); setShowDropdown(true); }}
            onBlur={() => setTimeout(() => {
              setShowDropdown(false);
              const exactMatch = charEntries.find(e => e.name.toLowerCase() === inputValue.toLowerCase());
              if (exactMatch && exactMatch.id !== b.characterId) selectEntry(exactMatch);
            }, 150)}
            onKeyDown={(e) => {
              if (showDropdown) {
                if (e.key === 'ArrowDown') { e.preventDefault(); setDropdownIdx(i => Math.min(i + 1, filtered.length)); return; }
                if (e.key === 'ArrowUp') { e.preventDefault(); setDropdownIdx(i => Math.max(i - 1, 0)); return; }
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (dropdownIdx < filtered.length) { selectEntry(filtered[dropdownIdx]); }
                  else { openCreateForm(); }
                  return;
                }
                if (e.key === 'Escape') { setShowDropdown(false); return; }
              }
              onKeyDown(e, index);
            }}
            className="bg-transparent font-bold text-[11pt] tracking-wide focus:outline-none focus:border-b focus:border-dashed"
            style={{ color, width: `${Math.max(inputValue.length, 8) + 2}ch` }}
          />
          {showDropdown && !readOnly && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-36 max-h-48 overflow-y-auto">
              {filtered.map((entry, i) => (
                <button
                  key={entry.id}
                  onMouseDown={() => selectEntry(entry)}
                  className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 ${i === dropdownIdx ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                  <span style={{ color: entry.color }} className="font-medium">{entry.name}</span>
                  {entry.alias && <span className="text-xs text-gray-500">{entry.alias}</span>}
                </button>
              ))}
              <button
                onMouseDown={openCreateForm}
                className={`w-full text-left px-3 py-1.5 text-xs text-blue-500 hover:bg-blue-50 border-t border-gray-100 mt-0.5 pt-1.5 flex items-center gap-1.5 ${dropdownIdx === filtered.length ? 'bg-blue-50' : ''}`}
              >
                <span>+</span>
                <span>{isNewName ? `"${inputValue.trim()}" 새 캐릭터 만들기` : '새 캐릭터 만들기'}</span>
              </button>
            </div>
          )}
        </div>
        {b.voiceType !== 'normal' && (
          <span className="text-[10pt] text-gray-400">({VOICE_LABELS[b.voiceType]})</span>
        )}
      </div>

      {showCreateForm && (
        <CharacterForm
          initial={{ name: isNewName ? inputValue.trim() : '' }}
          onSave={handleCharacterSave}
          onClose={() => setShowCreateForm(false)}
        />
      )}
    </>
  );
}
