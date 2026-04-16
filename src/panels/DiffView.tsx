import { useEffect, useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import type { DiffResult } from '../io/history/types';

interface DiffViewProps {
  saveIdA: string;
  saveIdB: string;
  onClose: () => void;
}

export function DiffView({ saveIdA, saveIdB, onClose }: DiffViewProps) {
  const { historyManager } = useProjectStore();
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [currentHunkIndex, setCurrentHunkIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!historyManager) return;
    setIsLoading(true);
    historyManager.diff(saveIdA, saveIdB)
      .then(setDiff)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [historyManager, saveIdA, saveIdB]);

  const hunk = diff?.hunks[currentHunkIndex];

  const renderJSON = (content: string | null, highlight: 'old' | 'new') => {
    if (!content) return <div className="text-gray-600 italic text-xs">(없음)</div>;
    try {
      const parsed = JSON.parse(content);
      const lines = JSON.stringify(parsed, null, 2).split('\n');
      return (
        <pre className={`text-xs font-mono overflow-auto max-h-96 whitespace-pre-wrap break-all ${
          highlight === 'old' ? 'text-red-200' : 'text-green-200'
        }`}>
          {lines.join('\n')}
        </pre>
      );
    } catch {
      return <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap">{content}</pre>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-gray-200 rounded-xl w-full max-w-5xl max-h-screen overflow-hidden flex flex-col shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-medium text-gray-800">비교</h2>
          <div className="flex items-center gap-4">
            {diff && (
              <span className="text-xs text-gray-500">
                변경 {diff.hunks.length}개 파일
              </span>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentHunkIndex(Math.max(0, currentHunkIndex - 1))}
                disabled={currentHunkIndex === 0}
                className="text-xs text-gray-500 hover:text-gray-800 disabled:opacity-30 px-2 py-1 border border-gray-200 rounded"
              >
                ◀ 이전
              </button>
              <span className="text-xs text-gray-500">
                {diff ? `${currentHunkIndex + 1} / ${diff.hunks.length}` : '-'}
              </span>
              <button
                onClick={() => setCurrentHunkIndex(Math.min((diff?.hunks.length ?? 1) - 1, currentHunkIndex + 1))}
                disabled={!diff || currentHunkIndex >= diff.hunks.length - 1}
                className="text-xs text-gray-500 hover:text-gray-800 disabled:opacity-30 px-2 py-1 border border-gray-200 rounded"
              >
                다음 ▶
              </button>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
            불러오는 중...
          </div>
        ) : !diff || diff.hunks.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
            변경 사항이 없습니다
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col">
            {hunk && (
              <>
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                  <span className="text-xs font-mono text-amber-600">{hunk.path}</span>
                </div>
                <div className="flex-1 grid grid-cols-2 gap-0 overflow-hidden">
                  <div className="border-r border-gray-200 p-4 overflow-auto bg-red-50/30">
                    <div className="text-xs text-red-400 font-medium mb-2">이전</div>
                    {renderJSON(hunk.oldContent, 'old')}
                  </div>
                  <div className="p-4 overflow-auto bg-green-50/30">
                    <div className="text-xs text-green-400 font-medium mb-2">현재</div>
                    {renderJSON(hunk.newContent, 'new')}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
