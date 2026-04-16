import { useState, useEffect } from 'react';
import type { AppSettings } from '../../types/project';
import { SettingRow } from './SettingRow';
import { isElectron } from '../../platform/env';

const PROVIDERS: { id: string; label: string; electronOnly?: boolean }[] = [
  { id: 'claude-code', label: 'Claude Code (구독)', electronOnly: true },
  { id: 'claude', label: 'Claude (API 키)' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'local-vllm', label: '로컬 vLLM' },
];

const CLAUDE_CODE_MODELS = [
  'sonnet',
  'opus',
  'haiku',
];

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
  const [ccAuth, setCCAuth] = useState<{ loggedIn: boolean; email?: string; subscriptionType?: string } | null>(null);

  // Check Claude Code auth status when provider is selected
  useEffect(() => {
    if (settings.ai.provider === 'claude-code' && isElectron()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ipc = (window as any).__ELECTRON_IPC__;
      ipc?.claudeCode?.authStatus?.()
        .then((r: typeof ccAuth) => setCCAuth(r))
        .catch(() => setCCAuth({ loggedIn: false }));
    }
  }, [settings.ai.provider]);

  const inElectron = isElectron();
  const availableProviders = PROVIDERS.filter(p => !p.electronOnly || inElectron);

  const models = settings.ai.provider === 'claude-code' ? CLAUDE_CODE_MODELS
    : settings.ai.provider === 'claude' ? CLAUDE_MODELS
    : settings.ai.provider === 'openai' ? OPENAI_MODELS : [];

  return (
    <>
      <SettingRow label="AI 제공자">
        <select value={settings.ai.provider} onChange={e => {
          const newProvider = e.target.value;
          setAI('provider', newProvider);
          // 프로바이더 변경 시 해당 프로바이더의 기본 모델로 리셋
          const defaults: Record<string, string> = {
            'claude-code': 'sonnet',
            claude: 'claude-sonnet-4-6',
            openai: 'gpt-4o',
            'local-vllm': '',
          };
          setAI('model', defaults[newProvider] ?? '');
        }} className="form-input">
          {availableProviders.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </SettingRow>

      {settings.ai.provider === 'claude-code' && ccAuth && (
        <SettingRow label="계정 상태">
          {ccAuth.loggedIn ? (
            <span className="text-xs text-green-600">
              ✓ 로그인됨 — {ccAuth.email} ({ccAuth.subscriptionType})
            </span>
          ) : (
            <span className="text-xs text-red-500">
              ✗ 로그인 필요 — 터미널에서 <code className="bg-gray-100 px-1 rounded">claude login</code> 실행
            </span>
          )}
        </SettingRow>
      )}

      {settings.ai.provider !== 'local-vllm' && settings.ai.provider !== 'claude-code' && (
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
              className="text-xs text-gray-500 hover:text-gray-700 px-2 border border-gray-200 rounded-lg">
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

      <SettingRow label="자동 분석" hint="씬 저장 시 요약/스레드/복선 자동 감지">
        <button
          onClick={() => setAI('autoAnalysis', !(settings.ai.autoAnalysis !== false))}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            settings.ai.autoAnalysis !== false ? 'bg-blue-500' : 'bg-gray-300'
          }`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            settings.ai.autoAnalysis !== false ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
      </SettingRow>

      {settings.ai.provider === 'local-vllm' && (
        <SettingRow label="컨텍스트 윈도우" hint="모델의 최대 입력 토큰 수 (미설정 시 8192)">
          <input
            type="number"
            min={1024}
            step={1024}
            value={settings.ai.contextWindow ?? ''}
            onChange={e => setAI('contextWindow', e.target.value ? Number(e.target.value) : undefined)}
            placeholder="8192"
            className="form-input w-32"
          />
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
