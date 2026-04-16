import { useEffect, useState } from 'react';
import { GitBranch } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { useSceneStore } from '../store/sceneStore';
import { useHistoryStore } from '../store/historyStore';
import { useAIActivityStore } from '../store/aiActivityStore';

function Dot() {
  return <span className="text-zinc-300 select-none">&middot;</span>;
}

export function StatusBar() {
  const { meta, historyManager } = useProjectStore();
  const { currentScene, index, isDirty } = useSceneStore();
  const { savePoints } = useHistoryStore();
  const aiActive = useAIActivityStore((s) => s.activeCount > 0);
  const [lastSaveLabel, setLastSaveLabel] = useState('');

  // Current branch
  const [branch, setBranch] = useState('원본');
  useEffect(() => {
    historyManager?.getCurrentBranch?.().then(setBranch).catch(() => {});
  }, [historyManager, savePoints]);

  // Last save time
  useEffect(() => {
    if (!savePoints.length) { setLastSaveLabel(''); return; }
    const latest = savePoints[savePoints.length - 1];
    const update = () => {
      const diff = Date.now() - new Date(latest.timestamp).getTime();
      if (diff < 60_000) setLastSaveLabel('방금 저장');
      else if (diff < 3600_000) setLastSaveLabel(`${Math.floor(diff / 60_000)}분 전 저장`);
      else setLastSaveLabel(`${Math.floor(diff / 3600_000)}시간 전 저장`);
    };
    update();
    const interval = setInterval(update, 30_000);
    return () => clearInterval(interval);
  }, [savePoints]);

  // Window title
  useEffect(() => {
    const parts: string[] = [];
    if (currentScene) {
      const num = currentScene.id.replace('s', '').replace(/^0+/, '') || '?';
      parts.push(`장면 ${num}. ${currentScene.header.location}`);
    }
    if (meta?.title) parts.push(meta.title);
    parts.push('Scenaria');
    document.title = parts.join(' - ');
    return () => { document.title = 'Scenaria'; };
  }, [currentScene, meta]);

  const sceneNum = currentScene
    ? `장면 ${currentScene.id.replace('s', '').replace(/^0+/, '') || '?'}`
    : null;
  const totalScenes = index.length;
  const latestSaveId = savePoints.length > 0
    ? `#${savePoints[savePoints.length - 1].id}`
    : null;

  return (
    <div className="flex items-center h-7 px-3 border-t border-zinc-200/80 bg-white text-[11px] text-zinc-400 flex-shrink-0 select-none">
      {/* Branch */}
      <span className="flex items-center gap-1" title="현재 갈래">
        <GitBranch size={12} className="text-zinc-400" />
        {branch}
      </span>

      {/* Save point */}
      {latestSaveId && (
        <>
          <Dot />
          <span title="마지막 저장 지점">저장 지점 {latestSaveId}</span>
        </>
      )}

      {/* Last save label */}
      {lastSaveLabel && (
        <>
          <Dot />
          <span>{lastSaveLabel}</span>
        </>
      )}

      {/* Save status indicator */}
      <Dot />
      {isDirty ? (
        <span className="flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
          변경됨
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
          저장됨
        </span>
      )}

      {/* AI Activity */}
      {aiActive && (
        <>
          <Dot />
          <span className="flex items-center gap-1 text-blue-600">
            <span className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-1 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
            AI 생성 중
          </span>
        </>
      )}

      {/* Spacer */}
      <span className="flex-1" />

      {/* Scene count */}
      {sceneNum && (
        <span className="text-zinc-400">{sceneNum}/{totalScenes}</span>
      )}
    </div>
  );
}
