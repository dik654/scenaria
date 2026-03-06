import { useEffect, useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useToast } from '../components/Toast';
import type { MergeResult } from '../io/history/types';

type Conflict = MergeResult['conflicts'][number];

interface Props {
  conflicts: Conflict[];
  onClose: () => void;
}

export function ConflictResolver({ conflicts, onClose }: Props) {
  const { historyManager } = useProjectStore();
  const toast = useToast();
  // For each path, user picks 'ours' | 'theirs'
  const [choices, setChoices] = useState<Record<string, 'ours' | 'theirs'>>(() =>
    Object.fromEntries(conflicts.map(c => [c.path, 'ours']))
  );
  const [isApplying, setIsApplying] = useState(false);

  const fileName = (path: string) => path.split('/').pop() ?? path;

  const preview = (content: string) => {
    try {
      const obj = JSON.parse(content);
      if (obj.blocks) return `블록 ${obj.blocks.length}개 / 씬: ${obj.header?.location ?? '?'}`;
      if (obj.name) return `캐릭터: ${obj.name}`;
      return content.slice(0, 80);
    } catch {
      return content.slice(0, 80);
    }
  };

  const handleApply = async () => {
    if (!historyManager) return;
    setIsApplying(true);
    try {
      // Build resolved snapshot by applying user choices
      // We reconstruct the merged state via restoreSnapshot on selected contents
      const resolved: Record<string, string> = {};
      for (const c of conflicts) {
        resolved[c.path] = choices[c.path] === 'ours' ? c.ourContent : c.theirContent;
      }
      await historyManager.applyConflictResolution(resolved);
      toast('충돌 해결 완료', 'success');
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : '적용 실패', 'error');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-sm font-semibold text-gray-100">충돌 해결</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              두 갈래에서 같은 파일이 다르게 수정됐습니다. 각 파일마다 사용할 버전을 선택하세요.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg leading-none ml-4">×</button>
        </div>

        {/* Conflict list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {conflicts.map(c => (
            <div key={c.path} className="border border-gray-700 rounded-lg overflow-hidden">
              <div className="bg-gray-800 px-3 py-1.5 text-xs text-gray-400 font-mono">
                {c.path}
              </div>
              <div className="grid grid-cols-2 divide-x divide-gray-700">
                {/* Ours */}
                <button
                  onClick={() => setChoices(prev => ({ ...prev, [c.path]: 'ours' }))}
                  className={`p-3 text-left transition-colors ${
                    choices[c.path] === 'ours'
                      ? 'bg-blue-900/30 border-2 border-blue-600'
                      : 'hover:bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                      choices[c.path] === 'ours' ? 'border-blue-500 bg-blue-500' : 'border-gray-600'
                    }`} />
                    <span className="text-xs font-medium text-blue-300">현재 갈래 (내 버전)</span>
                  </div>
                  <p className="text-xs text-gray-400 font-mono whitespace-pre-wrap break-all">
                    {preview(c.ourContent)}
                  </p>
                </button>

                {/* Theirs */}
                <button
                  onClick={() => setChoices(prev => ({ ...prev, [c.path]: 'theirs' }))}
                  className={`p-3 text-left transition-colors ${
                    choices[c.path] === 'theirs'
                      ? 'bg-green-900/30 border-2 border-green-600'
                      : 'hover:bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                      choices[c.path] === 'theirs' ? 'border-green-500 bg-green-500' : 'border-gray-600'
                    }`} />
                    <span className="text-xs font-medium text-green-300">합칠 갈래 버전</span>
                  </div>
                  <p className="text-xs text-gray-400 font-mono whitespace-pre-wrap break-all">
                    {preview(c.theirContent)}
                  </p>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-800">
          <span className="text-xs text-gray-500">
            {conflicts.length}개 충돌 ·{' '}
            {Object.values(choices).filter(v => v === 'ours').length}개 내 버전 ·{' '}
            {Object.values(choices).filter(v => v === 'theirs').length}개 합칠 버전
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-600"
            >
              취소
            </button>
            <button
              onClick={handleApply}
              disabled={isApplying}
              className="px-4 py-2 text-sm rounded-lg bg-red-700 hover:bg-red-600 text-white disabled:opacity-40"
            >
              {isApplying ? '적용 중…' : '해결 적용'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
