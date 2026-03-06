import { useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { fileIO } from '../io';
import type { AppSettings } from '../types/project';
import { AISettingsTab } from './settingsPanel/AISettingsTab';
import { EditorSettingsTab } from './settingsPanel/EditorSettingsTab';
import { ShortcutsTab } from './settingsPanel/ShortcutsTab';

type SettingsTab = 'ai' | 'editor' | 'shortcuts';

export function SettingsPanel() {
  const { settings, setSettings, dirHandle } = useProjectStore();
  const [tab, setTab] = useState<SettingsTab>('ai');
  const [saved, setSaved] = useState(false);

  const set = (key: keyof AppSettings, val: unknown) => setSettings({ [key]: val });
  const setAI = (key: string, val: unknown) => setSettings({ ai: { ...settings.ai, [key]: val } });

  // Load API key from localStorage on first render
  const storedKey = localStorage.getItem('scenaria_api_key');
  if (storedKey && !settings.ai.apiKey) setAI('apiKey', storedKey);

  const handleSave = async () => {
    if (!dirHandle) return;
    try {
      await fileIO.writeJSON(dirHandle, 'settings.json', settings);
      if (settings.ai.apiKey) localStorage.setItem('scenaria_api_key', settings.ai.apiKey);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('설정 저장 실패:', err);
    }
  };

  return (
    <div className="flex flex-col h-full">
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
        {tab === 'ai' && <AISettingsTab settings={settings} set={set} setAI={setAI} />}
        {tab === 'editor' && <EditorSettingsTab settings={settings} set={set} />}
        {tab === 'shortcuts' && <ShortcutsTab />}
      </div>

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
