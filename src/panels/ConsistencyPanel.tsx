import { useEffect, useState } from 'react';
import { useConsistencyStore } from '../store/consistencyStore';
import { useProjectStore } from '../store/projectStore';
import { useSceneStore } from '../store/sceneStore';
import { fileIO } from '../io';
import type { ConsistencyData, ConsistencyIssue, IssueSeverity } from '../types/consistency';
import type { ForeshadowingIndex } from '../types/story';
import type { Scene } from '../types/scene';
import {
  checkUnresolvedForeshadowing,
  checkSceneTimeContradictions,
  checkCharacterLocationContradictions,
} from '../ai/consistencyChecker';

const SEVERITY_ICON: Record<IssueSeverity, string> = {
  error: '🔴',
  warning: '🟡',
  info: '🔵',
};

const SEVERITY_ORDER: Record<IssueSeverity, number> = { error: 0, warning: 1, info: 2 };

export function ConsistencyPanel() {
  const { data, openIssues, setData, resolveIssue, ignoreIssue, isChecking, setChecking } = useConsistencyStore();
  const { dirHandle } = useProjectStore();
  const { index: sceneIndex } = useSceneStore();
  const [filter, setFilter] = useState<'all' | IssueSeverity>('all');

  const runFullCheck = async () => {
    if (!dirHandle || isChecking) return;
    setChecking(true);
    try {
      // Load all scenes
      const scenes: Scene[] = [];
      for (const entry of sceneIndex) {
        try {
          const scene = await fileIO.readJSON<Scene>(dirHandle, `screenplay/${entry.filename}`);
          if (scene) scenes.push(scene);
        } catch { /* skip */ }
      }

      // Load foreshadowing
      const foreshadowing = await fileIO.readJSON<ForeshadowingIndex>(dirHandle, 'story/foreshadowing.json')
        .catch(() => null);

      // Run all checkers
      const issues = [
        ...checkSceneTimeContradictions(scenes),
        ...checkCharacterLocationContradictions(scenes),
        ...(foreshadowing ? checkUnresolvedForeshadowing(foreshadowing, []) : []),
      ];

      const updated: ConsistencyData = {
        lastChecked: new Date().toISOString(),
        issues,
        rules: [],
      };
      setData(updated);
      await fileIO.writeJSON(dirHandle, 'story/consistency.json', updated);

      // Update hasConsistencyIssue flags on SceneIndexEntry
      const affectedSceneIds = new Set(
        issues.flatMap((issue: ConsistencyIssue) => issue.scenes ?? [])
      );
      const { updateIndexEntry, index } = useSceneStore.getState();
      for (const entry of index) {
        updateIndexEntry(entry.id, { hasConsistencyIssue: affectedSceneIds.has(entry.id) });
      }
      const newIndex = useSceneStore.getState().index;
      await fileIO.writeJSON(dirHandle, 'screenplay/_index.json', { scenes: newIndex });
    } catch (err) {
      console.error('정합성 검사 실패:', err);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (!dirHandle || data) return;
    fileIO.readJSON<ConsistencyData>(dirHandle, 'story/consistency.json')
      .then(d => {
        setData(d);
        // Also check foreshadowing
        return fileIO.readJSON<ForeshadowingIndex>(dirHandle, 'story/foreshadowing.json');
      })
      .then(fs => {
        if (fs) {
          const newIssues = checkUnresolvedForeshadowing(fs, openIssues);
          if (newIssues.length > 0) {
            const current = useConsistencyStore.getState().data;
            const updated: ConsistencyData = {
              ...(current ?? { lastChecked: new Date().toISOString(), issues: [], rules: [] }),
              issues: [...(current?.issues ?? []), ...newIssues],
            };
            setData(updated);
          }
        }
      })
      .catch(console.error);
  }, [dirHandle]);

  const saveConsistency = async (updated: ConsistencyData) => {
    if (!dirHandle) return;
    await fileIO.writeJSON(dirHandle, 'story/consistency.json', updated);
  };

  const handleResolve = async (id: string) => {
    resolveIssue(id);
    if (data) await saveConsistency({ ...data, issues: data.issues.map(i => i.id === id ? { ...i, status: 'resolved' as const } : i) });
  };

  const handleIgnore = async (id: string) => {
    ignoreIssue(id);
    if (data) await saveConsistency({ ...data, issues: data.issues.map(i => i.id === id ? { ...i, status: 'ignored' as const } : i) });
  };

  const filteredIssues = openIssues
    .filter(i => filter === 'all' || i.severity === filter)
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const errorCount = openIssues.filter(i => i.severity === 'error').length;
  const warnCount = openIssues.filter(i => i.severity === 'warning').length;

  return (
    <div className="flex flex-col h-full">
      {/* Run check button */}
      <div className="px-3 py-2 border-b border-gray-800 flex items-center gap-2 flex-shrink-0">
        <button
          onClick={runFullCheck}
          disabled={isChecking || sceneIndex.length === 0}
          className="flex-1 text-xs py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 rounded transition-colors disabled:opacity-50"
        >
          {isChecking ? '검사 중...' : '🔍 정합성 검사 실행'}
        </button>
      </div>

      {/* Summary */}
      <div className="px-3 py-2 border-b border-gray-800 flex items-center gap-3">
        <div className="flex gap-2 text-xs">
          {errorCount > 0 && (
            <span className="flex items-center gap-1 text-red-400">
              🔴 {errorCount}
            </span>
          )}
          {warnCount > 0 && (
            <span className="flex items-center gap-1 text-yellow-400">
              🟡 {warnCount}
            </span>
          )}
          {errorCount === 0 && warnCount === 0 && (
            <span className="text-green-500 text-xs">✓ 이슈 없음</span>
          )}
        </div>
        <div className="ml-auto flex gap-1">
          {(['all', 'error', 'warning', 'info'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
                filter === f ? 'bg-gray-700 text-white' : 'text-gray-600 hover:text-gray-400'
              }`}
            >
              {f === 'all' ? '전체' : f === 'error' ? '오류' : f === 'warning' ? '경고' : '정보'}
            </button>
          ))}
        </div>
      </div>

      {/* Issue list */}
      <div className="flex-1 overflow-y-auto">
        {filteredIssues.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-600">
            {filter === 'all' ? '이슈가 없습니다' : `${filter} 이슈가 없습니다`}
          </div>
        ) : (
          filteredIssues.map(issue => (
            <div key={issue.id} className="group border-b border-gray-800/50 px-3 py-3">
              <div className="flex items-start gap-2">
                <span className="text-sm flex-shrink-0 mt-0.5">{SEVERITY_ICON[issue.severity]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-200 leading-relaxed">{issue.description}</p>
                  {issue.suggestion && (
                    <p className="text-xs text-gray-500 mt-1">💡 {issue.suggestion}</p>
                  )}
                  {issue.scenes && issue.scenes.length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {issue.scenes.map(s => (
                        <span key={s} className="text-xs bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded font-mono">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity pl-6">
                <button
                  onClick={() => handleResolve(issue.id)}
                  className="text-xs text-green-500 hover:text-green-400"
                >
                  해결됨
                </button>
                <button
                  onClick={() => handleIgnore(issue.id)}
                  className="text-xs text-gray-600 hover:text-gray-400"
                >
                  무시
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Last checked */}
      {data?.lastChecked && (
        <div className="px-3 py-2 border-t border-gray-800 text-xs text-gray-700">
          마지막 검사: {new Date(data.lastChecked).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
    </div>
  );
}
