import { useState } from 'react';
import {
  Clock,
  Users,
  BookOpen,
  AlertTriangle,
  Bot,
  Download,
  Settings,
  X,
  type LucideIcon,
} from 'lucide-react';
import { HistoryPanel } from '../panels/HistoryPanel';
import { CharacterPanel } from '../panels/CharacterPanel';
import { StoryPanel } from '../panels/StoryPanel';
import { ConsistencyPanel } from '../panels/ConsistencyPanel';
import { ExportPanel } from '../panels/ExportPanel';
import { SettingsPanel } from '../panels/SettingsPanel';
import { AIChat } from '../panels/AIChat';

export type SidePanel = 'none' | 'history' | 'characters' | 'story' | 'consistency' | 'export' | 'settings' | 'ai-chat';

export const PANEL_CONFIG: {
  id: SidePanel;
  icon: LucideIcon;
  label: string;
  width: string;
}[] = [
  { id: 'history',      icon: Clock,           label: '내역',      width: 'w-[420px]' },
  { id: 'characters',   icon: Users,           label: '캐릭터',    width: 'w-[420px]' },
  { id: 'story',        icon: BookOpen,        label: '이야기',    width: 'w-[520px]' },
  { id: 'consistency',  icon: AlertTriangle,   label: '정합성',    width: 'w-[420px]' },
  { id: 'ai-chat',      icon: Bot,             label: 'AI',        width: 'w-[420px]' },
  { id: 'export',       icon: Download,        label: '내보내기',  width: 'w-[420px]' },
  { id: 'settings',     icon: Settings,        label: '설정',      width: 'w-[420px]' },
];

export function RightSidebar({ panel, onClose }: { panel: SidePanel; onClose: () => void }) {
  if (panel === 'none') return null;
  const cfg = PANEL_CONFIG.find(p => p.id === panel);

  return (
    <div className={`${cfg?.width ?? 'w-64'} flex-shrink-0 border-l border-zinc-200/80 bg-white flex flex-col`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 flex-shrink-0">
        <span className="text-sm font-semibold text-zinc-700 tracking-tight">
          {cfg?.label}
        </span>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-hidden">
        {panel === 'history'     && <HistoryPanel />}
        {panel === 'characters'  && <CharacterPanel />}
        {panel === 'story'       && <StoryPanel />}
        {panel === 'consistency' && <ConsistencyPanel />}
        {panel === 'ai-chat'     && <AIChat />}
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
  const [hoveredId, setHoveredId] = useState<SidePanel | null>(null);

  return (
    <div className="flex flex-col border-l border-zinc-200/80 bg-zinc-50/50 py-2 px-1 gap-0.5">
      {PANEL_CONFIG.map(({ id, icon: Icon, label }) => {
        const isActive = activePanel === id;
        const isHovered = hoveredId === id;

        return (
          <div key={id} className="relative">
            <button
              title={label}
              onClick={() => onToggle(id)}
              onMouseEnter={() => setHoveredId(id)}
              onMouseLeave={() => setHoveredId(null)}
              className={`
                w-9 h-9 flex items-center justify-center rounded-lg transition-colors relative
                ${isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600'
                }
              `}
            >
              {/* Active left accent */}
              {isActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-blue-500" />
              )}
              <Icon size={18} strokeWidth={1.5} />
            </button>

            {/* Tooltip */}
            {isHovered && !isActive && (
              <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 px-2 py-1 text-[11px] font-medium text-white bg-zinc-800 rounded-lg shadow-lg whitespace-nowrap pointer-events-none z-50">
                {label}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
