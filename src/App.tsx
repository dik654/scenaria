import { useState, useEffect, useCallback } from 'react';
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

type SidePanel = 'none' | 'history' | 'characters' | 'story';

function MenuBar() {
  const { meta, historyManager } = useProjectStore();
  const { currentSceneId, index } = useSceneStore();
  const currentEntry = index.find((s) => s.id === currentSceneId);

  const handleCreateSavePoint = async () => {
    if (!historyManager) return;
    const memo = prompt('저장 지점 메모:') ?? undefined;
    await historyManager.createSavePoint(memo, false);
  };

  const title = [
    currentEntry ? `S#${currentEntry.number}. ${currentEntry.location}` : null,
    meta?.title,
    'Scenaria',
  ].filter(Boolean).join(' - ');

  useEffect(() => {
    document.title = title;
  }, [title]);

  return (
    <div className="flex items-center h-9 bg-gray-950 border-b border-gray-800 px-3 gap-4 flex-shrink-0 select-none">
      <span className="text-red-500 font-bold text-sm mr-2">씬</span>

      <div className="flex gap-1">
        {['파일', '편집', '보기', '도구', '내역', '도움말'].map((menu) => (
          <button
            key={menu}
            className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors"
          >
            {menu}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      {meta && (
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <span>📌 {meta.title}</span>
          {currentEntry && (
            <>
              <span>·</span>
              <span>S#{currentEntry.number}/{index.length}</span>
            </>
          )}
        </div>
      )}

      <button
        onClick={handleCreateSavePoint}
        title="저장 지점 만들기 (Ctrl+Shift+Enter)"
        className="text-xs text-gray-600 hover:text-green-400 px-2 py-1 rounded hover:bg-gray-800 transition-colors"
      >
        ● 저장 지점
      </button>
    </div>
  );
}

function RightSidebar({ panel, onClose }: { panel: SidePanel; onClose: () => void }) {
  if (panel === 'none') return null;

  return (
    <div className="w-64 flex-shrink-0 border-l border-gray-800 bg-gray-900 flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          {panel === 'history' ? '내역' : panel === 'characters' ? '캐릭터' : '이야기'}
        </span>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-400">✕</button>
      </div>
      <div className="flex-1 overflow-hidden">
        {panel === 'history' && <HistoryPanel />}
        {panel === 'characters' && (
          <div className="p-4 text-xs text-gray-600">캐릭터 패널 (Phase 1.5)</div>
        )}
        {panel === 'story' && (
          <div className="p-4 text-xs text-gray-600">이야기 패널 (Phase 1.5)</div>
        )}
      </div>
    </div>
  );
}

function RightToolbar({ activePanel, onToggle }: {
  activePanel: SidePanel;
  onToggle: (panel: SidePanel) => void;
}) {
  const buttons = [
    { id: 'history' as SidePanel, icon: '🕐', label: '내역' },
    { id: 'characters' as SidePanel, icon: '👤', label: '캐릭터' },
    { id: 'story' as SidePanel, icon: '📖', label: '이야기' },
  ];

  return (
    <div className="flex flex-col border-l border-gray-800 bg-gray-950">
      {buttons.map(({ id, icon, label }) => (
        <button
          key={id}
          title={label}
          onClick={() => onToggle(id)}
          className={`w-10 h-10 flex items-center justify-center text-base transition-colors ${
            activePanel === id
              ? 'text-white bg-gray-800'
              : 'text-gray-600 hover:text-gray-300 hover:bg-gray-900'
          }`}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

function EditorLayout() {
  const { dirHandle, meta } = useProjectStore();
  const { setIndex } = useSceneStore();
  const { setIndex: setCharIndex } = useCharacterStore();
  const [rightPanel, setRightPanel] = useState<SidePanel>('none');

  // Load scene and character indexes on mount
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

  // Ctrl+Shift+Enter → create save point
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
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const togglePanel = (panel: SidePanel) => {
    setRightPanel((prev) => prev === panel ? 'none' : panel);
  };

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
