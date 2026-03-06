import { useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import type { SavePoint } from '../io/history/types';

interface RestoreDialogProps {
  savePoint: SavePoint;
  onClose: () => void;
  onRestored: () => void;
}

export function RestoreDialog({ savePoint, onClose, onRestored }: RestoreDialogProps) {
  const { historyManager } = useProjectStore();
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRestore = async () => {
    if (!historyManager) return;
    setIsRestoring(true);
    setError(null);
    try {
      await historyManager.restore(savePoint.id);
      onRestored();
    } catch (err) {
      setError(err instanceof Error ? err.message : '되돌리기 실패');
      setIsRestoring(false);
    }
  };

  const formatTime = (ts: string) =>
    new Date(ts).toLocaleString('ko-KR', {
      month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-96 shadow-2xl">
        <h2 className="text-lg font-bold text-white mb-1">⏪ 되돌리기</h2>
        <p className="text-sm text-gray-400 mb-4">
          <span className="text-white font-medium">"{savePoint.memo}"</span> 시점으로 돌아갑니다.
        </p>

        <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3 mb-4 text-xs text-blue-300">
          지금 작업 중인 내용은 자동으로 저장 지점으로 남겨둡니다. 언제든 다시 돌아올 수 있어요.
        </div>

        {savePoint.changedFiles.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 mb-2">바뀌는 것:</p>
            <ul className="text-xs text-gray-400 space-y-0.5">
              {savePoint.changedFiles.slice(0, 8).map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="text-gray-600">📄</span>
                  <span className="font-mono truncate">{f}</span>
                </li>
              ))}
              {savePoint.changedFiles.length > 8 && (
                <li className="text-gray-600">... 외 {savePoint.changedFiles.length - 8}개</li>
              )}
            </ul>
          </div>
        )}

        <p className="text-xs text-gray-600 mb-4">{formatTime(savePoint.timestamp)}</p>

        {error && (
          <p className="text-xs text-red-400 mb-3">{error}</p>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={isRestoring}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-600 text-gray-400 hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleRestore}
            disabled={isRestoring}
            className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {isRestoring ? '되돌리는 중...' : '되돌리기'}
          </button>
        </div>
      </div>
    </div>
  );
}
