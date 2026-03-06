import { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useSceneStore } from '../store/sceneStore';
import { usePrompt } from './PromptDialog';

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
  const { meta, historyManager, clearProject } = useProjectStore();
  const { currentSceneId, index } = useSceneStore();
  const prompt = usePrompt();
  const currentEntry = index.find(s => s.id === currentSceneId);

  const title = [
    currentEntry ? `S#${currentEntry.number}. ${currentEntry.location}` : null,
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
    { label: '씬 번호로 이동', shortcut: 'Ctrl+G', action: async () => { const n = await prompt({ message: '씬 번호로 이동', placeholder: '번호 입력' }); if (!n) return; window.dispatchEvent(new CustomEvent('scenaria:gotoSceneByNumber', { detail: Number(n) })); } },
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

      <div className="flex gap-0.5 ml-2">
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
