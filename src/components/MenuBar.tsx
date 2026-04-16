import { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useSceneStore } from '../store/sceneStore';
import { usePrompt } from './PromptDialog';
import { NewProjectDialog } from './NewProjectDialog';
import { openProjectWithPicker } from '../io/openProject';
import { useToast } from './Toast';
import { Clapperboard, Save } from 'lucide-react';
import { isElectron } from '../platform/env';

type EditorMode = 'normal' | 'focus' | 'reading' | 'typewriter';
type SidePanel = 'none' | 'history' | 'characters' | 'story' | 'consistency' | 'export' | 'settings';

type MenuSep = { separator: true };
type MenuAction = { label: string; shortcut?: string; action: () => void | Promise<void>; disabled?: boolean };
export type MenuItem = MenuSep | MenuAction;

function DropdownMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`text-[13px] px-2.5 py-1 rounded-lg transition-colors ${open ? 'bg-zinc-100 text-zinc-800' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50'}`}
      >
        {label}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-zinc-200 rounded-xl shadow-lg py-1 min-w-48">
          {items.map((item, i) =>
            'separator' in item ? (
              <div key={i} className="border-t border-zinc-100 my-1" />
            ) : (
              <button
                key={i}
                disabled={item.disabled}
                onClick={() => { item.action(); setOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-[13px] text-zinc-600 hover:bg-zinc-50 hover:text-zinc-800 flex items-center justify-between gap-4 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <span>{item.label}</span>
                {item.shortcut && <kbd className="text-zinc-400 text-[11px] font-mono">{item.shortcut}</kbd>}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

export function MenuBar({
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
  const { meta, historyManager, clearProject, setProject, setHistoryManager, setAutoSave, setSettings, setError } = useProjectStore();
  const { currentSceneId, index } = useSceneStore();
  const prompt = usePrompt();
  const toast = useToast();
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const currentEntry = index.find(s => s.id === currentSceneId);

  const title = [
    currentEntry ? `장면 ${currentEntry.number}. ${currentEntry.location}` : null,
    meta?.title,
    'Scenaria',
  ].filter(Boolean).join(' — ');

  useEffect(() => { document.title = title; }, [title]);

  const createSavePoint = async () => {
    if (!historyManager) return;
    const memo = await prompt({ message: '저장 지점 메모', placeholder: 'Enter 건너뛰기' });
    if (memo === null) return;
    await historyManager.createSavePoint(memo || undefined, false);
  };

  const handleOpenProject = async () => {
    try {
      await openProjectWithPicker(setProject, setHistoryManager, setAutoSave, setSettings);
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
        toast(err.message, 'error');
      }
    }
  };

  const fileItems: MenuItem[] = [
    { label: '새 프로젝트', action: () => setShowNewProjectDialog(true) },
    { label: '프로젝트 열기', action: handleOpenProject },
    { separator: true },
    { label: '저장 지점 만들기', shortcut: 'Ctrl+⇧+Enter', action: createSavePoint, disabled: !historyManager },
    { separator: true },
    { label: '시작 화면으로', action: () => clearProject() },
  ];

  const editItems: MenuItem[] = [
    { label: '찾기', shortcut: 'Ctrl+F', action: () => onFindOpen(false) },
    { label: '찾기 및 바꾸기', shortcut: 'Ctrl+H', action: () => onFindOpen(true) },
    { separator: true },
    { label: '씬 번호로 이동', shortcut: 'Ctrl+G', action: async () => { const n = await prompt({ message: '씬 번호로 이동', placeholder: '번호 입력' }); if (!n) return; window.dispatchEvent(new CustomEvent('scenaria:gotoSceneByNumber', { detail: Number(n) })); } },
    { label: '새 씬 추가', shortcut: 'Ctrl+⇧+S', action: () => window.dispatchEvent(new CustomEvent('scenaria:addScene')) },
    { separator: true },
    { label: '씬 분할 (현재 위치)', shortcut: 'Ctrl+⇧+\\', action: () => window.dispatchEvent(new CustomEvent('scenaria:splitScene')) },
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
    <>
    {showNewProjectDialog && (
      <NewProjectDialog
        onClose={() => setShowNewProjectDialog(false)}
        onCreated={() => setShowNewProjectDialog(false)}
      />
    )}
    <div
      className={`flex items-center bg-white border-b border-zinc-200/80 px-3 gap-2 flex-shrink-0 select-none ${isElectron() ? 'drag pl-20 h-11 pt-1' : 'h-10'}`}
    >
      <div className="no-drag flex items-center gap-1.5">
        <Clapperboard className="w-4 h-4 text-blue-600" strokeWidth={1.75} />
        <span className="text-zinc-800 font-semibold text-sm tracking-tight">Scenaria</span>
      </div>
      <div className="w-px h-4 bg-zinc-200 mx-1" />

      <div className="no-drag flex gap-0.5">
        <DropdownMenu label="파일" items={fileItems} />
        <DropdownMenu label="편집" items={editItems} />
        <DropdownMenu label="보기" items={viewItems} />
        <DropdownMenu label="도구" items={toolItems} />
      </div>

      <div className="no-drag flex gap-0.5 ml-1">
        {([
          ['normal',     '편집',   'N'],
          ['focus',      '집중',   'F'],
          ['reading',    '읽기',   'R'],
          ['typewriter', '타자기', 'T'],
        ] as [EditorMode, string, string][]).map(([m, label, key]) => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            title={`${label} 모드 (${key})`}
            className={`text-[11px] px-2 py-1 rounded-lg transition-colors ${
              mode === m ? 'bg-blue-50 text-blue-600 font-medium' : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      {meta && (
        <div className="flex items-center gap-2 text-[11px] text-zinc-400">
          <span>{meta.title}</span>
          {currentEntry && <span className="text-zinc-300">장면 {currentEntry.number}/{index.length}</span>}
        </div>
      )}

      <button
        onClick={createSavePoint}
        disabled={!historyManager}
        title="저장 지점 만들기 (Ctrl+Shift+Enter)"
        className="no-drag text-[11px] text-zinc-400 hover:text-blue-600 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-30"
      >
        <Save className="w-3.5 h-3.5 inline mr-1" />저장
      </button>
    </div>
    </>
  );
}
