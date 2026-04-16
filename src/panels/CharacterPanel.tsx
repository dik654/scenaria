import { useState, useCallback } from 'react';
import { useCharacterStore } from '../store/characterStore';
import { useProjectStore } from '../store/projectStore';
import { useSceneStore } from '../store/sceneStore';
import { fileIO } from '../io';
import type { Character, CharacterIndexEntry } from '../types/character';
import { STATUS_BG_ACTIVE } from '../utils/statusMapping';
import { CharacterForm } from './characterPanel/CharacterForm';
import { useConfirm } from '../components/ConfirmDialog';

export function CharacterPanel() {
  const { index, characters, setCharacter, addToIndex, updateCharacter, removeCharacter } = useCharacterStore();
  const { projectRef } = useProjectStore();
  const { index: sceneIndex } = useSceneStore();
  const confirm = useConfirm();
  const [editTarget, setEditTarget] = useState<Partial<Character> | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [filter, setFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = index.filter(c => !filter || c.name.includes(filter) || (c.alias ?? '').includes(filter));

  const saveCharacter = useCallback(async (char: Character) => {
    if (!projectRef) return;
    try {
      const filename = `${char.id}.json`;
      await fileIO.writeJSON(projectRef, `characters/${filename}`, char);
      const isNew = !index.find(c => c.id === char.id);
      if (isNew) {
        const entry: CharacterIndexEntry = { id: char.id, name: char.name, alias: char.alias, color: char.color, filename };
        const newIndex = [...index, entry];
        await fileIO.writeJSON(projectRef, 'characters/_index.json', { characters: newIndex });
        addToIndex(entry);
      } else {
        const newIndex = index.map(c => c.id === char.id ? { ...c, name: char.name, color: char.color, alias: char.alias } : c);
        await fileIO.writeJSON(projectRef, 'characters/_index.json', { characters: newIndex });
        updateCharacter(char.id, char);
      }
      setCharacter(char.id, char);
      setEditTarget(null);
      setIsAdding(false);
    } catch (err) {
      console.error('캐릭터 저장 실패:', err);
    }
  }, [projectRef, index, addToIndex, updateCharacter, setCharacter]);

  const handleDelete = async (entry: CharacterIndexEntry) => {
    if (!projectRef || !await confirm(`"${entry.name}"을 삭제하시겠습니까?`)) return;
    try {
      await fileIO.deleteFile(projectRef, `characters/${entry.filename}`);
      const newIndex = index.filter(c => c.id !== entry.id);
      await fileIO.writeJSON(projectRef, 'characters/_index.json', { characters: newIndex });
      removeCharacter(entry.id);
      if (selectedId === entry.id) setSelectedId(null);
    } catch (err) {
      console.error('캐릭터 삭제 실패:', err);
    }
  };

  const handleEdit = async (entry: CharacterIndexEntry) => {
    if (!projectRef) return;
    try {
      let char = characters[entry.id];
      if (!char) {
        char = await fileIO.readJSON<Character>(projectRef, `characters/${entry.filename}`);
        setCharacter(entry.id, char);
      }
      setEditTarget(char);
    } catch (err) {
      console.error('캐릭터 로드 실패:', err);
    }
  };

  const selectedChar = selectedId ? characters[selectedId] : null;
  const selectedEntry = selectedId ? index.find(c => c.id === selectedId) : null;

  return (
    <div className="flex flex-col h-full">
      {(editTarget !== null || isAdding) && (
        <CharacterForm
          initial={editTarget ?? {}}
          onSave={saveCharacter}
          onClose={() => { setEditTarget(null); setIsAdding(false); }}
        />
      )}

      <div className="p-3 border-b border-gray-100 space-y-2">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="검색..."
          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:border-blue-300"
        />
        <button
          onClick={() => setIsAdding(true)}
          className="w-full py-1.5 text-xs text-blue-500 hover:text-blue-600 border border-dashed border-blue-200 hover:border-blue-400 rounded-lg transition-colors"
        >
          + 새 캐릭터
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.map(entry => (
          <div
            key={entry.id}
            onClick={() => setSelectedId(selectedId === entry.id ? null : entry.id)}
            className={`group flex items-center gap-2 px-3 py-2 cursor-pointer border-l-2 transition-all ${
              selectedId === entry.id ? 'bg-blue-50 border-l-2' : 'border-transparent hover:bg-gray-50'
            }`}
            style={{ borderLeftColor: selectedId === entry.id ? entry.color : undefined }}
          >
            <div
              className="w-6 h-6 rounded-full flex-shrink-0 text-xs flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: entry.color }}
            >
              {entry.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800 truncate">{entry.name}</p>
              {entry.alias && <p className="text-xs text-gray-500 truncate">{entry.alias}</p>}
            </div>
            <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
              <button onClick={(e) => { e.stopPropagation(); handleEdit(entry); }} className="text-xs text-gray-400 hover:text-blue-500 px-1">편집</button>
              <button onClick={(e) => { e.stopPropagation(); handleDelete(entry); }} className="text-xs text-gray-400 hover:text-red-400 px-1">삭제</button>
            </div>
          </div>
        ))}
      </div>

      {selectedChar && selectedEntry && (
        <div className="border-t border-gray-100 p-3 space-y-2 max-h-72 overflow-y-auto">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full" style={{ backgroundColor: selectedEntry.color }} />
            <span className="text-sm font-medium text-gray-800">{selectedChar.name}</span>
            {selectedChar.age && <span className="text-xs text-gray-500">({selectedChar.age})</span>}
          </div>
          {selectedChar.occupation && <p className="text-xs text-gray-500">{selectedChar.occupation}</p>}
          {selectedChar.drama.goal && (
            <div><span className="text-xs text-gray-400">목표: </span><span className="text-xs text-gray-600">{selectedChar.drama.goal}</span></div>
          )}
          {selectedChar.drama.arc && (
            <div><span className="text-xs text-gray-400">아크: </span><span className="text-xs text-gray-600">{selectedChar.drama.arc}</span></div>
          )}
          {selectedChar.personality.traits.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedChar.personality.traits.map(t => (
                <span key={t} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{t}</span>
              ))}
            </div>
          )}
          {selectedId && (() => {
            const appearances = sceneIndex.filter(s => s.characters?.includes(selectedId));
            if (appearances.length === 0) return null;
            return (
              <div>
                <p className="text-xs text-gray-600 mb-1">등장 씬 ({appearances.length})</p>
                <div className="space-y-0.5 max-h-32 overflow-y-auto">
                  {appearances.map(s => (
                    <button
                      key={s.id}
                      onClick={() => window.dispatchEvent(new CustomEvent('scenaria:gotoScene', { detail: s.id }))}
                      className="w-full text-left flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-xs font-mono text-blue-500">장면 {s.number}</span>
                      <span className="text-xs text-gray-500 truncate">{s.location}</span>
                      {s.status && <span className={`ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_BG_ACTIVE[s.status]}`} />}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
