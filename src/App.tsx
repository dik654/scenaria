import { useState, useEffect, useRef } from 'react';
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
import { SettingsPanel } from './panels/SettingsPanel';
import { FindReplace } from './editor/widgets/FindReplace';

type SidePanel = 'none' | 'history' | 'characters' | 'story' | 'consistency' | 'export' | 'settings';
type EditorMode = 'normal' | 'focus' | 'reading' | 'typewriter';

const PANEL_CONFIG = [
  { id: 'history' as SidePanel,     icon: '🕐', label: '내역',      width: 'w-64' },
  { id: 'characters' as SidePanel,  icon: '👤', label: '캐릭터',    width: 'w-72' },
  { id: 'story' as SidePanel,       icon: '📖', label: '이야기',    width: 'w-[520px]' },
  { id: 'consistency' as SidePanel, icon: '⚠️', label: '정합성',    width: 'w-72' },
  { id: 'export' as SidePanel,      icon: '↗️', label: '내보내기',  width: 'w-64' },
  { id: 'settings' as SidePanel,    icon: '⚙️', label: '설정',      width: 'w-80' },
];

// ── Dropdown menu types ──────────────────────────────────────────────────────
type MenuSep = { separator: true };
type MenuAction = { label: string; shortcut?: string; action: () => void; disabled?: boolean };
type MenuItem = MenuSep | MenuAction;

function DropdownMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`text-xs px-2 py-1 rounded transition-colors ${open ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}
      >
        {label}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-0.5 z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl py-1 min-w-44">
          {items.map((item, i) =>
            'separator' in item ? (
              <div key={i} className="border-t border-gray-700 my-0.5" />
            ) : (
              <button
                key={i}
                disabled={item.disabled}
                onClick={() => { item.action(); setOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 hover:text-white flex items-center justify-between gap-4 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>{item.label}</span>
                {item.shortcut && <kbd className="text-gray-600 font-mono text-xs">{item.shortcut}</kbd>}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

function MenuBar({
  onModeChange,
  mode,
  onFindOpen,
  onTogglePanel,
}: {
  onModeChange: (m: EditorMode) => void;
  mode: EditorMode;
  onFindOpen: (replace?: boolean) => void;
  onTogglePanel: (p: SidePanel) => void;
}) {
  const { meta, historyManager, clearProject } = useProjectStore();
  const { currentSceneId, index } = useSceneStore();
  const currentEntry = index.find(s => s.id === currentSceneId);

  const title = [
    currentEntry ? `S#${currentEntry.number}. ${currentEntry.location}` : null,
    meta?.title,
    'Scenaria',
  ].filter(Boolean).join(' — ');

  useEffect(() => { document.title = title; }, [title]);

  const createSavePoint = async () => {
    if (!historyManager) return;
    const memo = prompt('저장 지점 메모 (Enter 건너뛰기):') ?? undefined;
    await historyManager.createSavePoint(memo, false);
  };

  const fileItems: MenuItem[] = [
    { label: '새 프로젝트', action: () => clearProject() },
    { label: '프로젝트 열기', action: () => clearProject() },
    { separator: true },
    { label: '저장 지점 만들기', shortcut: 'Ctrl+⇧+Enter', action: createSavePoint, disabled: !historyManager },
    { separator: true },
    { label: '시작 화면으로', action: () => clearProject() },
  ];

  const editItems: MenuItem[] = [
    { label: '찾기', shortcut: 'Ctrl+F', action: () => onFindOpen(false) },
    { label: '찾기 및 바꾸기', shortcut: 'Ctrl+H', action: () => onFindOpen(true) },
    { separator: true },
    { label: '씬 번호로 이동', shortcut: 'Ctrl+G', action: () => { const n = prompt('씬 번호:'); if (!n) return; window.dispatchEvent(new CustomEvent('scenaria:gotoSceneByNumber', { detail: Number(n) })); } },
    { label: '새 씬 추가', shortcut: 'Ctrl+⇧+S', action: () => window.dispatchEvent(new CustomEvent('scenaria:addScene')) },
    { separator: true },
    { label: '씬 분할 (선택 블록)', shortcut: 'Ctrl+⇧+\\', action: () => window.dispatchEvent(new CustomEvent('scenaria:splitScene')) },
  ];

  const viewItems: MenuItem[] = [
    { label: '편집 모드', action: () => onModeChange('normal') },
    { label: '집중 모드', shortcut: 'F', action: () => onModeChange(mode === 'focus' ? 'normal' : 'focus') },
    { label: '읽기 모드', shortcut: 'R', action: () => onModeChange(mode === 'reading' ? 'normal' : 'reading') },
    { label: '타자기 모드', shortcut: 'T', action: () => onModeChange(mode === 'typewriter' ? 'normal' : 'typewriter') },
    { separator: true },
    { label: '이력 패널', action: () => onTogglePanel('history') },
    { label: '캐릭터 패널', action: () => onTogglePanel('characters') },
    { label: '이야기 패널', action: () => onTogglePanel('story') },
  ];

  const toolItems: MenuItem[] = [
    { label: '정합성 검사', action: () => onTogglePanel('consistency') },
    { label: '내보내기', action: () => onTogglePanel('export') },
    { separator: true },
    { label: 'AI / 설정', action: () => onTogglePanel('settings') },
  ];

  return (
    <div className="flex items-center h-9 bg-gray-950 border-b border-gray-800 px-3 gap-3 flex-shrink-0 select-none">
      <span className="text-red-500 font-bold text-sm">씬아리아</span>
      <div className="w-px h-4 bg-gray-800" />

      <div className="flex gap-0.5">
        <DropdownMenu label="파일" items={fileItems} />
        <DropdownMenu label="편집" items={editItems} />
        <DropdownMenu label="보기" items={viewItems} />
        <DropdownMenu label="도구" items={toolItems} />
      </div>

      {/* Editor mode */}
      <div className="flex gap-0.5 ml-2">
        {([
          ['normal',     '편집',   'N'],
          ['focus',      '집중',   'F'],
          ['reading',    '읽기',   'R'],
          ['typewriter', '타자기', 'T'],
        ] as [EditorMode, string, string][]).map(([m, label, key]) => (
          <button
            key={m}
            onClick={() => onModeChange(m as EditorMode)}
            title={`${label} 모드 (${key})`}
            className={`text-xs px-2 py-0.5 rounded transition-colors ${
              mode === m ? 'bg-gray-700 text-white' : 'text-gray-600 hover:text-gray-300'
            }`}
          >
            {label}
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
        onClick={createSavePoint}
        disabled={!historyManager}
        title="저장 지점 만들기 (Ctrl+Shift+Enter)"
        className="text-xs text-gray-600 hover:text-green-400 px-2 py-1 rounded hover:bg-gray-800 transition-colors disabled:opacity-30"
      >
        ● 저장 지점
      </button>
    </div>
  );
}

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

function RightToolbar({ activePanel, onToggle }: {
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

function EditorLayout() {
  const { dirHandle } = useProjectStore();
  const { setIndex, currentSceneId, index } = useSceneStore();
  const { setIndex: setCharIndex } = useCharacterStore();
  const [rightPanel, setRightPanel] = useState<SidePanel>('none');
  const [editorMode, setEditorMode] = useState<EditorMode>('normal');
  const [showFind, setShowFind] = useState(false);
  const [findReplace, setFindReplace] = useState(false);

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
      // Ctrl+Shift+Enter: save point
      if (e.ctrlKey && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        const { historyManager } = useProjectStore.getState();
        if (historyManager) {
          const memo = prompt('저장 지점 메모:') ?? undefined;
          await historyManager.createSavePoint(memo, false);
        }
        return;
      }
      // Ctrl+Shift+S: new scene
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('scenaria:addScene'));
        return;
      }
      // Ctrl+F: find
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        setFindReplace(false);
        setShowFind(true);
        return;
      }
      // Ctrl+H: find & replace
      if (e.ctrlKey && e.key === 'h') {
        e.preventDefault();
        setFindReplace(true);
        setShowFind(true);
        return;
      }
      // Ctrl+G: go to scene
      if (e.ctrlKey && e.key === 'g') {
        e.preventDefault();
        const num = prompt('씬 번호로 이동:');
        if (!num) return;
        const entry = index.find(s => s.number === Number(num));
        if (entry) window.dispatchEvent(new CustomEvent('scenaria:gotoScene', { detail: entry.id }));
        return;
      }
      // Escape: exit special modes
      if (e.key === 'Escape') {
        if (showFind) { setShowFind(false); return; }
        if (editorMode !== 'normal') { setEditorMode('normal'); return; }
      }
      // Mode shortcuts (only when not in input)
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.key === 'f' || e.key === 'F') setEditorMode(m => m === 'focus' ? 'normal' : 'focus');
      if (e.key === 'r' || e.key === 'R') setEditorMode(m => m === 'reading' ? 'normal' : 'reading');
      if (e.key === 't' || e.key === 'T') setEditorMode(m => m === 'typewriter' ? 'normal' : 'typewriter');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showFind, editorMode, index]);

  // Listen for menu-bar goto-by-number event
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

  // Mode-dependent layout classes
  const isFocus = editorMode === 'focus';
  const isReading = editorMode === 'reading';

  return (
    <div
      className={`flex flex-col h-screen text-gray-100 overflow-hidden transition-colors ${
        isReading ? 'bg-amber-950' : 'bg-gray-950'
      }`}
    >
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

        {/* Editor with mode overlays */}
        <div className={`flex-1 flex flex-col overflow-hidden relative ${isFocus ? 'max-w-2xl mx-auto w-full' : ''}`}>
          <ScreenplayEditor
            mode={editorMode}
            readOnly={isReading}
          />

          {/* Focus mode overlay hint */}
          {isFocus && (
            <div className="absolute top-2 right-2 text-xs text-gray-700">
              Esc로 일반 모드
            </div>
          )}
        </div>

        {!isFocus && !isReading && (
          <>
            <RightSidebar panel={rightPanel} onClose={() => setRightPanel('none')} />
            <RightToolbar activePanel={rightPanel} onToggle={togglePanel} />
          </>
        )}
      </div>

      {/* Find & Replace */}
      {showFind && (
        <FindReplace
          onClose={() => setShowFind(false)}
          initialReplace={findReplace}
          onNavigate={(sceneId) => {
            window.dispatchEvent(new CustomEvent('scenaria:gotoScene', { detail: sceneId }));
          }}
        />
      )}

      {/* Reading mode bar */}
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
