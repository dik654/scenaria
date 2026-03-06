import { useState, useEffect } from 'react';
import { useProjectStore } from './store/projectStore';
import { useSceneStore } from './store/sceneStore';
import { useCharacterStore } from './store/characterStore';
import { fileIO } from './io';
import type { SceneIndex } from './types/scene';
import type { CharacterIndex } from './types/character';
import { StartScreen } from './components/StartScreen';
import { MenuBar } from './components/MenuBar';
import { RightSidebar, RightToolbar, type SidePanel } from './components/RightSidebar';
import { SceneNavigator } from './panels/SceneNavigator';
import { ScreenplayEditor } from './editor/ScreenplayEditor';
import { FindReplace } from './editor/widgets/FindReplace';

type EditorMode = 'normal' | 'focus' | 'reading' | 'typewriter';

function EditorLayout() {
  const { dirHandle } = useProjectStore();
  const { setIndex, index } = useSceneStore();
  const { setIndex: setCharIndex } = useCharacterStore();
  const [rightPanel, setRightPanel] = useState<SidePanel>('none');
  const [editorMode, setEditorMode] = useState<EditorMode>('normal');
  const [showFind, setShowFind] = useState(false);
  const [findReplace, setFindReplace] = useState(false);

  // Load scene + character index when project opens
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
        return;
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('scenaria:addScene'));
        return;
      }
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        setFindReplace(false);
        setShowFind(true);
        return;
      }
      if (e.ctrlKey && e.key === 'h') {
        e.preventDefault();
        setFindReplace(true);
        setShowFind(true);
        return;
      }
      if (e.ctrlKey && e.key === 'g') {
        e.preventDefault();
        const num = prompt('씬 번호로 이동:');
        if (!num) return;
        const entry = useSceneStore.getState().index.find(s => s.number === Number(num));
        if (entry) window.dispatchEvent(new CustomEvent('scenaria:gotoScene', { detail: entry.id }));
        return;
      }
      if (e.key === 'Escape') {
        if (showFind) { setShowFind(false); return; }
        if (editorMode !== 'normal') { setEditorMode('normal'); return; }
      }
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.key === 'f' || e.key === 'F') setEditorMode(m => m === 'focus' ? 'normal' : 'focus');
      if (e.key === 'r' || e.key === 'R') setEditorMode(m => m === 'reading' ? 'normal' : 'reading');
      if (e.key === 't' || e.key === 'T') setEditorMode(m => m === 'typewriter' ? 'normal' : 'typewriter');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showFind, editorMode]);

  // Scene navigation by number (dispatched from MenuBar)
  useEffect(() => {
    const handler = (e: Event) => {
      const num = (e as CustomEvent<number>).detail;
      const entry = index.find(s => s.number === num);
      if (entry) window.dispatchEvent(new CustomEvent('scenaria:gotoScene', { detail: entry.id }));
    };
    window.addEventListener('scenaria:gotoSceneByNumber', handler);
    return () => window.removeEventListener('scenaria:gotoSceneByNumber', handler);
  }, [index]);

  const togglePanel = (panel: SidePanel) =>
    setRightPanel(prev => prev === panel ? 'none' : panel);

  const isFocus = editorMode === 'focus';
  const isReading = editorMode === 'reading';

  return (
    <div className={`flex flex-col h-screen text-gray-100 overflow-hidden transition-colors ${isReading ? 'bg-amber-950' : 'bg-gray-950'}`}>
      {!isFocus && (
        <MenuBar
          mode={editorMode}
          onModeChange={setEditorMode}
          onFindOpen={(replace) => { setFindReplace(!!replace); setShowFind(true); }}
          onTogglePanel={togglePanel}
        />
      )}

      <div className="flex flex-1 overflow-hidden">
        {!isFocus && !isReading && <SceneNavigator />}

        <div className={`flex-1 flex flex-col overflow-hidden relative ${isFocus ? 'max-w-2xl mx-auto w-full' : ''}`}>
          <ScreenplayEditor mode={editorMode} readOnly={isReading} />
          {isFocus && (
            <div className="absolute top-2 right-2 text-xs text-gray-700">Esc로 일반 모드</div>
          )}
        </div>

        {!isFocus && !isReading && (
          <>
            <RightSidebar panel={rightPanel} onClose={() => setRightPanel('none')} />
            <RightToolbar activePanel={rightPanel} onToggle={togglePanel} />
          </>
        )}
      </div>

      {showFind && (
        <FindReplace
          onClose={() => setShowFind(false)}
          initialReplace={findReplace}
          onNavigate={(sceneId) => window.dispatchEvent(new CustomEvent('scenaria:gotoScene', { detail: sceneId }))}
        />
      )}

      {isReading && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-amber-900/80 border border-amber-700 rounded-full px-4 py-1.5 text-xs text-amber-200 z-50">
          읽기 모드 · R 또는 Esc로 종료
        </div>
      )}
    </div>
  );
}

export function App() {
  const { meta } = useProjectStore();
  const [isOpen, setIsOpen] = useState(false);

  if (!meta || !isOpen) return <StartScreen onOpen={() => setIsOpen(true)} />;
  return <EditorLayout />;
}
