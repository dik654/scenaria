import { useState, useEffect } from 'react';
import { useSceneStore } from '../store/sceneStore';
import { useProjectStore } from '../store/projectStore';
import { useStoryStore } from '../store/storyStore';
import { useConfirm } from '../components/ConfirmDialog';
import { fileIO } from '../io';
import { Sparkles, Loader2 } from 'lucide-react';
import type { SceneIndexEntry } from '../types/scene';
import { useVisualizationAI } from './hooks/useVisualizationAI';
import {
  SYSTEM_BEAT_GENERATION,
  buildBeatGenPrompt,
  type BeatGenResult,
} from '../ai/prompts/visualizationGen';

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
  1: 'border-blue-200 bg-blue-50/50',
  2: 'border-purple-200 bg-purple-50/50',
  3: 'border-green-200 bg-green-50/50',
};

const ACT_LABEL_COLORS: Record<number, string> = {
  1: 'text-blue-400',
  2: 'text-purple-400',
  3: 'text-green-400',
};

export function BeatBoard({ onSceneSelect }: { onSceneSelect?: (sceneId: string) => void }) {
  const { index: scenes } = useSceneStore();
  const { projectRef } = useProjectStore();
  const { structure, setStructure } = useStoryStore();
  const confirm = useConfirm();
  const [assignments, setAssignments] = useState<BeatAssignments>({ assignments: {} });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [draggingScene, setDraggingScene] = useState<SceneIndexEntry | null>(null);
  const [showAutoAssign, setShowAutoAssign] = useState(false);
  const [suggestedScenes, setSuggestedScenes] = useState<BeatGenResult['suggestedScenes'] | null>(null);
  const [aiRequirements, setAiRequirements] = useState('');
  const [showRequirements, setShowRequirements] = useState(false);

  // AI beat descriptions from storyStore (merged with defaults)
  const getBeatDescription = (beatId: string, defaultDesc: string): string => {
    const storeBeat = structure?.beats?.find(b => b.id === beatId);
    return storeBeat?.description || defaultDesc;
  };

  const { generate, generating, streamText, error, stop } = useVisualizationAI<BeatGenResult>({
    systemPrompt: SYSTEM_BEAT_GENERATION,
    buildUserPrompt: buildBeatGenPrompt,
    maxTokens: 4096,
  });

  useEffect(() => {
    if (!projectRef) return;
    fileIO.readJSON<BeatAssignments>(projectRef, 'story/beats.json')
      .then(data => setAssignments(data))
      .catch(() => {
        // Auto-assign by position on first load
        autoAssign();
      });
  }, [projectRef]);

  const saveAssignments = async (next: BeatAssignments) => {
    setAssignments(next);
    if (!projectRef) return;
    try {
      await fileIO.writeJSON(projectRef, 'story/beats.json', next);
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

  const handleAIGenerate = async (requirements?: string) => {
    if (structure?.beats?.length) {
      const ok = await confirm('기존 비트 설명을 AI 생성 결과로 대체합니다. 계속하시겠습니까?');
      if (!ok) return;
    }
    const result = await generate(requirements);
    if (!result) return;

    // Update storyStore structure with AI-generated beat descriptions
    const beats = BEATS.map(b => ({
      id: b.id,
      name: b.koreanName,
      description: result.beatDescriptions[b.id] ?? b.description,
      relativePosition: b.position,
      act: b.act <= 1 ? '1막' as const : b.act === 2 ? '2막 전반' as const : '3막' as const,
    }));
    const newStructure = {
      templateName: 'Save The Cat',
      acts: structure?.acts ?? [
        { name: '1막', startPercent: 0, endPercent: 20 },
        { name: '2막 전반', startPercent: 20, endPercent: 50 },
        { name: '2막 후반', startPercent: 50, endPercent: 80 },
        { name: '3막', startPercent: 80, endPercent: 100 },
      ],
      beats,
      availableTemplates: structure?.availableTemplates ?? ['3막 구조', 'Save The Cat', '영웅의 여정', '5막 구조'],
    };
    setStructure(newStructure);
    if (projectRef) {
      await fileIO.writeJSON(projectRef, 'story/structure.json', newStructure).catch(console.error);
    }

    // Store suggested scenes for display
    if (result.suggestedScenes) {
      setSuggestedScenes(result.suggestedScenes);
    }
    setShowRequirements(false);
    setAiRequirements('');
  };

  const unassignedScenes = scenes.filter(s =>
    !Object.values(assignments.assignments).flat().includes(s.id)
  );

  const actGroups = [1, 2, 3] as const;

  // Empty state — no scenes and no AI-generated descriptions
  const hasAIDescriptions = structure?.beats?.some(b => b.description && !BEATS.find(d => d.id === b.id && d.description === b.description));
  if (scenes.length === 0 && !hasAIDescriptions && !generating) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-600">비트 보드</span>
            <span className="text-xs text-gray-600">Blake Snyder Beat Sheet</span>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-3">
          <Sparkles className="w-8 h-8 text-violet-300" />
          <p className="text-sm text-gray-500 text-center">AI가 프로젝트 정보를 바탕으로 비트별 씬 구성을 제안합니다</p>
          <p className="text-xs text-gray-400 text-center">캐릭터, 로그라인, 장르 등을 자동으로 참고합니다</p>
          {error && <p className="text-xs text-red-500">{error}</p>}
          {!showRequirements ? (
            <div className="flex flex-col gap-2 w-full max-w-sm mt-2">
              <button
                onClick={() => handleAIGenerate()}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium bg-violet-500 hover:bg-violet-600 text-white rounded transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                AI로 자동 생성
              </button>
              <button
                onClick={() => setShowRequirements(true)}
                className="w-full py-2 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded transition-colors"
              >
                요구사항 직접 입력
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 w-full max-w-sm mt-2">
              <textarea
                value={aiRequirements}
                onChange={e => setAiRequirements(e.target.value)}
                placeholder="원하는 방향을 설명해주세요 (예: 반전이 많은 스릴러, 주인공의 내면 갈등 중심)"
                rows={3}
                className="w-full bg-gray-50 text-gray-800 text-xs px-3 py-2 rounded border border-gray-200 focus:outline-none focus:border-violet-400 resize-none"
              />
              <div className="flex gap-2">
                <button onClick={() => setShowRequirements(false)} className="flex-1 py-2 text-xs border border-gray-200 rounded text-gray-500 hover:bg-gray-50">취소</button>
                <button
                  onClick={() => handleAIGenerate(aiRequirements)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium bg-violet-500 hover:bg-violet-600 text-white rounded"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  생성
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Generating state
  if (generating) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-600">비트 보드</span>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
          <span className="text-xs text-gray-500">AI가 비트 구조를 생성하고 있습니다...</span>
          {streamText && (
            <pre className="text-xs text-gray-400 whitespace-pre-wrap max-h-40 overflow-y-auto font-mono leading-relaxed w-full max-w-lg">
              {streamText.slice(-400)}
            </pre>
          )}
          <button onClick={stop} className="text-xs text-red-500 hover:text-red-400 border border-red-200 rounded px-3 py-1">중단</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-gray-600">비트 보드</span>
          <span className="text-xs text-gray-600">Blake Snyder Beat Sheet</span>
        </div>
        <div className="flex items-center gap-2">
          {unassignedScenes.length > 0 && (
            <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded">
              미배정 {unassignedScenes.length}씬
            </span>
          )}
          <button
            onClick={() => handleAIGenerate()}
            className="text-xs text-violet-500 hover:text-violet-700 border border-violet-200 rounded px-2 py-0.5 transition-colors flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3" />
            AI 생성
          </button>
          <button
            onClick={() => setShowAutoAssign(true)}
            className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded px-2 py-0.5 transition-colors"
          >
            자동 배정
          </button>
        </div>
      </div>

      {/* Auto-assign confirm */}
      {showAutoAssign && (
        <div className="flex items-center gap-3 px-4 py-2 bg-yellow-50 border-b border-yellow-200 text-xs flex-shrink-0">
          <span className="text-yellow-600">씬 번호 기준으로 자동 배정하시겠습니까?</span>
          <button onClick={autoAssign} className="text-green-400 hover:text-green-300">확인</button>
          <button onClick={() => setShowAutoAssign(false)} className="text-gray-500 hover:text-gray-400">취소</button>
        </div>
      )}

      {error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-100 text-xs text-red-500 flex-shrink-0">
          {error}
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
                  const desc = getBeatDescription(beat.id, beat.description);
                  const suggested = suggestedScenes?.[beat.id];

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
                          <span className="text-xs font-bold text-gray-800 truncate">{beat.koreanName}</span>
                          <span className="text-xs text-gray-600 ml-1">{Math.round(beat.position * 100)}%</span>
                        </div>
                        <p className="text-xs text-gray-500 leading-tight">
                          {isExpanded ? desc : desc.slice(0, 30) + (desc.length > 30 ? '…' : '')}
                        </p>
                      </div>

                      {/* AI suggested scenes */}
                      {isExpanded && suggested && suggested.length > 0 && (
                        <div className="mt-1.5 space-y-1">
                          {suggested.map((s, i) => (
                            <div key={i} className="text-xs text-violet-500 bg-violet-50 rounded px-1.5 py-0.5 leading-tight">
                              {s.location} — {s.summary}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Assigned scenes */}
                      <div className="mt-2 space-y-1">
                        {assignedScenes.map(scene => (
                          <div
                            key={scene.id}
                            draggable
                            onDragStart={() => setDraggingScene(scene)}
                            className="group flex items-center gap-1 bg-gray-100 rounded px-2 py-1 cursor-grab hover:bg-gray-100 transition-colors"
                          >
                            <button
                              onClick={() => onSceneSelect?.(scene.id)}
                              className="text-xs text-blue-500 font-mono font-bold shrink-0 hover:text-blue-600"
                            >
                              장면 {scene.number}
                            </button>
                            <span className="text-xs text-gray-600 truncate flex-1">{scene.location}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeFromBeat(beat.id, scene.id); }}
                              className="text-gray-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        {assignedScenes.length === 0 && !suggested?.length && (
                          <div className="text-xs text-gray-400 text-center py-2 border border-dashed border-gray-200 rounded">
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
          <div className="mt-4 border-t border-gray-200 pt-4">
            <p className="text-xs text-gray-600 mb-2">미배정 씬 (드래그하여 비트에 배정)</p>
            <div className="flex flex-wrap gap-2">
              {unassignedScenes.map(scene => (
                <div
                  key={scene.id}
                  draggable
                  onDragStart={() => setDraggingScene(scene)}
                  className="flex items-center gap-1 bg-gray-100 rounded px-2 py-1 cursor-grab hover:bg-gray-100 transition-colors"
                >
                  <span className="text-xs text-blue-500 font-mono font-bold">장면 {scene.number}</span>
                  <span className="text-xs text-gray-600">{scene.location}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
