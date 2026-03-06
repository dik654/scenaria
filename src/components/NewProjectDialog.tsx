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
      const meta = await initializeProject(fileIO, handle.dirHandle, handle.name);
      setProject(handle.dirHandle, meta);

      const hm = new HistoryManager(handle.dirHandle);
      await hm.init();
      await hm.createSavePoint('프로젝트 생성', false);
      setHistoryManager(hm);

      const as = new AutoSave(hm);
      setAutoSave(as);

      await saveRecentProject({
        id: meta.id,
        name: meta.title,
        dirHandle: handle.dirHandle,
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
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-96 shadow-2xl">
        <h2 className="text-xl font-bold text-white mb-4">새 프로젝트</h2>
        <label className="block text-sm text-gray-400 mb-1">프로젝트 이름</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="예: 잔상"
          autoFocus
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 mb-4"
        />
        <p className="text-xs text-gray-500 mb-4">
          다음 화면에서 프로젝트를 저장할 폴더를 선택합니다.
          <code className="text-red-400"> {name || '이름'}.scenaria</code> 폴더가 생성됩니다.
        </p>
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-600 text-gray-400 hover:bg-gray-800 transition-colors">
            취소
          </button>
          <button onClick={handleCreate} disabled={!name.trim() || isCreating}
            className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {isCreating ? '생성 중...' : '폴더 선택 후 생성'}
          </button>
        </div>
      </div>
    </div>
  );
}
