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
import { isElectron } from '../platform/env';
import { Plus, FolderOpen, Film, ChevronRight, Clapperboard, Clock } from 'lucide-react';

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
      const granted = await verifyHandlePermission(recent.ref);
      if (!granted) { setError('폴더 접근 권한이 없습니다. 다시 열어주세요.'); return; }
      await openProjectFromHandle(recent.ref, setProject, setHistoryManager, setAutoSave, setSettings);
      await saveRecentProject({ ...recent, lastOpened: new Date().toISOString() });
      onOpen();
    } catch (err) {
      setError(err instanceof Error ? err.message : '프로젝트 열기 실패');
    } finally {
      setLoading(false);
    }
  };

  const inElectron = isElectron();

  return (
    <div className="start-screen flex flex-col items-center justify-center p-8 select-none relative overflow-hidden">
      {showNewDialog && (
        <NewProjectDialog
          onClose={() => setShowNewDialog(false)}
          onCreated={() => { setShowNewDialog(false); onOpen(); }}
        />
      )}

      {/* Subtle background accents */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="start-orb-1 absolute -top-48 -right-48 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.04) 0%, transparent 70%)' }}
        />
        <div
          className="start-orb-2 absolute -bottom-48 -left-48 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.03) 0%, transparent 70%)' }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-md">
        {/* Logo & title */}
        <div className="mb-16 text-center start-fade">
          <div className="start-icon-box inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5">
            <Clapperboard className="w-7 h-7 text-blue-600" strokeWidth={1.5} />
          </div>
          <h1 className="start-brand text-5xl mb-3">
            Scenaria
          </h1>
          <p className="text-[13px] text-zinc-400 tracking-[0.15em] uppercase font-light">
            AI-powered screenplay & production
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 mb-14 w-full start-fade start-fade-d1">
          <button
            onClick={() => setShowNewDialog(true)}
            className="start-btn-primary flex-1 inline-flex items-center justify-center gap-2.5 px-6 py-3 text-[13px] font-medium rounded-xl"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            <span>새 프로젝트</span>
          </button>
          <button
            onClick={handleOpenProject}
            disabled={isLoading}
            className="start-btn-secondary flex-1 inline-flex items-center justify-center gap-2.5 px-6 py-3 text-[13px] font-medium rounded-xl"
          >
            <FolderOpen className="w-4 h-4 text-zinc-400" strokeWidth={1.75} />
            <span>{isLoading ? '여는 중...' : '프로젝트 열기'}</span>
          </button>
        </div>

        {/* Recent projects */}
        {recentProjects.length > 0 && (
          <div className="w-full start-fade start-fade-d2">
            <h2 className="text-[11px] font-medium text-zinc-400 uppercase tracking-[0.15em] mb-2.5 px-1">
              최근 프로젝트
            </h2>
            <div className="start-card">
              {recentProjects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleOpenRecent(p)}
                  className="start-card-item w-full flex items-center gap-3.5 px-4 py-3 text-left group"
                >
                  <div className="start-film-icon w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Film className="w-4 h-4 text-blue-500" strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-zinc-700 truncate">{p.name}</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" strokeWidth={1.5} />
                      {new Date(p.lastOpened).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <ChevronRight
                    className="start-chevron w-4 h-4 flex-shrink-0"
                    strokeWidth={1.75}
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="relative z-10 mt-16 text-center space-y-1 start-fade start-fade-d3">
        <p className="text-[11px] text-zinc-300">v0.1.0</p>
        {!inElectron && (
          <p className="text-[11px] text-zinc-300">
            Chrome 또는 Edge 브라우저가 필요합니다
          </p>
        )}
      </div>
    </div>
  );
}
