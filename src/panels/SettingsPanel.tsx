import { useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { fileIO } from '../io';
import type { AppSettings } from '../types/project';

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

const THEMES = [
  { id: 'dark', label: '다크', preview: 'bg-gray-950' },
  { id: 'light', label: '라이트', preview: 'bg-white' },
  { id: 'sepia', label: '세피아', preview: 'bg-amber-50' },
] as const;

type SettingsTab = 'ai' | 'editor' | 'shortcuts';

export function SettingsPanel() {
  const { settings, setSettings, dirHandle } = useProjectStore();
  const [tab, setTab] = useState<SettingsTab>('ai');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (key: keyof AppSettings, val: unknown) => setSettings({ [key]: val });
  const setAI = (key: string, val: unknown) =>
    setSettings({ ai: { ...settings.ai, [key]: val } });

  const handleSave = async () => {
    if (!dirHandle) return;
    try {
      await fileIO.writeJSON(dirHandle, 'settings.json', settings);
      // Also save API key to localStorage (prototype)
      if (settings.ai.apiKey) {
        localStorage.setItem('scenaria_api_key', settings.ai.apiKey);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('설정 저장 실패:', err);
    }
  };

  // Load API key from localStorage on first render
  const storedKey = localStorage.getItem('scenaria_api_key');
  if (storedKey && !settings.ai.apiKey) {
    setAI('apiKey', storedKey);
  }

  const models = settings.ai.provider === 'claude' ? CLAUDE_MODELS
    : settings.ai.provider === 'openai' ? OPENAI_MODELS : [];

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-gray-800 flex-shrink-0">
        {([
          ['ai', 'AI 설정'],
          ['editor', '에디터'],
          ['shortcuts', '단축키'],
        ] as [SettingsTab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-2 text-xs transition-colors ${tab === t ? 'text-white border-b-2 border-red-500' : 'text-gray-500 hover:text-gray-300'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {tab === 'ai' && (
          <>
            {/* Provider */}
            <SettingRow label="AI 제공자">
              <select value={settings.ai.provider} onChange={e => setAI('provider', e.target.value)}
                className="form-input">
                {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </SettingRow>

            {/* API Key */}
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

            {/* Endpoint (local) */}
            {settings.ai.provider === 'local-vllm' && (
              <SettingRow label="엔드포인트">
                <input value={settings.ai.endpoint ?? 'http://localhost:8000'} onChange={e => setAI('endpoint', e.target.value)}
                  className="form-input" />
              </SettingRow>
            )}

            {/* Model */}
            {models.length > 0 ? (
              <SettingRow label="모델">
                <select value={settings.ai.model ?? models[0]} onChange={e => setAI('model', e.target.value)}
                  className="form-input">
                  {models.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </SettingRow>
            ) : (
              <SettingRow label="모델">
                <input value={settings.ai.model ?? ''} onChange={e => setAI('model', e.target.value)}
                  placeholder="모델명 직접 입력" className="form-input" />
              </SettingRow>
            )}

            {/* Quick actions */}
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
        )}

        {tab === 'editor' && (
          <>
            {/* Theme */}
            <SettingRow label="테마">
              <div className="flex gap-2">
                {THEMES.map(t => (
                  <button key={t.id} onClick={() => set('theme', t.id)}
                    className={`flex flex-col items-center gap-1 px-3 py-2 border rounded-lg transition-all ${
                      settings.theme === t.id ? 'border-red-500 text-white' : 'border-gray-700 text-gray-500 hover:border-gray-500'
                    }`}>
                    <div className={`w-8 h-5 rounded ${t.preview} border border-gray-600`} />
                    <span className="text-xs">{t.label}</span>
                  </button>
                ))}
              </div>
            </SettingRow>

            {/* Font size */}
            <SettingRow label={`글꼴 크기: ${settings.editorFontSize}pt`}>
              <input type="range" min={10} max={20} value={settings.editorFontSize}
                onChange={e => set('editorFontSize', Number(e.target.value))}
                className="w-full accent-red-500" />
            </SettingRow>

            {/* Line height */}
            <SettingRow label={`줄 간격: ${settings.lineHeight}`}>
              <input type="range" min={1.2} max={2.5} step={0.1} value={settings.lineHeight}
                onChange={e => set('lineHeight', Number(e.target.value))}
                className="w-full accent-red-500" />
            </SettingRow>

            {/* Scene header format */}
            <SettingRow label="씬 헤더 포맷">
              <select value={settings.sceneHeaderFormat} onChange={e => set('sceneHeaderFormat', e.target.value)}
                className="form-input">
                <option value="korean">S#1. 장소 - 시간</option>
                <option value="standard">S#1. INT. 장소 - 시간</option>
                <option value="compact">S#1. 장소 (시간)</option>
              </select>
            </SettingRow>

            {/* Dialogue alignment */}
            <SettingRow label="대사 정렬">
              <div className="flex gap-2">
                {([['center', '가운데'], ['left', '왼쪽']] as const).map(([val, label]) => (
                  <button key={val} onClick={() => set('dialogueAlignment', val)}
                    className={`flex-1 py-1.5 text-xs border rounded-lg transition-colors ${
                      settings.dialogueAlignment === val ? 'border-red-500 text-white bg-gray-800' : 'border-gray-700 text-gray-500'
                    }`}>{label}</button>
                ))}
              </div>
            </SettingRow>

            {/* Autosave interval */}
            <SettingRow label={`자동 저장 간격: ${settings.autosaveInterval / 1000}초`}>
              <input type="range" min={1000} max={10000} step={500} value={settings.autosaveInterval}
                onChange={e => set('autosaveInterval', Number(e.target.value))}
                className="w-full accent-red-500" />
            </SettingRow>
          </>
        )}

        {tab === 'shortcuts' && (
          <div className="space-y-2">
            <p className="text-xs text-gray-600 mb-3">기본 단축키 (변경 불가)</p>
            {[
              ['Ctrl+S', '씬 저장'],
              ['Ctrl+Shift+Enter', '저장 지점 만들기'],
              ['Ctrl+Shift+S', '새 씬'],
              ['Tab', '다음 블록 타입'],
              ['Shift+Tab', '블록 타입 변경'],
              ['Ctrl+Enter', '같은 캐릭터 대사 반복'],
              ['Ctrl+F', '찾기'],
              ['Ctrl+H', '찾기 및 바꾸기'],
              ['Ctrl+G', '씬 번호로 이동'],
              ['Ctrl+Shift+\\', '씬 분할 (선택 블록 기준)'],
              ['/', '슬래시 메뉴'],
              ['F', '집중 모드'],
              ['R', '읽기 모드'],
              ['T', '타자기 모드'],
            ].map(([key, desc]) => (
              <div key={key} className="flex items-center justify-between py-1.5 border-b border-gray-800">
                <span className="text-xs text-gray-400">{desc}</span>
                <kbd className="text-xs bg-gray-800 border border-gray-700 rounded px-2 py-0.5 font-mono text-gray-300">{key}</kbd>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="p-3 border-t border-gray-800">
        <button onClick={handleSave}
          className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
            saved ? 'bg-green-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'
          }`}>
          {saved ? '✓ 저장됨' : '설정 저장'}
        </button>
      </div>
    </div>
  );
}

function SettingRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1.5">
        {label}
        {hint && <span className="text-gray-600 ml-1">({hint})</span>}
      </label>
      {children}
    </div>
  );
}
