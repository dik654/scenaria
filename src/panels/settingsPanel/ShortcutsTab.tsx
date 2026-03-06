const SHORTCUTS: [string, string][] = [
  ['Ctrl+S', '씬 저장'],
  ['Ctrl+Shift+Enter', '저장 지점 만들기'],
  ['Ctrl+Shift+S', '새 씬'],
  ['Tab', '다음 블록 타입'],
  ['Shift+Tab', '블록 타입 변경'],
  ['Ctrl+Enter', '같은 캐릭터 대사 반복'],
  ['Ctrl+F', '찾기'],
  ['Ctrl+H', '찾기 및 바꾸기'],
  ['Ctrl+G', '씬 번호로 이동'],
  ['Ctrl+Shift+\\', '씬 분할 (선택 블록 기준)'],
  ['/', '슬래시 메뉴'],
  ['F', '집중 모드'],
  ['R', '읽기 모드'],
  ['T', '타자기 모드'],
];

export function ShortcutsTab() {
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-600 mb-3">기본 단축키 (변경 불가)</p>
      {SHORTCUTS.map(([key, desc]) => (
        <div key={key} className="flex items-center justify-between py-1.5 border-b border-gray-800">
          <span className="text-xs text-gray-400">{desc}</span>
          <kbd className="text-xs bg-gray-800 border border-gray-700 rounded px-2 py-0.5 font-mono text-gray-300">{key}</kbd>
        </div>
      ))}
    </div>
  );
}
