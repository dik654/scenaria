import { useState, useEffect } from 'react';
import { useSceneStore } from '../store/sceneStore';
import { useProjectStore } from '../store/projectStore';
import { fileIO } from '../io';
import type { SceneIndexEntry } from '../types/scene';

// Blake Snyder Beat Sheet (Save the Cat)
interface Beat {
  id: string;
  name: string;
  koreanName: string;
  description: string;
  position: number;  // 0-1 normalized position in screenplay
  act: 1 | 2 | 3;
  color: string;
}

const BEATS: Beat[] = [
  { id: 'opening_image',   name: 'Opening Image',   koreanName: '오프닝 이미지',  description: '첫 씬. 주인공의 현재 세계를 보여준다.',         position: 0.01, act: 1, color: '#4B5563' },
  { id: 'theme_stated',    name: 'Theme Stated',    koreanName: '테마 제시',      description: '영화의 주제가 암시 또는 직접 언급된다.',         position: 0.05, act: 1, color: '#374151' },
  { id: 'setup',           name: 'Setup',           koreanName: '설정',           description: '주인공과 세계, 결점, 필요가 소개된다.',          position: 0.08, act: 1, color: '#374151' },
  { id: 'catalyst',        name: 'Catalyst',        koreanName: '촉매',           description: '인생을 바꾸는 사건. 이야기가 시작된다.',         position: 0.10, act: 1, color: '#1E3A5F' },
  { id: 'debate',          name: 'Debate',          koreanName: '갈등',           description: '주인공이 도전을 받아들일지 망설인다.',            position: 0.15, act: 1, color: '#374151' },
  { id: 'break_into_two',  name: 'Break into Two',  koreanName: '2막 진입',       description: '주인공이 결심하고 새로운 세계로 들어간다.',       position: 0.20, act: 2, color: '#1E3A5F' },
  { id: 'b_story',         name: 'B Story',         koreanName: 'B 스토리',       description: '주로 사랑 이야기. 테마를 전달하는 보조 플롯.',    position: 0.22, act: 2, color: '#374151' },
  { id: 'fun_and_games',   name: 'Fun and Games',   koreanName: '재미와 게임',    description: '새 세계의 약속을 실현한다. 영화의 트레일러.',     position: 0.35, act: 2, color: '#374151' },
  { id: 'midpoint',        name: 'Midpoint',        koreanName: '중간점',         description: '가짜 승리 또는 가짜 패배. 위험이 올라간다.',     position: 0.50, act: 2, color: '#7C3AED' },
  { id: 'bad_guys',        name: 'Bad Guys Close In', koreanName: '악당 접근',    description: '반대 세력이 강화되고 팀 내부가 분열된다.',        position: 0.62, act: 2, color: '#374151' },
  { id: 'all_is_lost',     name: 'All Is Lost',     koreanName: '모든 것을 잃다', description: '가짜 패배의 순간. 멘토가 죽거나 실패한다.',       position: 0.75, act: 2, color: '#7F1D1D' },
  { id: 'dark_night',      name: 'Dark Night',      koreanName: '어두운 밤',      description: '주인공이 포기를 고려하는 가장 낮은 순간.',        position: 0.78, act: 2, color: '#450A0A' },
  { id: 'break_into_three',name: 'Break into Three', koreanName: '3막 진입',      description: 'A와 B 스토리가 교차하여 해결책을 발견한다.',     position: 0.80, act: 3, color: '#1E3A5F' },
  { id: 'finale',          name: 'Finale',          koreanName: '피날레',         description: '주인공이 배운 것으로 악당을 물리친다.',           position: 0.88, act: 3, color: '#14532D' },
  { id: 'final_image',     name: 'Final Image',     koreanName: '마지막 이미지',  description: '오프닝 이미지의 반대. 주인공의 변화를 보여준다.', position: 0.99, act: 3, color: '#374151' },
];

// Beat assignment stored in story/beats.json
interface BeatAssignments {
  assignments: Record<string, string[]>; // beatId → sceneId[]
}

const ACT_COLORS: Record<number, string> = {
  1: 'border-blue-800/50 bg-blue-950/20',
  2: 'border-purple-800/50 bg-purple-950/20',
  3: 'border-green-800/50 bg-green-950/20',
};

const ACT_LABEL_COLORS: Record<number, string> = {
  1: 'text-blue-400',
  2: 'text-purple-400',
  3: 'text-green-400',
};

export function BeatBoard({ onSceneSelect }: { onSceneSelect?: (sceneId: string) => void }) {
  const { index: scenes } = useSceneStore();
  const { dirHandle } = useProjectStore();
  const [assignments, setAssignments] = useState<BeatAssignments>({ assignments: {} });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [draggingScene, setDraggingScene] = useState<SceneIndexEntry | null>(null);
  const [showAutoAssign, setShowAutoAssign] = useState(false);

  useEffect(() => {
    if (!dirHandle) return;
    fileIO.readJSON<BeatAssignments>(dirHandle, 'story/beats.json')
      .then(data => setAssignments(data))
      .catch(() => {
        // Auto-assign by position on first load
        autoAssign();
      });
  }, [dirHandle]);

  const saveAssignments = async (next: BeatAssignments) => {
    setAssignments(next);
    if (!dirHandle) return;
    try {
      await fileIO.writeJSON(dirHandle, 'story/beats.json', next);
    } catch (e) {
      console.error('비트 저장 실패:', e);
    }
  };

  const autoAssign = () => {
    const total = scenes.length;
    if (total === 0) return;
    const newAssign: Record<string, string[]> = {};
    for (const beat of BEATS) newAssign[beat.id] = [];

    for (const scene of scenes) {
      const pos = (scene.number - 1) / Math.max(1, total - 1);
      // Find closest beat zone
      let closest = BEATS[0];
      let minDist = Math.abs(BEATS[0].position - pos);
      for (const b of BEATS) {
        const d = Math.abs(b.position - pos);
        if (d < minDist) { minDist = d; closest = b; }
      }
      newAssign[closest.id].push(scene.id);
    }
    const next = { assignments: newAssign };
    saveAssignments(next);
    setShowAutoAssign(false);
  };

  const handleDrop = (beatId: string, e: React.DragEvent) => {
    e.preventDefault();
    if (!draggingScene) return;
    const sceneId = draggingScene.id;
    const next: BeatAssignments = { assignments: {} };
    for (const b of BEATS) {
      next.assignments[b.id] = (assignments.assignments[b.id] ?? []).filter(id => id !== sceneId);
    }
    next.assignments[beatId] = [...(next.assignments[beatId] ?? []), sceneId];
    saveAssignments(next);
    setDraggingScene(null);
  };

  const removeFromBeat = (beatId: string, sceneId: string) => {
    const next: BeatAssignments = {
      assignments: {
        ...assignments.assignments,
        [beatId]: (assignments.assignments[beatId] ?? []).filter(id => id !== sceneId),
      }
    };
    saveAssignments(next);
  };

  const unassignedScenes = scenes.filter(s =>
    !Object.values(assignments.assignments).flat().includes(s.id)
  );

  const actGroups = [1, 2, 3] as const;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-gray-400">비트 보드</span>
          <span className="text-xs text-gray-600">Blake Snyder Beat Sheet</span>
        </div>
        <div className="flex items-center gap-2">
          {unassignedScenes.length > 0 && (
            <span className="text-xs text-yellow-600 bg-yellow-950/50 px-2 py-0.5 rounded">
              미배정 {unassignedScenes.length}씬
            </span>
          )}
          <button
            onClick={() => setShowAutoAssign(true)}
            className="text-xs text-gray-500 hover:text-gray-300 border border-gray-700 rounded px-2 py-0.5 transition-colors"
          >
            자동 배정
          </button>
        </div>
      </div>

      {/* Auto-assign confirm */}
      {showAutoAssign && (
        <div className="flex items-center gap-3 px-4 py-2 bg-yellow-950/30 border-b border-yellow-800/30 text-xs flex-shrink-0">
          <span className="text-yellow-400">씬 번호 기준으로 자동 배정하시겠습니까?</span>
          <button onClick={autoAssign} className="text-green-400 hover:text-green-300">확인</button>
          <button onClick={() => setShowAutoAssign(false)} className="text-gray-500 hover:text-gray-400">취소</button>
        </div>
      )}

      {/* Board - scrollable horizontally */}
      <div className="flex-1 overflow-auto p-4">
        {actGroups.map(act => {
          const actBeats = BEATS.filter(b => b.act === act);
          return (
            <div key={act} className="mb-6">
              {/* Act header */}
              <div className={`text-xs font-bold mb-2 ${ACT_LABEL_COLORS[act]}`}>
                {act === 1 ? '1막 — 설정 (0%~20%)' : act === 2 ? '2막 — 대립 (20%~80%)' : '3막 — 해결 (80%~100%)'}
              </div>
              {/* Beat columns */}
              <div className="flex gap-3 min-w-0">
                {actBeats.map(beat => {
                  const assignedIds = assignments.assignments[beat.id] ?? [];
                  const assignedScenes = assignedIds
                    .map(id => scenes.find(s => s.id === id))
                    .filter(Boolean) as SceneIndexEntry[];
                  const isExpanded = expanded === beat.id;

                  return (
                    <div
                      key={beat.id}
                      className={`flex-shrink-0 border rounded-lg p-3 transition-colors ${ACT_COLORS[act]} ${
                        draggingScene ? 'border-dashed' : ''
                      }`}
                      style={{ width: '160px', minHeight: '120px' }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDrop(beat.id, e)}
                    >
                      {/* Beat name */}
                      <div
                        className="cursor-pointer"
                        onClick={() => setExpanded(isExpanded ? null : beat.id)}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-bold text-white truncate">{beat.koreanName}</span>
                          <span className="text-xs text-gray-600 ml-1">{Math.round(beat.position * 100)}%</span>
                        </div>
                        <p className="text-xs text-gray-500 leading-tight">
                          {isExpanded ? beat.description : beat.description.slice(0, 30) + '…'}
                        </p>
                      </div>

                      {/* Assigned scenes */}
                      <div className="mt-2 space-y-1">
                        {assignedScenes.map(scene => (
                          <div
                            key={scene.id}
                            draggable
                            onDragStart={() => setDraggingScene(scene)}
                            className="group flex items-center gap-1 bg-gray-800/60 rounded px-2 py-1 cursor-grab hover:bg-gray-700/60 transition-colors"
                          >
                            <button
                              onClick={() => onSceneSelect?.(scene.id)}
                              className="text-xs text-red-400 font-mono font-bold shrink-0 hover:text-red-300"
                            >
                              S#{scene.number}
                            </button>
                            <span className="text-xs text-gray-300 truncate flex-1">{scene.location}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeFromBeat(beat.id, scene.id); }}
                              className="text-gray-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        {assignedScenes.length === 0 && (
                          <div className="text-xs text-gray-700 text-center py-2 border border-dashed border-gray-800 rounded">
                            씬 드래그
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Unassigned pool */}
        {unassignedScenes.length > 0 && (
          <div className="mt-4 border-t border-gray-800 pt-4">
            <p className="text-xs text-gray-600 mb-2">미배정 씬 (드래그하여 비트에 배정)</p>
            <div className="flex flex-wrap gap-2">
              {unassignedScenes.map(scene => (
                <div
                  key={scene.id}
                  draggable
                  onDragStart={() => setDraggingScene(scene)}
                  className="flex items-center gap-1 bg-gray-800 rounded px-2 py-1 cursor-grab hover:bg-gray-700 transition-colors"
                >
                  <span className="text-xs text-red-400 font-mono font-bold">S#{scene.number}</span>
                  <span className="text-xs text-gray-300">{scene.location}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
