import { useState, useEffect } from 'react';
import { useProjectStore } from '../store/projectStore';
import { openProjectFromHandle, openProjectWithPicker } from '../io/openProject';
import {
  getRecentProjects,
  saveRecentProject,
  verifyHandlePermission,
  type RecentProject,
} from '../io/recentProjects';
import { NewProjectDialog } from './NewProjectDialog';

export function StartScreen({ onOpen }: { onOpen: () => void }) {
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const { setProject, setHistoryManager, setAutoSave, setSettings, setError, isLoading, setLoading } =
    useProjectStore();

  useEffect(() => {
    getRecentProjects().then(setRecentProjects).catch(console.error);
  }, []);

  const handleOpenProject = async () => {
    setLoading(true);
    try {
      await openProjectWithPicker(setProject, setHistoryManager, setAutoSave, setSettings);
      onOpen();
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRecent = async (recent: RecentProject) => {
    setLoading(true);
    try {
      const granted = await verifyHandlePermission(recent.dirHandle);
      if (!granted) { setError('폴더 접근 권한이 없습니다. 다시 열어주세요.'); return; }
      const meta = await openProjectFromHandle(recent.dirHandle, setProject, setHistoryManager, setAutoSave, setSettings);
      await saveRecentProject({ ...recent, lastOpened: new Date().toISOString() });
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

      <div className="mb-12 text-center">
        <h1 className="text-5xl font-bold text-white tracking-tight">
          <span className="text-red-500">씬</span>아리아
        </h1>
        <p className="text-gray-500 mt-2 text-sm">한국형 AI 영화 생성 플랫폼</p>
      </div>

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

      {recentProjects.length > 0 && (
        <div className="w-full max-w-lg">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">최근 프로젝트</h2>
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
                    {new Date(p.lastOpened).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
                <span className="text-gray-600 text-sm">→</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="mt-12 text-xs text-gray-700 text-center">
        Chrome 또는 Edge 브라우저가 필요합니다 (File System Access API)
      </p>
    </div>
  );
}
