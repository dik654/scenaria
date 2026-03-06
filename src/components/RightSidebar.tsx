import { HistoryPanel } from '../panels/HistoryPanel';
import { CharacterPanel } from '../panels/CharacterPanel';
import { StoryPanel } from '../panels/StoryPanel';
import { ConsistencyPanel } from '../panels/ConsistencyPanel';
import { ExportPanel } from '../panels/ExportPanel';
import { SettingsPanel } from '../panels/SettingsPanel';

export type SidePanel = 'none' | 'history' | 'characters' | 'story' | 'consistency' | 'export' | 'settings';

export const PANEL_CONFIG = [
  { id: 'history' as SidePanel,     icon: '🕐', label: '내역',      width: 'w-64' },
  { id: 'characters' as SidePanel,  icon: '👤', label: '캐릭터',    width: 'w-72' },
  { id: 'story' as SidePanel,       icon: '📖', label: '이야기',    width: 'w-[520px]' },
  { id: 'consistency' as SidePanel, icon: '⚠️', label: '정합성',    width: 'w-72' },
  { id: 'export' as SidePanel,      icon: '↗️', label: '내보내기',  width: 'w-64' },
  { id: 'settings' as SidePanel,    icon: '⚙️', label: '설정',      width: 'w-80' },
];

export function RightSidebar({ panel, onClose }: { panel: SidePanel; onClose: () => void }) {
  if (panel === 'none') return null;
  const cfg = PANEL_CONFIG.find(p => p.id === panel);

  return (
    <div className={`${cfg?.width ?? 'w-64'} flex-shrink-0 border-l border-gray-800 bg-gray-900 flex flex-col`}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 flex-shrink-0">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          {cfg?.icon} {cfg?.label}
        </span>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-400 text-xs">✕</button>
      </div>
      <div className="flex-1 overflow-hidden">
        {panel === 'history'     && <HistoryPanel />}
        {panel === 'characters'  && <CharacterPanel />}
        {panel === 'story'       && <StoryPanel />}
        {panel === 'consistency' && <ConsistencyPanel />}
        {panel === 'export'      && <ExportPanel />}
        {panel === 'settings'    && <SettingsPanel />}
      </div>
    </div>
  );
}

export function RightToolbar({ activePanel, onToggle }: {
  activePanel: SidePanel;
  onToggle: (p: SidePanel) => void;
}) {
  return (
    <div className="flex flex-col border-l border-gray-800 bg-gray-950 py-1">
      {PANEL_CONFIG.map(({ id, icon, label }) => (
        <button
          key={id}
          title={label}
          onClick={() => onToggle(id)}
          className={`w-10 h-10 flex items-center justify-center text-sm transition-colors ${
            activePanel === id ? 'text-white bg-gray-800' : 'text-gray-600 hover:text-gray-300 hover:bg-gray-900'
          }`}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}
