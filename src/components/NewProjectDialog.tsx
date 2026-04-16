import { useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { fileIO } from '../io';
import { initializeProject } from '../io/projectInit';
import { HistoryManager } from '../io/history/historyManager';
import { AutoSave } from '../io/history/autoSave';
import { saveRecentProject } from '../io/recentProjects';

interface NewProjectDialogProps {
  onClose: () => void;
  onCreated: () => void;
}

export function NewProjectDialog({ onClose, onCreated }: NewProjectDialogProps) {
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { setProject, setHistoryManager, setAutoSave, setError } = useProjectStore();

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsCreating(true);
    try {
      const handle = await fileIO.createProject(name.trim());
      const meta = await initializeProject(fileIO, handle.ref, handle.name);
      setProject(handle.ref, meta);

      const hm = new HistoryManager(handle.ref);
      await hm.init();
      await hm.createSavePoint('프로젝트 생성', false);
      setHistoryManager(hm);

      const as = new AutoSave(hm);
      setAutoSave(as);

      await saveRecentProject({
        id: meta.id,
        name: meta.title,
        ref: handle.ref,
        lastOpened: new Date().toISOString(),
      });

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : '프로젝트 생성 실패');
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white border border-zinc-200 rounded-xl p-6 w-96 shadow-lg">
        <h2 className="text-xl font-bold text-zinc-800 mb-4">새 프로젝트</h2>
        <label className="block text-sm text-zinc-500 mb-1">프로젝트 이름</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="예: 잔상"
          autoFocus
          className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 mb-4"
        />
        <p className="text-xs text-zinc-500 mb-4">
          다음 화면에서 프로젝트를 저장할 폴더를 선택합니다.
          <code className="text-blue-500"> {name || '이름'}.scenaria</code> 폴더가 생성됩니다.
        </p>
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50 transition-colors">
            취소
          </button>
          <button onClick={handleCreate} disabled={!name.trim() || isCreating}
            className="flex-1 px-4 py-2 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {isCreating ? '생성 중...' : '폴더 선택 후 생성'}
          </button>
        </div>
      </div>
    </div>
  );
}
