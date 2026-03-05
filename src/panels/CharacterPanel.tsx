import { useState, useCallback } from 'react';
import { useCharacterStore } from '../store/characterStore';
import { useProjectStore } from '../store/projectStore';
import { useSceneStore } from '../store/sceneStore';
import { fileIO } from '../io';
import type { Character, CharacterIndexEntry } from '../types/character';
import { nanoid } from 'nanoid';
import { STATUS_BG_ACTIVE } from '../utils/statusMapping';

const DRAMA_FIELDS = [
  { key: 'goal',   label: '목표',    desc: '주인공이 원하는 것' },
  { key: 'need',   label: '필요',    desc: '실제로 필요한 것' },
  { key: 'flaw',   label: '결점',    desc: '성격 결함' },
  { key: 'lie',    label: '거짓말',  desc: '믿고 있는 거짓' },
  { key: 'ghost',  label: '트라우마', desc: '과거의 상처' },
  { key: 'arc',    label: '아크',    desc: '변화 여정' },
  { key: 'stakes', label: '위험',    desc: '실패했을 때의 결과' },
] as const;

const COLORS = [
  '#DC2626', '#EA580C', '#D97706', '#65A30D',
  '#059669', '#0891B2', '#4F46E5', '#7C3AED',
  '#BE185D', '#6B7280',
];

function CharacterForm({
  initial,
  onSave,
  onClose,
}: {
  initial?: Partial<Character>;
  onSave: (char: Character) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'basic' | 'drama' | 'speech'>('basic');
  const [form, setForm] = useState<Character>({
    id: initial?.id ?? nanoid().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12),
    version: 1,
    name: '',
    alias: '',
    age: undefined,
    ageDescription: '',
    gender: '',
    occupation: '',
    description: '',
    personality: { traits: [], speechStyle: '', speechExamples: [], speechTaboos: '' },
    drama: { goal: '', need: '', flaw: '', lie: '', ghost: '', arc: '', stakes: '' },
    relationships: [],
    color: COLORS[0],
    voiceProfileId: null,
    visualDescription: '',
    referenceImages: [],
    ...initial,
  });

  const set = (key: keyof Character, val: unknown) => setForm(f => ({ ...f, [key]: val }));
  const setDrama = (key: string, val: string) =>
    setForm(f => ({ ...f, drama: { ...f.drama, [key]: val } }));
  const setPersonality = (key: string, val: unknown) =>
    setForm(f => ({ ...f, personality: { ...f.personality, [key]: val } }));

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-gray-800">
          <div
            className="w-8 h-8 rounded-full flex-shrink-0 cursor-pointer ring-2 ring-offset-1 ring-offset-gray-900"
            style={{ backgroundColor: form.color, outline: `2px solid ${form.color}`, outlineOffset: '2px' }}
            title="색상 클릭으로 변경"
          />
          <input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="캐릭터 이름"
            className="flex-1 bg-transparent text-white text-lg font-medium focus:outline-none border-b border-transparent focus:border-gray-600"
          />
          <button onClick={onClose} className="text-gray-600 hover:text-gray-400">✕</button>
        </div>

        {/* Color picker */}
        <div className="flex gap-2 px-4 py-2 border-b border-gray-800">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => set('color', c)}
              className={`w-5 h-5 rounded-full transition-transform ${form.color === c ? 'scale-125 ring-2 ring-white' : 'hover:scale-110'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          {(['basic', 'drama', 'speech'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm transition-colors ${tab === t ? 'text-white border-b-2 border-red-500' : 'text-gray-500 hover:text-gray-300'}`}
            >
              {t === 'basic' ? '기본 정보' : t === 'drama' ? '드라마' : '말투'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {tab === 'basic' && (
            <>
              <FormRow label="아이디 (파일명)" hint="영문/숫자만">
                <input value={form.id} onChange={(e) => set('id', e.target.value)}
                  className="form-input" />
              </FormRow>
              <FormRow label="별명/호칭">
                <input value={form.alias ?? ''} onChange={(e) => set('alias', e.target.value)}
                  className="form-input" />
              </FormRow>
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="나이">
                  <input type="number" value={form.age ?? ''} onChange={(e) => set('age', Number(e.target.value))}
                    className="form-input" />
                </FormRow>
                <FormRow label="성별">
                  <select value={form.gender ?? ''} onChange={(e) => set('gender', e.target.value)}
                    className="form-input">
                    <option value="">-</option>
                    <option value="남">남</option>
                    <option value="여">여</option>
                    <option value="기타">기타</option>
                  </select>
                </FormRow>
              </div>
              <FormRow label="직업/역할">
                <input value={form.occupation ?? ''} onChange={(e) => set('occupation', e.target.value)}
                  className="form-input" />
              </FormRow>
              <FormRow label="캐릭터 설명">
                <textarea value={form.description} onChange={(e) => set('description', e.target.value)}
                  rows={3} className="form-input" />
              </FormRow>
              <FormRow label="외모 묘사">
                <textarea value={form.visualDescription ?? ''} onChange={(e) => set('visualDescription', e.target.value)}
                  rows={2} className="form-input" />
              </FormRow>
              <FormRow label="성격 특성 (쉼표로)">
                <input
                  value={form.personality.traits.join(', ')}
                  onChange={(e) => setPersonality('traits', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  className="form-input"
                />
              </FormRow>
            </>
          )}

          {tab === 'drama' && (
            <>
              {DRAMA_FIELDS.map(({ key, label, desc }) => (
                <FormRow key={key} label={label} hint={desc}>
                  <textarea
                    value={form.drama[key as keyof typeof form.drama]}
                    onChange={(e) => setDrama(key, e.target.value)}
                    rows={2}
                    className="form-input"
                  />
                </FormRow>
              ))}
            </>
          )}

          {tab === 'speech' && (
            <>
              <FormRow label="말투 스타일">
                <textarea
                  value={form.personality.speechStyle}
                  onChange={(e) => setPersonality('speechStyle', e.target.value)}
                  rows={3}
                  placeholder="예: 업무 중에는 간결한 존댓말. 격앙되면 짧은 문장."
                  className="form-input"
                />
              </FormRow>
              <FormRow label="말투 예시 (줄바꿈으로)">
                <textarea
                  value={(form.personality.speechExamples ?? []).join('\n')}
                  onChange={(e) => setPersonality('speechExamples', e.target.value.split('\n').filter(Boolean))}
                  rows={4}
                  placeholder="한 줄에 한 예시씩"
                  className="form-input"
                />
              </FormRow>
              <FormRow label="절대 안 쓰는 표현">
                <textarea
                  value={form.personality.speechTaboos ?? ''}
                  onChange={(e) => setPersonality('speechTaboos', e.target.value)}
                  rows={2}
                  className="form-input"
                />
              </FormRow>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2 border border-gray-600 rounded-lg text-sm text-gray-400 hover:bg-gray-800">
            취소
          </button>
          <button
            onClick={() => form.name.trim() && onSave(form)}
            disabled={!form.name.trim()}
            className="flex-1 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm text-white font-medium disabled:opacity-50"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

function FormRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">
        {label}{hint && <span className="text-gray-700 ml-1">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}

export function CharacterPanel() {
  const { index, characters, setCharacter, addToIndex, updateCharacter, removeCharacter } = useCharacterStore();
  const { dirHandle } = useProjectStore();
  const { index: sceneIndex } = useSceneStore();
  const [editTarget, setEditTarget] = useState<Partial<Character> | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [filter, setFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = index.filter(c =>
    !filter || c.name.includes(filter) || (c.alias ?? '').includes(filter)
  );

  const saveCharacter = useCallback(async (char: Character) => {
    if (!dirHandle) return;
    try {
      const filename = `${char.id}.json`;
      await fileIO.writeJSON(dirHandle, `characters/${filename}`, char);

      const isNew = !index.find(c => c.id === char.id);
      if (isNew) {
        const entry: CharacterIndexEntry = { id: char.id, name: char.name, alias: char.alias, color: char.color, filename };
        const newIndex = [...index, entry];
        await fileIO.writeJSON(dirHandle, 'characters/_index.json', { characters: newIndex });
        addToIndex(entry);
      } else {
        const newIndex = index.map(c => c.id === char.id ? { ...c, name: char.name, color: char.color, alias: char.alias } : c);
        await fileIO.writeJSON(dirHandle, 'characters/_index.json', { characters: newIndex });
        updateCharacter(char.id, char);
      }
      setCharacter(char.id, char);
      setEditTarget(null);
      setIsAdding(false);
    } catch (err) {
      console.error('캐릭터 저장 실패:', err);
    }
  }, [dirHandle, index, addToIndex, updateCharacter, setCharacter]);

  const handleDelete = async (entry: CharacterIndexEntry) => {
    if (!dirHandle || !confirm(`"${entry.name}"을 삭제하시겠습니까?`)) return;
    try {
      await fileIO.deleteFile(dirHandle, `characters/${entry.filename}`);
      const newIndex = index.filter(c => c.id !== entry.id);
      await fileIO.writeJSON(dirHandle, 'characters/_index.json', { characters: newIndex });
      removeCharacter(entry.id);
      if (selectedId === entry.id) setSelectedId(null);
    } catch (err) {
      console.error('캐릭터 삭제 실패:', err);
    }
  };

  const handleEdit = async (entry: CharacterIndexEntry) => {
    if (!dirHandle) return;
    try {
      let char = characters[entry.id];
      if (!char) {
        char = await fileIO.readJSON<Character>(dirHandle, `characters/${entry.filename}`);
        setCharacter(entry.id, char);
      }
      setEditTarget(char);
    } catch (err) {
      console.error('캐릭터 로드 실패:', err);
    }
  };

  const selectedEntry = selectedId ? index.find(c => c.id === selectedId) : null;
  const selectedChar = selectedId ? characters[selectedId] : null;

  return (
    <div className="flex flex-col h-full">
      {(editTarget !== null || isAdding) && (
        <CharacterForm
          initial={editTarget ?? {}}
          onSave={saveCharacter}
          onClose={() => { setEditTarget(null); setIsAdding(false); }}
        />
      )}

      {/* Search + Add */}
      <div className="p-3 border-b border-gray-800 space-y-2">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="검색..."
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-red-500"
        />
        <button
          onClick={() => setIsAdding(true)}
          className="w-full py-1.5 text-xs text-red-500 hover:text-red-400 border border-dashed border-red-900 hover:border-red-700 rounded-lg transition-colors"
        >
          + 새 캐릭터
        </button>
      </div>

      {/* Character list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map(entry => (
          <div
            key={entry.id}
            onClick={() => setSelectedId(selectedId === entry.id ? null : entry.id)}
            className={`group flex items-center gap-2 px-3 py-2 cursor-pointer border-l-2 transition-all ${
              selectedId === entry.id
                ? 'bg-gray-800 border-l-2'
                : 'border-transparent hover:bg-gray-900/50'
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
              <p className="text-sm text-white truncate">{entry.name}</p>
              {entry.alias && <p className="text-xs text-gray-500 truncate">{entry.alias}</p>}
            </div>
            <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); handleEdit(entry); }}
                className="text-xs text-gray-500 hover:text-white px-1"
              >
                편집
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(entry); }}
                className="text-xs text-gray-500 hover:text-red-400 px-1"
              >
                삭제
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Selected character detail */}
      {selectedChar && selectedEntry && (
        <div className="border-t border-gray-800 p-3 space-y-2 max-h-72 overflow-y-auto">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full" style={{ backgroundColor: selectedEntry.color }} />
            <span className="text-sm font-medium text-white">{selectedChar.name}</span>
            {selectedChar.age && <span className="text-xs text-gray-500">({selectedChar.age})</span>}
          </div>
          {selectedChar.occupation && <p className="text-xs text-gray-400">{selectedChar.occupation}</p>}
          {selectedChar.drama.goal && (
            <div>
              <span className="text-xs text-gray-600">목표: </span>
              <span className="text-xs text-gray-300">{selectedChar.drama.goal}</span>
            </div>
          )}
          {selectedChar.drama.arc && (
            <div>
              <span className="text-xs text-gray-600">아크: </span>
              <span className="text-xs text-gray-300">{selectedChar.drama.arc}</span>
            </div>
          )}
          {selectedChar.personality.traits.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedChar.personality.traits.map(t => (
                <span key={t} className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded-full">{t}</span>
              ))}
            </div>
          )}

          {/* Scene appearances */}
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
                      className="w-full text-left flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                    >
                      <span className="text-xs font-mono text-red-400">S#{s.number}</span>
                      <span className="text-xs text-gray-400 truncate">{s.location}</span>
                      {s.status && (
                        <span className={`ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_BG_ACTIVE[s.status]}`} />
                      )}
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
