import { useState } from 'react';
import type { AppSettings } from '../../types/project';
import { SettingRow } from './SettingRow';

const PROVIDERS = [
  { id: 'claude', label: 'Claude (Anthropic)' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'local-vllm', label: '로컬 vLLM' },
] as const;

const CLAUDE_MODELS = [
  'claude-sonnet-4-6',
  'claude-opus-4-6',
  'claude-haiku-4-5-20251001',
];

const OPENAI_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'];

interface AISettingsTabProps {
  settings: AppSettings;
  set: (key: keyof AppSettings, val: unknown) => void;
  setAI: (key: string, val: unknown) => void;
}

export function AISettingsTab({ settings, set, setAI }: AISettingsTabProps) {
  const [showKey, setShowKey] = useState(false);

  const models = settings.ai.provider === 'claude' ? CLAUDE_MODELS
    : settings.ai.provider === 'openai' ? OPENAI_MODELS : [];

  return (
    <>
      <SettingRow label="AI 제공자">
        <select value={settings.ai.provider} onChange={e => setAI('provider', e.target.value)} className="form-input">
          {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </SettingRow>

      {settings.ai.provider !== 'local-vllm' && (
        <SettingRow label="API 키" hint="localStorage에 저장됩니다">
          <div className="flex gap-2">
            <input
              type={showKey ? 'text' : 'password'}
              value={settings.ai.apiKey ?? ''}
              onChange={e => setAI('apiKey', e.target.value)}
              placeholder={settings.ai.provider === 'claude' ? 'sk-ant-...' : 'sk-...'}
              className="form-input flex-1"
            />
            <button onClick={() => setShowKey(s => !s)}
              className="text-xs text-gray-500 hover:text-gray-300 px-2 border border-gray-700 rounded-lg">
              {showKey ? '숨김' : '표시'}
            </button>
          </div>
        </SettingRow>
      )}

      {settings.ai.provider === 'local-vllm' && (
        <SettingRow label="엔드포인트">
          <input value={settings.ai.endpoint ?? 'http://localhost:8000'} onChange={e => setAI('endpoint', e.target.value)}
            className="form-input" />
        </SettingRow>
      )}

      {models.length > 0 ? (
        <SettingRow label="모델">
          <select value={settings.ai.model ?? models[0]} onChange={e => setAI('model', e.target.value)} className="form-input">
            {models.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </SettingRow>
      ) : (
        <SettingRow label="모델">
          <input value={settings.ai.model ?? ''} onChange={e => setAI('model', e.target.value)}
            placeholder="모델명 직접 입력" className="form-input" />
        </SettingRow>
      )}

      <div>
        <p className="text-xs text-gray-500 mb-2">빠른 액션 (쉼표로 구분하여 편집)</p>
        <div className="space-y-1.5">
          {settings.quickActions.map((qa, i) => (
            <div key={qa.id} className="flex gap-1 items-start">
              <input value={qa.label} onChange={e => {
                const newQA = [...settings.quickActions];
                newQA[i] = { ...qa, label: e.target.value };
                set('quickActions', newQA);
              }} placeholder="라벨" className="form-input w-28 text-xs flex-shrink-0" />
              <input value={qa.prompt} onChange={e => {
                const newQA = [...settings.quickActions];
                newQA[i] = { ...qa, prompt: e.target.value };
                set('quickActions', newQA);
              }} placeholder="프롬프트" className="form-input text-xs flex-1" />
              <button onClick={() => set('quickActions', settings.quickActions.filter((_, j) => j !== i))}
                className="text-gray-600 hover:text-red-400 px-1 pt-1.5 text-xs">✕</button>
            </div>
          ))}
          <button onClick={() => set('quickActions', [...settings.quickActions, { id: `qa-${Date.now()}`, label: '', prompt: '' }])}
            className="text-xs text-gray-600 hover:text-gray-400">+ 빠른 액션 추가</button>
        </div>
      </div>
    </>
  );
}
