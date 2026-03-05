import { useState, useEffect } from 'react';
import { useProjectStore } from '../store/projectStore';
import { fileIO } from '../io';
import { initializeProject, loadProject } from '../io/projectInit';
import { HistoryManager } from '../io/history/historyManager';
import { AutoSave } from '../io/history/autoSave';
import {
  getRecentProjects,
  saveRecentProject,
  verifyHandlePermission,
  type RecentProject,
} from '../io/recentProjects';
import { nanoid } from 'nanoid';

interface NewProjectDialogProps {
  onClose: () => void;
  onCreated: () => void;
}

function NewProjectDialog({ onClose, onCreated }: NewProjectDialogProps) {
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
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-600 text-gray-400 hover:bg-gray-800 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || isCreating}
            className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isCreating ? '생성 중...' : '폴더 선택 후 생성'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function StartScreen({ onOpen }: { onOpen: () => void }) {
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const { setProject, setHistoryManager, setAutoSave, setError, isLoading, setLoading } =
    useProjectStore();

  useEffect(() => {
    getRecentProjects().then(setRecentProjects).catch(console.error);
  }, []);

  const handleOpenProject = async () => {
    setLoading(true);
    try {
      const handle = await fileIO.openProject();
      const meta = await loadProject(fileIO, handle.dirHandle);
      setProject(handle.dirHandle, meta);

      const hm = new HistoryManager(handle.dirHandle);
      await hm.init();
      setHistoryManager(hm);

      const as = new AutoSave(hm);
      setAutoSave(as);

      await saveRecentProject({
        id: meta.id,
        name: meta.title,
        dirHandle: handle.dirHandle,
        lastOpened: new Date().toISOString(),
      });

      onOpen();
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRecent = async (recent: RecentProject) => {
    setLoading(true);
    try {
      const granted = await verifyHandlePermission(recent.dirHandle);
      if (!granted) {
        setError('폴더 접근 권한이 없습니다. 다시 열어주세요.');
        return;
      }
      const meta = await loadProject(fileIO, recent.dirHandle);
      setProject(recent.dirHandle, meta);

      const hm = new HistoryManager(recent.dirHandle);
      await hm.init();
      setHistoryManager(hm);

      const as = new AutoSave(hm);
      setAutoSave(as);

      await saveRecentProject({
        ...recent,
        lastOpened: new Date().toISOString(),
      });

      onOpen();
    } catch (err) {
      setError(err instanceof Error ? err.message : '프로젝트 열기 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-8">
      {showNewDialog && (
        <NewProjectDialog
          onClose={() => setShowNewDialog(false)}
          onCreated={() => { setShowNewDialog(false); onOpen(); }}
        />
      )}

      {/* Logo */}
      <div className="mb-12 text-center">
        <h1 className="text-5xl font-bold text-white tracking-tight">
          <span className="text-red-500">씬</span>아리아
        </h1>
        <p className="text-gray-500 mt-2 text-sm">한국형 AI 영화 생성 플랫폼</p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-4 mb-12">
        <button
          onClick={() => setShowNewDialog(true)}
          className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors flex items-center gap-2"
        >
          <span>+</span>
          <span>새 프로젝트</span>
        </button>
        <button
          onClick={handleOpenProject}
          disabled={isLoading}
          className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl border border-gray-700 transition-colors disabled:opacity-50"
        >
          {isLoading ? '여는 중...' : '폴더 열기'}
        </button>
      </div>

      {/* Recent projects */}
      {recentProjects.length > 0 && (
        <div className="w-full max-w-lg">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
            최근 프로젝트
          </h2>
          <div className="space-y-2">
            {recentProjects.map((p) => (
              <button
                key={p.id}
                onClick={() => handleOpenRecent(p)}
                className="w-full flex items-center gap-3 p-3 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg transition-colors text-left"
              >
                <div className="w-8 h-8 bg-red-900/40 rounded-lg flex items-center justify-center text-red-400 text-lg flex-shrink-0">
                  🎬
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{p.name}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(p.lastOpened).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <span className="text-gray-600 text-sm">→</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chrome/Edge note */}
      <p className="mt-12 text-xs text-gray-700 text-center">
        Chrome 또는 Edge 브라우저가 필요합니다 (File System Access API)
      </p>
    </div>
  );
}
