import { useState } from 'react';
import type { Scene } from '../types/scene';
import { STATUS_LABELS, STATUS_BG_BUTTON, STATUS_BG_ACTIVE } from '../utils/statusMapping';
import type { SceneStatus } from '../types/scene';
import { useProjectStore } from '../store/projectStore';
import { useSceneStore } from '../store/sceneStore';
import { useCharacterStore } from '../store/characterStore';
import { useStoryStore } from '../store/storyStore';
import { callAI } from '../ai/aiClient';
import { SYSTEM_SCENE_SUMMARY, SYSTEM_SCENE_PLAN_MEMO, buildScenePlanMemoPrompt } from '../ai/prompts/sceneMeta';
import { useAIActivityStore } from '../store/aiActivityStore';
import { TagInput } from '../components/TagInput';
import type { ProjectContext } from '../ai/prompts/visualizationGen';

const TONE_OPTIONS = [
  '희망적', '긴박한', '슬픔', '분노', '두려움', '기쁨',
  '멜랑꼴리', '우아함', '유머', '극적', '고요함', '혼란',
];

const STATUS_ORDER: SceneStatus[] = ['outline', 'draft', 'revision', 'done'];

function tensionColor(level: number): string {
  if (level <= 3) return 'text-blue-400';
  if (level <= 6) return 'text-yellow-400';
  if (level <= 8) return 'text-orange-400';
  return 'text-red-400';
}

function tensionLabel(level: number): string {
  if (level <= 2) return '평온';
  if (level <= 4) return '잔잔';
  if (level <= 6) return '보통';
  if (level <= 8) return '몰입';
  return '최고조';
}

export function SceneMetaPane({ scene, onChange, readOnly }: {
  scene: Scene;
  onChange: (updates: Partial<Scene>) => void;
  readOnly: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const { settings, meta: projectMeta } = useProjectStore();
  const { index: sceneIndex } = useSceneStore();
  const { index: charIndex, characters: charMap } = useCharacterStore();
  const { threadIndex, threads: threadMap, structure, foreshadowing } = useStoryStore();
  const aiActivity = useAIActivityStore();
  const { meta } = scene;

  const handleAISummary = async () => {
    setSummaryLoading(true);
    aiActivity.start();
    try {
      const sceneText = scene.blocks
        .map((b) => {
          if ('text' in b) return b.text;
          if (b.type === 'character') return b.characterId;
          if (b.type === 'transition') return b.transitionType;
          return '';
        })
        .filter(Boolean)
        .join('\n');

      // 이전 씬 요약 + 스레드 컨텍스트 조립
      const curIdx = sceneIndex.findIndex(s => s.id === scene.id);
      const prevSummaries = sceneIndex
        .slice(Math.max(0, curIdx - 3), curIdx)
        .filter(s => s.summary)
        .map(s => `[S#${s.number}] ${s.summary}`)
        .join('\n');
      const activeThreads = threadIndex
        .map(t => { const full = threadMap[t.id]; return full?.description ? `- ${t.name}: ${full.description}` : ''; })
        .filter(Boolean).join('\n');
      const unresolvedFs = (foreshadowing?.items ?? [])
        .filter(f => f.status === 'planted')
        .map(f => `- [${f.importance}] ${f.plantedIn.description}`)
        .join('\n');

      let contextPrefix = '';
      if (prevSummaries) contextPrefix += `## 이전 씬 요약\n${prevSummaries}\n\n`;
      if (activeThreads) contextPrefix += `## 활성 플롯 스레드\n${activeThreads}\n\n`;
      if (unresolvedFs) contextPrefix += `## 미해결 복선\n${unresolvedFs}\n\n`;

      const [summary] = await callAI(
        settings.ai,
        SYSTEM_SCENE_SUMMARY,
        `${contextPrefix}씬 헤더: ${scene.header.interior}. ${scene.header.location} - ${scene.header.timeOfDay}\n\n${sceneText}`,
        1,
      );
      onChange({ meta: { ...meta, summary } });
    } catch (err) {
      console.error('AI 요약 생성 실패:', err);
    } finally {
      setSummaryLoading(false);
      aiActivity.stop();
    }
  };

  const handleAIPlanMemo = async () => {
    setPlanLoading(true);
    aiActivity.start();
    try {
      // Gather context
      const characters: ProjectContext['characters'] = charIndex.map(c => {
        const full = charMap[c.id];
        return {
          name: c.name,
          description: full?.description,
          goal: full?.drama?.goal,
          flaw: full?.drama?.flaw,
          arc: full?.drama?.arc,
          traits: full?.personality?.traits,
        };
      }).filter(c => c.name);

      const existingThreads = threadIndex
        .map(t => threadMap[t.id])
        .filter(Boolean)
        .map(t => ({ name: t!.name, description: t!.description }));

      const existingForeshadowing = (foreshadowing?.items ?? [])
        .filter(f => f.status === 'planted')
        .map(f => ({ description: f.plantedIn.description, status: f.status, importance: f.importance }));

      const ctx: ProjectContext = {
        meta: projectMeta ? { title: projectMeta.title, logline: projectMeta.logline, genre: projectMeta.genre } : undefined,
        characters,
        existingThreads,
        existingForeshadowing,
      };

      // Scene position + beat matching
      const sceneIdx = sceneIndex.findIndex(s => s.id === scene.id);
      const scenePosition = sceneIdx >= 0 ? { current: sceneIdx + 1, total: sceneIndex.length } : undefined;

      let currentBeat: { name: string; description: string } | undefined;
      if (scenePosition && structure?.beats?.length) {
        const relPos = (scenePosition.current - 1) / Math.max(1, scenePosition.total - 1);
        let closest = structure.beats[0];
        let minDist = Math.abs((closest.relativePosition ?? 0) - relPos);
        for (const b of structure.beats) {
          const d = Math.abs((b.relativePosition ?? 0) - relPos);
          if (d < minDist) { minDist = d; closest = b; }
        }
        if (closest) currentBeat = { name: closest.name, description: closest.description };
      }

      // Adjacent scene summaries
      const prevSummaries = sceneIdx > 0
        ? sceneIndex.slice(Math.max(0, sceneIdx - 3), sceneIdx).map(s => s.summary).filter(Boolean) as string[]
        : [];
      const nextSummaries = sceneIdx >= 0
        ? sceneIndex.slice(sceneIdx + 1, sceneIdx + 3).map(s => s.summary).filter(Boolean) as string[]
        : [];

      const userPrompt = buildScenePlanMemoPrompt(ctx, scenePosition, currentBeat, prevSummaries, nextSummaries);
      const [memo] = await callAI(settings.ai, SYSTEM_SCENE_PLAN_MEMO, userPrompt, 1);
      onChange({ meta: { ...meta, summary: memo } });
    } catch (err) {
      console.error('AI 계획 메모 생성 실패:', err);
    } finally {
      setPlanLoading(false);
      aiActivity.stop();
    }
  };

  const toggleTone = (tone: string) => {
    if (readOnly) return;
    const current = meta.emotionalTone ?? [];
    const next = current.includes(tone) ? current.filter((t) => t !== tone) : [...current, tone];
    onChange({ meta: { ...meta, emotionalTone: next } });
  };

  return (
    <div className="border-t border-gray-200 bg-white flex-shrink-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        {meta.status && (
          <span className={`px-1.5 py-0.5 rounded-full text-white font-medium ${STATUS_BG_BUTTON[meta.status]}`}>
            {STATUS_LABELS[meta.status]}
          </span>
        )}
        <span className={`font-mono font-bold ${tensionColor(meta.tensionLevel ?? 5)}`}>
          몰입도 {meta.tensionLevel ?? 5}/10
        </span>
        {meta.emotionalTone?.length ? (
          <span className="text-gray-500">{meta.emotionalTone.slice(0, 3).join(' · ')}</span>
        ) : null}
        {meta.summary ? (
          <span className="flex-1 truncate text-left text-gray-600">{meta.summary}</span>
        ) : (
          <span className="flex-1 text-gray-300 italic">씬 메모 없음</span>
        )}
        <span className="text-gray-400">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 py-3 space-y-3 border-t border-gray-100">
          <div>
            <label className="text-xs text-gray-500 block mb-1">작성 상태</label>
            <div className="flex gap-1">
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  onClick={() => !readOnly && onChange({ meta: { ...meta, status: s } })}
                  className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                    meta.status === s
                      ? `${STATUS_BG_ACTIVE[s]} text-white`
                      : 'bg-gray-100 text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-500">씬 요약 / 메모</label>
              {!readOnly && settings.ai.apiKey && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleAIPlanMemo}
                    disabled={planLoading || summaryLoading}
                    title="스토리 컨텍스트 기반으로 씬 계획 메모 생성"
                    className="text-xs px-2 py-0.5 rounded bg-violet-50 text-violet-500 hover:text-violet-700 hover:bg-violet-100 transition-colors disabled:opacity-40"
                  >
                    {planLoading ? '생성 중...' : '✦ AI 계획'}
                  </button>
                  <button
                    onClick={handleAISummary}
                    disabled={summaryLoading || planLoading}
                    title="기존 씬 내용을 읽고 요약 생성"
                    className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500 hover:text-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-40"
                  >
                    {summaryLoading ? '생성 중...' : '✦ AI 요약'}
                  </button>
                </div>
              )}
            </div>
            <textarea
              value={meta.summary ?? ''}
              onChange={(e) => !readOnly && onChange({ meta: { ...meta, summary: e.target.value } })}
              readOnly={readOnly}
              rows={2}
              placeholder="이 씬에서 일어나는 일을 요약하세요..."
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100 resize-none placeholder-gray-400"
            />
          </div>

          <div className="flex items-center gap-6">
            <div className="flex-1">
              <label className={`text-xs font-medium mb-1 flex items-center gap-2 ${tensionColor(meta.tensionLevel ?? 5)}`}>
                몰입도
                <span className="font-bold">{meta.tensionLevel ?? 5}</span>
                <span className="text-gray-600 font-normal">({tensionLabel(meta.tensionLevel ?? 5)})</span>
              </label>
              <input
                type="range" min={1} max={10}
                value={meta.tensionLevel ?? 5}
                onChange={(e) => !readOnly && onChange({ meta: { ...meta, tensionLevel: Number(e.target.value) } })}
                disabled={readOnly}
                className="w-full accent-blue-500 cursor-pointer"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">예상 분량</label>
              <div className="flex items-center gap-1">
                <input
                  type="number" min={0.5} max={30} step={0.5}
                  value={meta.estimatedMinutes ?? 1}
                  onChange={(e) => !readOnly && onChange({ meta: { ...meta, estimatedMinutes: Number(e.target.value) } })}
                  readOnly={readOnly}
                  className="w-16 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700 focus:outline-none focus:border-blue-300 text-center"
                />
                <span className="text-xs text-gray-400">분</span>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">감정 톤</label>
            <div className="flex flex-wrap gap-1.5">
              {TONE_OPTIONS.map((tone) => {
                const active = (meta.emotionalTone ?? []).includes(tone);
                return (
                  <button
                    key={tone}
                    onClick={() => toggleTone(tone)}
                    disabled={readOnly}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      active
                        ? 'border-blue-400 bg-blue-50 text-blue-600'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                  >
                    {tone}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">태그</label>
            <TagInput
              tags={meta.tags ?? []}
              onChange={(tags) => !readOnly && onChange({ meta: { ...meta, tags } })}
              readOnly={readOnly}
            />
          </div>
        </div>
      )}
    </div>
  );
}
