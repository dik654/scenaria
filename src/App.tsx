import { useState, useEffect } from 'react';
import { useProjectStore } from './store/projectStore';
import { useSceneStore } from './store/sceneStore';
import { useCharacterStore } from './store/characterStore';
import { useStoryStore } from './store/storyStore';
import { fileIO } from './io';
import type { SceneIndex } from './types/scene';
import type { CharacterIndex } from './types/character';
import type { StoryStructure, ForeshadowingIndex } from './types/story';
import { StartScreen } from './components/StartScreen';
import { MenuBar } from './components/MenuBar';
import { RightSidebar, RightToolbar, type SidePanel } from './components/RightSidebar';
import { SceneNavigator } from './panels/SceneNavigator';
import { ScreenplayEditor } from './editor/ScreenplayEditor';
import { FindReplace } from './editor/widgets/FindReplace';
import { StatusBar } from './components/StatusBar';
import { ToastProvider } from './components/Toast';
import { ConfirmDialogProvider } from './components/ConfirmDialog';
import { PromptDialogProvider, usePrompt } from './components/PromptDialog';

type EditorMode = 'normal' | 'focus' | 'reading' | 'typewriter';

function useThemeClass() {
  const { settings } = useProjectStore();
  const theme = settings.theme ?? 'light';

  useEffect(() => {
    const el = document.documentElement;
    el.classList.remove('theme-dark', 'theme-light', 'theme-sepia');
    el.classList.add(`theme-${theme}`);
    return () => el.classList.remove(`theme-${theme}`);
  }, [theme]);

  return theme;
}

function EditorLayout() {
  const { projectRef } = useProjectStore();
  const { setIndex, index } = useSceneStore();
  const { setIndex: setCharIndex } = useCharacterStore();
  const prompt = usePrompt();
  const [rightPanel, setRightPanel] = useState<SidePanel>('none');
  const [editorMode, setEditorMode] = useState<EditorMode>('normal');
  const [showFind, setShowFind] = useState(false);
  const [findReplace, setFindReplace] = useState(false);

  // Load scene + character + story data when project opens
  useEffect(() => {
    if (!projectRef) return;

    // Reset story store before loading new project data
    const story = useStoryStore.getState();
    story.resetStory();

    Promise.all([
      fileIO.readJSON<SceneIndex>(projectRef, 'screenplay/_index.json').catch(() => ({ scenes: [] })),
      fileIO.readJSON<CharacterIndex>(projectRef, 'characters/_index.json').catch(() => ({ characters: [] })),
      fileIO.readJSON<StoryStructure>(projectRef, 'story/structure.json').catch(() => null),
      fileIO.readJSON<ForeshadowingIndex>(projectRef, 'story/foreshadowing.json').catch(() => ({ items: [] })),
      fileIO.readJSON<{ threads: { id: string; name: string; color: string; description: string; sceneIds: string[] }[] }>(
        projectRef, 'story/plot_threads.json'
      ).catch(() => ({ threads: [] })),
    ]).then(([sceneIdx, charIdx, structure, foreshadowing, threadData]) => {
      setIndex(sceneIdx.scenes);
      setCharIndex(charIdx.characters);

      // Load story data into storyStore
      const { setStructure, setForeshadowing, setThreadIndex, loadThread } = useStoryStore.getState();
      if (structure) setStructure(structure);
      if (foreshadowing) setForeshadowing(foreshadowing);

      // Load threads from legacy plot_threads.json
      if (threadData.threads.length > 0) {
        setThreadIndex(threadData.threads.map(t => ({ id: t.id, filename: `${t.id}.json`, name: t.name })));
        for (const t of threadData.threads) {
          loadThread(t.id, {
            id: t.id,
            name: t.name,
            color: t.color,
            description: t.description ?? '',
            characterIds: [],
            eventIds: [],
            sceneIds: t.sceneIds ?? [],
          });
        }
      }
    }).catch(console.error);
  }, [projectRef, setIndex, setCharIndex]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        const { historyManager } = useProjectStore.getState();
        if (historyManager) {
          const memo = await prompt({ message: '저장 지점 메모:', placeholder: '선택사항' }) ?? undefined;
          await historyManager.createSavePoint(memo || undefined, false);
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
        const num = await prompt({ message: '씬 번호로 이동:', placeholder: '번호 입력' });
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
  const theme = useThemeClass();

  // Override theme on <html> for reading mode
  useEffect(() => {
    if (!isReading) return;
    const el = document.documentElement;
    el.classList.remove(`theme-${theme}`);
    el.classList.add('theme-sepia');
    return () => {
      el.classList.remove('theme-sepia');
      el.classList.add(`theme-${theme}`);
    };
  }, [isReading, theme]);

  const activeTheme = isReading ? 'sepia' : theme;
  const bgClass = activeTheme === 'dark' ? 'bg-gray-950 text-gray-100' : '';

  return (
    <div className={`flex flex-col h-screen overflow-hidden transition-colors ${bgClass}`}>
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

      {!isFocus && !isReading && <StatusBar />}

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

  // Apply default theme on <html> even before project opens
  useEffect(() => {
    const el = document.documentElement;
    if (!el.classList.contains('theme-dark') && !el.classList.contains('theme-light') && !el.classList.contains('theme-sepia')) {
      el.classList.add('theme-light');
    }
  }, []);

  if (!meta || !isOpen) return (
    <ToastProvider>
      <ConfirmDialogProvider>
        <PromptDialogProvider>
          <StartScreen onOpen={() => setIsOpen(true)} />
        </PromptDialogProvider>
      </ConfirmDialogProvider>
    </ToastProvider>
  );
  return (
    <ToastProvider>
      <ConfirmDialogProvider>
        <PromptDialogProvider>
          <EditorLayout />
        </PromptDialogProvider>
      </ConfirmDialogProvider>
    </ToastProvider>
  );
}
