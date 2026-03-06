import { useState } from 'react';
import type { Character } from '../../types/character';
import { nanoid } from 'nanoid';
import { DRAMA_FIELDS, COLORS } from './constants';

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

export function CharacterForm({
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
        <div className="flex items-center gap-3 p-4 border-b border-gray-800">
          <div
            className="w-8 h-8 rounded-full flex-shrink-0 cursor-pointer"
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

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {tab === 'basic' && (
            <>
              <FormRow label="아이디 (파일명)" hint="영문/숫자만">
                <input value={form.id} onChange={(e) => set('id', e.target.value)} className="form-input" />
              </FormRow>
              <FormRow label="별명/호칭">
                <input value={form.alias ?? ''} onChange={(e) => set('alias', e.target.value)} className="form-input" />
              </FormRow>
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="나이">
                  <input type="number" value={form.age ?? ''} onChange={(e) => set('age', Number(e.target.value))} className="form-input" />
                </FormRow>
                <FormRow label="성별">
                  <select value={form.gender ?? ''} onChange={(e) => set('gender', e.target.value)} className="form-input">
                    <option value="">-</option>
                    <option value="남">남</option>
                    <option value="여">여</option>
                    <option value="기타">기타</option>
                  </select>
                </FormRow>
              </div>
              <FormRow label="직업/역할">
                <input value={form.occupation ?? ''} onChange={(e) => set('occupation', e.target.value)} className="form-input" />
              </FormRow>
              <FormRow label="캐릭터 설명">
                <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} className="form-input" />
              </FormRow>
              <FormRow label="외모 묘사">
                <textarea value={form.visualDescription ?? ''} onChange={(e) => set('visualDescription', e.target.value)} rows={2} className="form-input" />
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

        <div className="p-4 border-t border-gray-800 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-600 rounded-lg text-sm text-gray-400 hover:bg-gray-800">
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
