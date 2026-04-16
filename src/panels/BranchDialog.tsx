import { useEffect, useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import type { BranchInfo } from '../io/history/types';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';

interface Props {
  onClose: () => void;
}

export function BranchDialog({ onClose }: Props) {
  const { historyManager } = useProjectStore();
  const toast = useToast();
  const confirm = useConfirm();
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string>('원본');
  const [newName, setNewName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isMerging, setIsMerging] = useState<string | null>(null);

  useEffect(() => {
    if (!historyManager) return;
    historyManager.listBranches().then(({ branches, current }) => {
      setBranches(branches);
      setCurrentBranch(current);
    }).catch(console.error);
  }, [historyManager]);

  const handleCreate = async () => {
    if (!historyManager || !newName.trim()) return;
    setIsCreating(true);
    try {
      await historyManager.createBranch(newName.trim());
      const { branches: updated, current } = await historyManager.listBranches();
      setBranches(updated);
      setCurrentBranch(current);
      setNewName('');
      toast(`갈래 "${newName.trim()}" 생성됨`, 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : '갈래 생성 실패', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSwitch = async (name: string) => {
    if (!historyManager || name === currentBranch) return;
    try {
      await historyManager.switchBranch(name);
      setCurrentBranch(name);
      toast(`"${name}"으로 전환됨`, 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : '전환 실패', 'error');
    }
  };

  const handleMerge = async (sourceBranch: string) => {
    if (!historyManager) return;
    const ok = await confirm({
      message: `"${sourceBranch}"를 현재 갈래("${currentBranch}")에 합치겠습니까?`,
      confirmLabel: '합치기',
    });
    if (!ok) return;
    setIsMerging(sourceBranch);
    try {
      const result = await historyManager.mergeBranch(sourceBranch);
      if (result.success) {
        toast('합치기 완료', 'success');
        onClose();
      } else {
        // conflicts — handled by ConflictResolver
        window.dispatchEvent(new CustomEvent('scenaria:mergeConflict', { detail: result.conflicts }));
        onClose();
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : '합치기 실패', 'error');
    } finally {
      setIsMerging(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg w-96 mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">갈래 관리</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>

        {/* Branch list */}
        <div className="px-5 py-4 space-y-2 max-h-64 overflow-y-auto">
          {branches.length === 0 ? (
            <p className="text-xs text-gray-600 text-center py-4">갈래 없음</p>
          ) : branches.map(b => (
            <div
              key={b.name}
              className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                b.name === currentBranch
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-xs font-mono ${b.name === currentBranch ? 'text-blue-600' : 'text-gray-600'}`}>
                  {b.name === currentBranch ? '▶ ' : '  '}{b.name}
                </span>
                {b.name === currentBranch && (
                  <span className="text-xs text-blue-500 bg-blue-50 rounded px-1">현재</span>
                )}
              </div>
              <div className="flex gap-2">
                {b.name !== currentBranch && (
                  <>
                    <button
                      onClick={() => handleSwitch(b.name)}
                      className="text-xs text-gray-500 hover:text-blue-400 transition-colors"
                    >
                      전환
                    </button>
                    <button
                      onClick={() => handleMerge(b.name)}
                      disabled={isMerging === b.name}
                      className="text-xs text-gray-500 hover:text-green-400 transition-colors disabled:opacity-40"
                    >
                      {isMerging === b.name ? '합치는 중…' : '합치기'}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Create new branch */}
        <div className="px-5 py-4 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-2">새 갈래 만들기</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="갈래 이름"
              className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400"
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || isCreating}
              className="px-4 py-2 text-sm rounded-lg bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-40"
            >
              {isCreating ? '…' : '만들기'}
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-2">
            현재 상태를 기반으로 새 갈래가 생성됩니다. 원본은 그대로 유지됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
