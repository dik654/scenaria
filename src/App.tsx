import { useState, useEffect } from 'react';
import { useProjectStore } from './store/projectStore';
import { useSceneStore } from './store/sceneStore';
import { useCharacterStore } from './store/characterStore';
import { fileIO } from './io';
import type { SceneIndex } from './types/scene';
import type { CharacterIndex } from './types/character';
import { StartScreen } from './components/StartScreen';
import { SceneNavigator } from './panels/SceneNavigator';
import { ScreenplayEditor } from './editor/ScreenplayEditor';
import { HistoryPanel } from './panels/HistoryPanel';
import { CharacterPanel } from './panels/CharacterPanel';
import { StoryPanel } from './panels/StoryPanel';
import { ConsistencyPanel } from './panels/ConsistencyPanel';
import { ExportPanel } from './panels/ExportPanel';

type SidePanel = 'none' | 'history' | 'characters' | 'story' | 'consistency' | 'export';

function MenuBar() {
  const { meta, historyManager } = useProjectStore();
  const { currentSceneId, index } = useSceneStore();
  const currentEntry = index.find((s) => s.id === currentSceneId);

  const title = [
    currentEntry ? `S#${currentEntry.number}. ${currentEntry.location}` : null,
    meta?.title,
    'Scenaria',
  ].filter(Boolean).join(' — ');

  useEffect(() => { document.title = title; }, [title]);

  return (
    <div className="flex items-center h-9 bg-gray-950 border-b border-gray-800 px-3 gap-3 flex-shrink-0 select-none">
      <span className="text-red-500 font-bold text-sm">씬아리아</span>
      <div className="w-px h-4 bg-gray-800" />
      <div className="flex gap-0.5">
        {['파일', '편집', '보기', '도구'].map((menu) => (
          <button key={menu} className="text-xs text-gray-500 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors">
            {menu}
          </button>
        ))}
      </div>
      <div className="flex-1" />
      {meta && (
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span>📌 {meta.title}</span>
          {currentEntry && <span>· S#{currentEntry.number}/{index.length}</span>}
        </div>
      )}
      <button
        onClick={async () => {
          if (!historyManager) return;
          const memo = prompt('저장 지점 메모 (Enter로 건너뛰기):') ?? undefined;
          await historyManager.createSavePoint(memo, false);
        }}
        title="저장 지점 만들기 (Ctrl+Shift+Enter)"
        className="text-xs text-gray-600 hover:text-green-400 px-2 py-1 rounded hover:bg-gray-800 transition-colors"
      >
        ● 저장 지점
      </button>
    </div>
  );
}

const PANEL_CONFIG = [
  { id: 'history' as SidePanel,     icon: '🕐', label: '내역',      width: 'w-64' },
  { id: 'characters' as SidePanel,  icon: '👤', label: '캐릭터',    width: 'w-72' },
  { id: 'story' as SidePanel,       icon: '📖', label: '이야기',    width: 'w-[480px]' },
  { id: 'consistency' as SidePanel, icon: '⚠️', label: '정합성',    width: 'w-72' },
  { id: 'export' as SidePanel,      icon: '↗️', label: '내보내기',  width: 'w-64' },
];

function RightSidebar({ panel, onClose }: { panel: SidePanel; onClose: () => void }) {
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
        {panel === 'history' && <HistoryPanel />}
        {panel === 'characters' && <CharacterPanel />}
        {panel === 'story' && <StoryPanel />}
        {panel === 'consistency' && <ConsistencyPanel />}
        {panel === 'export' && <ExportPanel />}
      </div>
    </div>
  );
}

function RightToolbar({ activePanel, onToggle }: { activePanel: SidePanel; onToggle: (p: SidePanel) => void }) {
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

function EditorLayout() {
  const { dirHandle } = useProjectStore();
  const { setIndex } = useSceneStore();
  const { setIndex: setCharIndex } = useCharacterStore();
  const [rightPanel, setRightPanel] = useState<SidePanel>('none');

  useEffect(() => {
    if (!dirHandle) return;
    Promise.all([
      fileIO.readJSON<SceneIndex>(dirHandle, 'screenplay/_index.json').catch(() => ({ scenes: [] })),
      fileIO.readJSON<CharacterIndex>(dirHandle, 'characters/_index.json').catch(() => ({ characters: [] })),
    ]).then(([sceneIdx, charIdx]) => {
      setIndex(sceneIdx.scenes);
      setCharIndex(charIdx.characters);
    }).catch(console.error);
  }, [dirHandle, setIndex, setCharIndex]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        const { historyManager } = useProjectStore.getState();
        if (historyManager) {
          const memo = prompt('저장 지점 메모:') ?? undefined;
          await historyManager.createSavePoint(memo, false);
        }
      }
      // Ctrl+Shift+S: new scene
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('scenaria:addScene'));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const togglePanel = (panel: SidePanel) =>
    setRightPanel(prev => prev === panel ? 'none' : panel);

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100 overflow-hidden">
      <MenuBar />
      <div className="flex flex-1 overflow-hidden">
        <SceneNavigator />
        <ScreenplayEditor />
        <RightSidebar panel={rightPanel} onClose={() => setRightPanel('none')} />
        <RightToolbar activePanel={rightPanel} onToggle={togglePanel} />
      </div>
    </div>
  );
}

export function App() {
  const { meta } = useProjectStore();
  const [isOpen, setIsOpen] = useState(false);

  if (!meta || !isOpen) {
    return <StartScreen onOpen={() => setIsOpen(true)} />;
  }
  return <EditorLayout />;
}
