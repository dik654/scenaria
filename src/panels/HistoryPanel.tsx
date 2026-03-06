import { useEffect, useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useHistoryStore } from '../store/historyStore';
import type { SavePoint, Milestone, MergeResult } from '../io/history/types';
import { DiffView } from './DiffView';
import { RestoreDialog } from './RestoreDialog';
import { MilestoneDialog } from './MilestoneDialog';
import { BranchDialog } from './BranchDialog';
import { ConflictResolver } from './ConflictResolver';
import { usePrompt } from '../components/PromptDialog';

export function HistoryPanel() {
  const { historyManager } = useProjectStore();
  const { savePoints, milestones, setSavePoints, setMilestones, setLoading, isLoading } = useHistoryStore();
  const prompt = usePrompt();
  const [showDiff, setShowDiff] = useState<{ a: string; b: string } | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<SavePoint | null>(null);
  const [showMilestoneDialog, setShowMilestoneDialog] = useState(false);
  const [showBranchDialog, setShowBranchDialog] = useState(false);
  const [conflicts, setConflicts] = useState<MergeResult['conflicts'] | null>(null);

  // Listen for merge conflicts dispatched from BranchDialog
  useEffect(() => {
    const handler = (e: Event) => {
      const c = (e as CustomEvent<MergeResult['conflicts']>).detail;
      if (c && c.length > 0) setConflicts(c);
    };
    window.addEventListener('scenaria:mergeConflict', handler);
    return () => window.removeEventListener('scenaria:mergeConflict', handler);
  }, []);

  useEffect(() => {
    if (!historyManager) return;
    setLoading(true);
    Promise.all([
      historyManager.listSavePoints(),
      historyManager.listMilestones(),
    ]).then(([sps, ms]) => {
      setSavePoints(sps);
      setMilestones(ms);
    }).catch(console.error).finally(() => setLoading(false));
  }, [historyManager, setSavePoints, setMilestones, setLoading]);

  const handleCreateManualSave = async () => {
    if (!historyManager) return;
    const memo = await prompt({ message: '저장 지점 메모', placeholder: '선택사항' });
    if (memo === null) return;
    const sp = await historyManager.createSavePoint(memo || undefined, false);
    setSavePoints([sp, ...savePoints]);
  };

  const getMilestoneForSave = (saveId: string) =>
    milestones.find((m) => m.saveId === saveId);

  const formatTime = (timestamp: string) => {
    const d = new Date(timestamp);
    return d.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (!historyManager) {
    return <div className="p-4 text-xs text-gray-600">프로젝트를 열어주세요</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {showDiff && (
        <DiffView
          saveIdA={showDiff.a}
          saveIdB={showDiff.b}
          onClose={() => setShowDiff(null)}
        />
      )}
      {restoreTarget && (
        <RestoreDialog
          savePoint={restoreTarget}
          onClose={() => setRestoreTarget(null)}
          onRestored={() => {
            setRestoreTarget(null);
            // Reload save points after restore
            historyManager.listSavePoints().then(setSavePoints);
          }}
        />
      )}
      {showMilestoneDialog && (
        <MilestoneDialog
          onClose={() => setShowMilestoneDialog(false)}
          onCreated={(name) => {
            historyManager.createMilestone(name).then(() =>
              historyManager.listMilestones().then(setMilestones)
            );
            setShowMilestoneDialog(false);
          }}
        />
      )}
      {showBranchDialog && (
        <BranchDialog onClose={() => setShowBranchDialog(false)} />
      )}
      {conflicts && (
        <ConflictResolver
          conflicts={conflicts}
          onClose={() => setConflicts(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">내역</span>
        <div className="flex gap-1">
          <button
            onClick={() => setShowBranchDialog(true)}
            title="갈래 관리"
            className="text-xs text-gray-500 hover:text-purple-400 px-1 transition-colors"
          >
            ⑂
          </button>
          <button
            onClick={() => setShowMilestoneDialog(true)}
            title="이름 붙이기"
            className="text-xs text-gray-500 hover:text-yellow-400 px-1 transition-colors"
          >
            ★
          </button>
          <button
            onClick={handleCreateManualSave}
            title="저장 지점 만들기 (Ctrl+Shift+Enter)"
            className="text-xs text-gray-500 hover:text-green-400 px-1 transition-colors"
          >
            ●
          </button>
        </div>
      </div>

      {/* Save point list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="text-center py-8 text-xs text-gray-600">불러오는 중...</div>
        ) : savePoints.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-600">저장 지점 없음</div>
        ) : (
          <div className="divide-y divide-gray-800/50">
            {savePoints.map((sp, i) => {
              const milestone = getMilestoneForSave(sp.id);
              const isCurrent = i === 0;

              return (
                <div key={sp.id} className="group">
                  {/* Milestone marker */}
                  {milestone && (
                    <div className="px-3 py-1 bg-yellow-900/20 border-l-2 border-yellow-500 flex items-center gap-2">
                      <span className="text-yellow-400 text-xs">★</span>
                      <span className="text-xs font-medium text-yellow-300">{milestone.name}</span>
                    </div>
                  )}

                  <div className={`px-3 py-2 ${isCurrent ? 'bg-gray-800/30' : ''}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs ${sp.auto ? 'text-gray-600' : 'text-gray-300'}`}>
                        {sp.auto ? '○' : '●'}
                      </span>
                      <span className="text-xs text-gray-400 flex-1 truncate">{sp.memo}</span>
                      <span className="text-xs text-gray-600">{formatTime(sp.timestamp)}</span>
                    </div>

                    {sp.changedFiles.length > 0 && (
                      <p className="text-xs text-gray-600 mb-1 ml-4">
                        {sp.changedFiles.slice(0, 3).map(f => f.split('/').pop()).join(', ')}
                        {sp.changedFiles.length > 3 && ` 외 ${sp.changedFiles.length - 3}개`}
                      </p>
                    )}

                    <div className="flex gap-2 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      {i < savePoints.length - 1 && (
                        <button
                          onClick={() => setShowDiff({ a: savePoints[i + 1].id, b: sp.id })}
                          className="text-xs text-gray-500 hover:text-blue-400 transition-colors"
                        >
                          비교
                        </button>
                      )}
                      {!isCurrent && (
                        <button
                          onClick={() => setRestoreTarget(sp)}
                          className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                        >
                          되돌리기
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
