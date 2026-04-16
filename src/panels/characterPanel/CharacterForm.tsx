import { useState, useCallback } from 'react';
import type { Character } from '../../types/character';
import { nanoid } from 'nanoid';
import { DRAMA_FIELDS, COLORS } from './constants';
import { callAI, findBalancedJSON } from '../../ai/aiClient';
import { SYSTEM_CHAR_GEN } from '../../ai/prompts/characterGeneration';
import { useProjectStore } from '../../store/projectStore';

function FormRow({ label, hint, onAI, isGenerating, children }: {
  label: string; hint?: string; onAI?: () => void; isGenerating?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
        <span>{label}{hint && <span className="text-gray-700 ml-1">— {hint}</span>}</span>
        {onAI && (
          <button
            type="button"
            onClick={onAI}
            disabled={isGenerating}
            className="ml-auto text-[10px] text-blue-400 hover:text-blue-600 disabled:text-gray-300 transition-colors"
            title="AI로 생성"
          >
            {isGenerating ? '...' : '✦ AI'}
          </button>
        )}
      </label>
      {children}
    </div>
  );
}

function buildCharacterContext(form: Character): string {
  const parts: string[] = [];
  if (form.name) parts.push(`이름: ${form.name}`);
  if (form.alias) parts.push(`별명: ${form.alias}`);
  if (form.age) parts.push(`나이: ${form.age}`);
  if (form.gender) parts.push(`성별: ${form.gender}`);
  if (form.occupation) parts.push(`직업: ${form.occupation}`);
  if (form.description) parts.push(`설명: ${form.description}`);
  if (form.visualDescription) parts.push(`외모: ${form.visualDescription}`);
  if (form.personality.traits.length) parts.push(`성격: ${form.personality.traits.join(', ')}`);
  if (form.drama.goal) parts.push(`목표: ${form.drama.goal}`);
  if (form.drama.flaw) parts.push(`결점: ${form.drama.flaw}`);
  if (form.drama.arc) parts.push(`아크: ${form.drama.arc}`);
  if (form.personality.speechStyle) parts.push(`말투: ${form.personality.speechStyle}`);
  return parts.join('\n');
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
  const { settings } = useProjectStore();
  const [tab, setTab] = useState<'basic' | 'drama' | 'speech'>('basic');
  const [generating, setGenerating] = useState<string | null>(null);
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

  const [seedPrompt, setSeedPrompt] = useState('');
  const hasApiKey = !!settings.ai.apiKey || settings.ai.provider === 'local-vllm' || settings.ai.provider === 'claude-code';

  // 전체 캐릭터 AI 생성
  const generateFull = useCallback(async () => {
    if (!form.name.trim() || generating) return;
    setGenerating('full');
    try {
      const existingContext = buildCharacterContext(form);
      const seedSection = seedPrompt.trim()
        ? `\n작가 의도/컨셉:\n${seedPrompt.trim()}\n`
        : '';
      const contextSection = existingContext
        ? `\n이미 작성된 정보 (유지할 것):\n${existingContext}\n`
        : '';

      const prompt = `${seedSection}${contextSection}
위 내용을 바탕으로 한국 영화 시나리오용 캐릭터를 완성하라.
이미 작성된 필드는 반드시 유지. 비어있는 필드만 채워라.
${!seedPrompt.trim() && !form.description ? '완전히 독창적이고 예측 불가능한 캐릭터를 만들어라.' : ''}

JSON 형식:
{
  "name": "${form.name}",
  "alias": "별명",
  "age": 숫자,
  "gender": "남/여",
  "occupation": "직업",
  "description": "캐릭터 설명 (2-3문장)",
  "visualDescription": "외모 (1-2문장)",
  "traits": ["특성1", "특성2", "특성3"],
  "goal": "목표",
  "need": "필요",
  "flaw": "결점",
  "lie": "거짓말",
  "ghost": "트라우마",
  "arc": "변화 여정",
  "stakes": "위험",
  "speechStyle": "말투 스타일 설명",
  "speechExamples": ["예시 대사1", "예시 대사2", "예시 대사3"],
  "speechTaboos": "절대 안 쓰는 표현"
}

JSON만 출력. 설명 금지.`;

      const [result] = await callAI(settings.ai, SYSTEM_CHAR_GEN, prompt, 1, 2048);
      // Use balanced brace matching to ignore trailing metadata (Gemini grounding etc.)
      let jsonStr = findBalancedJSON(result);
      // 잘린 JSON 복구 시도: 닫히지 않은 중괄호/대괄호 닫기
      if (!jsonStr) {
        jsonStr = result.match(/\{[\s\S]*/)?.[0] ?? null;
        if (jsonStr) {
          jsonStr = jsonStr.replace(/,\s*"[^"]*$/, '');  // 잘린 키 제거
          jsonStr = jsonStr.replace(/,\s*$/, '');
          const opens = (jsonStr.match(/\[/g) || []).length - (jsonStr.match(/\]/g) || []).length;
          const braces = (jsonStr.match(/\{/g) || []).length - (jsonStr.match(/\}/g) || []).length;
          jsonStr += ']'.repeat(Math.max(0, opens)) + '}'.repeat(Math.max(0, braces));
        }
      }
      if (jsonStr) {
        const parsed = JSON.parse(jsonStr);
        setForm(f => ({
          ...f,
          alias: f.alias || parsed.alias || '',
          age: f.age || parsed.age,
          gender: f.gender || parsed.gender || '',
          occupation: f.occupation || parsed.occupation || '',
          description: f.description || parsed.description || '',
          visualDescription: f.visualDescription || parsed.visualDescription || '',
          personality: {
            traits: f.personality.traits.length ? f.personality.traits : (parsed.traits ?? []),
            speechStyle: f.personality.speechStyle || parsed.speechStyle || '',
            speechExamples: f.personality.speechExamples?.length ? f.personality.speechExamples : (parsed.speechExamples ?? []),
            speechTaboos: f.personality.speechTaboos || parsed.speechTaboos || '',
          },
          drama: {
            goal: f.drama.goal || parsed.goal || '',
            need: f.drama.need || parsed.need || '',
            flaw: f.drama.flaw || parsed.flaw || '',
            lie: f.drama.lie || parsed.lie || '',
            ghost: f.drama.ghost || parsed.ghost || '',
            arc: f.drama.arc || parsed.arc || '',
            stakes: f.drama.stakes || parsed.stakes || '',
          },
        }));
      }
    } catch (err) {
      console.error('AI 캐릭터 생성 실패:', err);
    } finally {
      setGenerating(null);
    }
  }, [form, seedPrompt, settings.ai, generating]);

  // 개별 필드 AI 생성
  const generateField = useCallback(async (fieldKey: string, fieldLabel: string, applyFn: (val: string) => void) => {
    if (generating) return;
    setGenerating(fieldKey);
    try {
      const context = buildCharacterContext(form);
      const prompt = `캐릭터 정보:\n${context}\n\n위 캐릭터의 "${fieldLabel}" 필드를 작성하라.\n텍스트만 출력. 설명/라벨 금지. 1-3문장으로 간결하게.`;
      const [result] = await callAI(settings.ai, SYSTEM_CHAR_GEN, prompt, 1);
      applyFn(result.trim());
    } catch (err) {
      console.error(`AI ${fieldLabel} 생성 실패:`, err);
    } finally {
      setGenerating(null);
    }
  }, [form, settings.ai, generating]);

  const generateTraits = useCallback(async () => {
    if (generating) return;
    setGenerating('traits');
    try {
      const context = buildCharacterContext(form);
      const prompt = `캐릭터 정보:\n${context}\n\n이 캐릭터의 성격 특성 3-5개를 쉼표로 구분해서 출력하라.\n특성 단어만 출력. 설명 금지.`;
      const [result] = await callAI(settings.ai, SYSTEM_CHAR_GEN, prompt, 1);
      const traits = result.split(/[,，、]/).map(s => s.trim()).filter(Boolean);
      if (traits.length) setPersonality('traits', traits);
    } catch (err) {
      console.error('AI 성격 특성 생성 실패:', err);
    } finally {
      setGenerating(null);
    }
  }, [form, settings.ai, generating]);

  const generateSpeechExamples = useCallback(async () => {
    if (generating) return;
    setGenerating('speechExamples');
    try {
      const context = buildCharacterContext(form);
      const prompt = `캐릭터 정보:\n${context}\n\n이 캐릭터의 말투 예시 대사 3개를 줄바꿈으로 구분해서 출력하라.\n대사만 출력. 번호/설명 금지.`;
      const [result] = await callAI(settings.ai, SYSTEM_CHAR_GEN, prompt, 1);
      const examples = result.split('\n').map(s => s.replace(/^\d+[.:)]\s*/, '').replace(/^[""]|[""]$/g, '').trim()).filter(Boolean);
      if (examples.length) setPersonality('speechExamples', examples);
    } catch (err) {
      console.error('AI 말투 예시 생성 실패:', err);
    } finally {
      setGenerating(null);
    }
  }, [form, settings.ai, generating]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-gray-200 rounded-xl w-full max-w-lg shadow-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center gap-3 p-4 border-b border-gray-100">
          <div
            className="w-8 h-8 rounded-full flex-shrink-0 cursor-pointer"
            style={{ backgroundColor: form.color, outline: `2px solid ${form.color}`, outlineOffset: '2px' }}
            title="색상 클릭으로 변경"
          />
          <input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="캐릭터 이름"
            className="flex-1 bg-transparent text-gray-800 text-lg font-medium focus:outline-none border-b border-transparent focus:border-gray-300"
          />
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {hasApiKey && (
          <div className="px-4 py-2 border-b border-gray-100 space-y-2">
            <textarea
              value={seedPrompt}
              onChange={(e) => setSeedPrompt(e.target.value)}
              placeholder="캐릭터 컨셉을 간단히 적으면 AI가 참고합니다 (비우면 완전 랜덤)"
              rows={2}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 placeholder-gray-400 resize-none focus:outline-none focus:border-blue-300"
            />
            <button
              onClick={generateFull}
              disabled={!form.name.trim() || !!generating}
              className="w-full py-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-lg transition-colors disabled:opacity-40"
            >
              {generating === 'full' ? '생성 중...' : '✦ AI로 전체 생성'}
            </button>
          </div>
        )}

        <div className="flex gap-2 px-4 py-2 border-b border-gray-100">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => set('color', c)}
              className={`w-5 h-5 rounded-full transition-transform ${form.color === c ? 'scale-125 ring-2 ring-white' : 'hover:scale-110'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <div className="flex border-b border-gray-100">
          {(['basic', 'drama', 'speech'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm transition-colors ${tab === t ? 'text-gray-800 border-b-2 border-blue-500 font-medium' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {t === 'basic' ? '기본 정보' : t === 'drama' ? '드라마' : '말투'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {tab === 'basic' && (
            <>
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
              <FormRow label="직업/역할"
                onAI={hasApiKey ? () => generateField('occupation', '직업/역할', v => set('occupation', v)) : undefined}
                isGenerating={generating === 'occupation'}>
                <input value={form.occupation ?? ''} onChange={(e) => set('occupation', e.target.value)} className="form-input" />
              </FormRow>
              <FormRow label="캐릭터 설명"
                onAI={hasApiKey ? () => generateField('description', '캐릭터 설명', v => set('description', v)) : undefined}
                isGenerating={generating === 'description'}>
                <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} className="form-input" />
              </FormRow>
              <FormRow label="외모 묘사"
                onAI={hasApiKey ? () => generateField('visualDescription', '외모 묘사', v => set('visualDescription', v)) : undefined}
                isGenerating={generating === 'visualDescription'}>
                <textarea value={form.visualDescription ?? ''} onChange={(e) => set('visualDescription', e.target.value)} rows={2} className="form-input" />
              </FormRow>
              <FormRow label="성격 특성 (쉼표로)"
                onAI={hasApiKey ? generateTraits : undefined}
                isGenerating={generating === 'traits'}>
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
                <FormRow key={key} label={label} hint={desc}
                  onAI={hasApiKey ? () => generateField(`drama.${key}`, label, v => setDrama(key, v)) : undefined}
                  isGenerating={generating === `drama.${key}`}>
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
              <FormRow label="말투 스타일"
                onAI={hasApiKey ? () => generateField('speechStyle', '말투 스타일', v => setPersonality('speechStyle', v)) : undefined}
                isGenerating={generating === 'speechStyle'}>
                <textarea
                  value={form.personality.speechStyle}
                  onChange={(e) => setPersonality('speechStyle', e.target.value)}
                  rows={3}
                  placeholder="예: 업무 중에는 간결한 존댓말. 격앙되면 짧은 문장."
                  className="form-input"
                />
              </FormRow>
              <FormRow label="말투 예시 (줄바꿈으로)"
                onAI={hasApiKey ? generateSpeechExamples : undefined}
                isGenerating={generating === 'speechExamples'}>
                <textarea
                  value={(form.personality.speechExamples ?? []).join('\n')}
                  onChange={(e) => setPersonality('speechExamples', e.target.value.split('\n').filter(Boolean))}
                  rows={4}
                  placeholder="한 줄에 한 예시씩"
                  className="form-input"
                />
              </FormRow>
              <FormRow label="절대 안 쓰는 표현"
                onAI={hasApiKey ? () => generateField('speechTaboos', '절대 안 쓰는 표현', v => setPersonality('speechTaboos', v)) : undefined}
                isGenerating={generating === 'speechTaboos'}>
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

        <div className="p-4 border-t border-gray-100 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50">
            취소
          </button>
          <button
            onClick={() => form.name.trim() && onSave(form)}
            disabled={!form.name.trim()}
            className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm text-white font-medium disabled:opacity-50"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
