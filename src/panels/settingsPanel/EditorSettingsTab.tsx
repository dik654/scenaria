import type { AppSettings } from '../../types/project';
import { SettingRow } from './SettingRow';

const THEMES = [
  { id: 'dark', label: '다크', preview: 'bg-gray-950' },
  { id: 'light', label: '라이트', preview: 'bg-white' },
  { id: 'sepia', label: '세피아', preview: 'bg-amber-50' },
] as const;

interface EditorSettingsTabProps {
  settings: AppSettings;
  set: (key: keyof AppSettings, val: unknown) => void;
}

export function EditorSettingsTab({ settings, set }: EditorSettingsTabProps) {
  return (
    <>
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

      <SettingRow label={`글꼴 크기: ${settings.editorFontSize}pt`}>
        <input type="range" min={10} max={20} value={settings.editorFontSize}
          onChange={e => set('editorFontSize', Number(e.target.value))}
          className="w-full accent-red-500" />
      </SettingRow>

      <SettingRow label={`줄 간격: ${settings.lineHeight}`}>
        <input type="range" min={1.2} max={2.5} step={0.1} value={settings.lineHeight}
          onChange={e => set('lineHeight', Number(e.target.value))}
          className="w-full accent-red-500" />
      </SettingRow>

      <SettingRow label="씬 헤더 포맷">
        <select value={settings.sceneHeaderFormat} onChange={e => set('sceneHeaderFormat', e.target.value)} className="form-input">
          <option value="korean">S#1. 장소 - 시간</option>
          <option value="standard">S#1. INT. 장소 - 시간</option>
          <option value="compact">S#1. 장소 (시간)</option>
        </select>
      </SettingRow>

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

      <SettingRow label={`자동 저장 간격: ${settings.autosaveInterval / 1000}초`}>
        <input type="range" min={1000} max={10000} step={500} value={settings.autosaveInterval}
          onChange={e => set('autosaveInterval', Number(e.target.value))}
          className="w-full accent-red-500" />
      </SettingRow>
    </>
  );
}
