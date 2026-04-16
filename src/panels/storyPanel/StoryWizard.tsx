import { useState, useRef, useMemo } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useStoryStore } from '../../store/storyStore';
import { useCharacterStore } from '../../store/characterStore';
import { useAIActivityStore } from '../../store/aiActivityStore';
import { callAIStream, findBalancedJSON } from '../../ai/aiClient';
import { fileIO } from '../../io';
import { nanoid } from 'nanoid';
import {
  SYSTEM_STORY_WIZARD,
  buildWizardPrompt,
  type WizardResult,
  type WizardBeat,
  type WizardThread,
} from '../../ai/prompts/storyWizard';
import { Sparkles, Loader2, Check, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';

const GENRE_OPTIONS = ['드라마', '스릴러', '로맨스', '코미디', '범죄', '액션', 'SF', '공포', '미스터리', '시대극'];

export function StoryWizard() {
  const { projectRef, meta, settings, setProject } = useProjectStore();
  const { setStructure, loadThread, addThreadToIndex, setThreadIndex } = useStoryStore();
  const { index: charIndex, characters: charMap } = useCharacterStore();
  const aiActivity = useAIActivityStore();

  const [premise, setPremise] = useState('');
  const [genre, setGenre] = useState('');
  const [generating, setGenerating] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [result, setResult] = useState<WizardResult | null>(null);
  const [error, setError] = useState('');
  const [applied, setApplied] = useState(false);
  const [expandedBeat, setExpandedBeat] = useState<string | null>(null);
  const abortRef = useRef(false);

  // Derive characters from store
  const characters = useMemo(() =>
    charIndex.map(c => {
      const full = charMap[c.id];
      return {
        name: c.name,
        description: full?.description,
        goal: full?.drama?.goal,
        flaw: full?.drama?.flaw,
      };
    }).filter(c => c.name),
    [charIndex, charMap],
  );

  const canGenerate = premise.trim().length > 10 && !generating;

  const generate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    setError('');
    setResult(null);
    setApplied(false);
    setStreamText('');
    abortRef.current = false;
    aiActivity.start();

    try {
      const userPrompt = buildWizardPrompt(premise, genre, characters.length > 0 ? characters : undefined);
      let accumulated = '';

      for await (const chunk of callAIStream(settings.ai, SYSTEM_STORY_WIZARD, userPrompt, 4096)) {
        if (abortRef.current) break;
        accumulated += chunk;
        setStreamText(accumulated);
      }

      if (abortRef.current) {
        setError('생성이 중단되었습니다.');
        return;
      }

      // Parse JSON — strip markdown fences and think tags
      let cleaned = accumulated.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) cleaned = fenceMatch[1].trim();
      // Use balanced brace matching to ignore trailing metadata (e.g. Gemini grounding)
      const jsonStr = findBalancedJSON(cleaned);

      if (!jsonStr) {
        setError('AI 응답에서 JSON을 찾을 수 없습니다. 다시 시도해주세요.');
        return;
      }

      const parsed = JSON.parse(jsonStr) as WizardResult;

      // Validate beats exist
      if (!parsed.beats?.length) {
        setError('비트 정보가 없습니다. 다시 시도해주세요.');
        return;
      }

      setResult(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : '생성 중 오류가 발생했습니다.');
    } finally {
      setGenerating(false);
      aiActivity.stop();
    }
  };

  const handleStop = () => {
    abortRef.current = true;
  };

  const updateBeat = (index: number, field: keyof WizardBeat, value: string) => {
    if (!result) return;
    const beats = [...result.beats];
    beats[index] = { ...beats[index], [field]: value };
    setResult({ ...result, beats });
  };

  const updateThread = (index: number, field: keyof WizardThread, value: string) => {
    if (!result) return;
    const threads = [...result.threads];
    threads[index] = { ...threads[index], [field]: value };
    setResult({ ...result, threads });
  };

  const removeThread = (index: number) => {
    if (!result) return;
    setResult({ ...result, threads: result.threads.filter((_, i) => i !== index) });
  };

  const apply = async () => {
    if (!result || !projectRef || !meta) return;

    try {
      // 1. Update project logline
      const updatedMeta = { ...meta, logline: result.logline };
      await fileIO.writeJSON(projectRef, 'project.json', updatedMeta);
      setProject(projectRef, updatedMeta);

      // 2. Save structure (beats)
      const structure = {
        templateName: 'Save The Cat',
        acts: [
          { name: '1막', label: '설정', startPercent: 0, endPercent: 25 },
          { name: '2막 전반', label: '대립', startPercent: 25, endPercent: 50 },
          { name: '2막 후반', label: '위기', startPercent: 50, endPercent: 75 },
          { name: '3막', label: '해결', startPercent: 75, endPercent: 100 },
        ],
        beats: result.beats.map(b => ({
          id: b.id,
          name: b.name,
          description: b.description,
          relativePosition: b.relativePosition,
          act: b.act,
          isRequired: true,
          linkedEventId: null,
        })),
        availableTemplates: ['3막 구조', 'Save The Cat', '영웅의 여정', '5막 구조'],
      };
      setStructure(structure);
      await fileIO.writeJSON(projectRef, 'story/structure.json', structure);

      // 3. Create plot threads
      const COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];
      const newThreads: { id: string; name: string; color: string; description: string; sceneIds: string[] }[] = [];
      const newThreadIdx: { id: string; filename: string; name: string }[] = [];

      for (let i = 0; i < result.threads.length; i++) {
        const t = result.threads[i];
        const id = nanoid(8);
        const thread = {
          id,
          name: t.name,
          color: t.color || COLORS[i % COLORS.length],
          description: t.description,
          characterIds: [] as string[],
          eventIds: [] as string[],
          sceneIds: [] as string[],
        };
        loadThread(id, thread);
        newThreadIdx.push({ id, filename: `${id}.json`, name: t.name });
        newThreads.push({ id, name: t.name, color: thread.color, description: t.description, sceneIds: [] });
      }
      setThreadIndex(newThreadIdx);
      // addThreadToIndex already done via setThreadIndex

      // Write threads file (legacy format)
      await fileIO.writeJSON(projectRef, 'story/plot_threads.json', { threads: newThreads });

      setApplied(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '적용 중 오류가 발생했습니다.');
    }
  };

  // ── Render ──

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Input Section */}
      <div className="px-4 py-4 space-y-3 border-b border-gray-200">
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">전제 / 아이디어</label>
          <textarea
            value={premise}
            onChange={e => setPremise(e.target.value)}
            placeholder="주인공이 누구이며, 무엇을 원하고, 무엇이 방해하는가?&#10;&#10;예: 은퇴한 형사가 딸의 실종 사건을 수사하면서 30년 전 자신이 미해결로 남긴 사건과의 연결을 발견한다."
            rows={4}
            className="w-full bg-gray-50 text-gray-800 text-xs px-3 py-2 rounded border border-gray-200 focus:outline-none focus:border-blue-400 resize-none"
            disabled={generating}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">장르</label>
          <div className="flex flex-wrap gap-1.5">
            {GENRE_OPTIONS.map(g => (
              <button
                key={g}
                onClick={() => setGenre(genre === g ? '' : g)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  genre === g
                    ? 'bg-blue-50 border-blue-300 text-blue-600'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
                disabled={generating}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Characters summary */}
        {characters.length > 0 && (
          <div className="text-xs text-gray-400">
            등록된 캐릭터 {characters.length}명: {characters.map(c => c.name).join(', ')}
          </div>
        )}

        {/* Generate / Stop button */}
        <div className="flex gap-2">
          {!generating ? (
            <button
              onClick={generate}
              disabled={!canGenerate}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium bg-violet-500 hover:bg-violet-600 text-white rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-3.5 h-3.5" />
              스토리 구조 생성
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium bg-red-50 text-red-500 border border-red-200 rounded transition-colors hover:bg-red-100"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              생성 중단
            </button>
          )}
        </div>
      </div>

      {/* Streaming preview */}
      {generating && streamText && (
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-400 mb-1">생성 중...</p>
          <pre className="text-xs text-gray-500 whitespace-pre-wrap max-h-32 overflow-y-auto font-mono leading-relaxed">
            {streamText.slice(-500)}
          </pre>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-50 text-xs text-red-500 border-b border-red-100">
          {error}
        </div>
      )}

      {/* Result preview */}
      {result && (
        <div className="flex-1 overflow-y-auto">
          {/* Logline */}
          <div className="px-4 py-3 border-b border-gray-200">
            <label className="text-xs font-medium text-gray-400 block mb-1">로그라인</label>
            <input
              value={result.logline}
              onChange={e => setResult({ ...result, logline: e.target.value })}
              className="w-full bg-gray-50 text-gray-800 text-xs px-3 py-1.5 rounded border border-gray-200 focus:outline-none focus:border-blue-400"
              disabled={applied}
            />
          </div>

          {/* Premise */}
          <div className="px-4 py-3 border-b border-gray-200">
            <label className="text-xs font-medium text-gray-400 block mb-1">시놉시스</label>
            <textarea
              value={result.premise}
              onChange={e => setResult({ ...result, premise: e.target.value })}
              rows={3}
              className="w-full bg-gray-50 text-gray-800 text-xs px-3 py-1.5 rounded border border-gray-200 focus:outline-none focus:border-blue-400 resize-none"
              disabled={applied}
            />
          </div>

          {/* Beats */}
          <div className="px-4 py-3 border-b border-gray-200">
            <label className="text-xs font-medium text-gray-400 block mb-2">
              비트 구조 ({result.beats.length}개)
            </label>
            <div className="space-y-1">
              {result.beats.map((beat, i) => {
                const isExpanded = expandedBeat === beat.id;
                const actLabel = beat.act === 1 ? '1막' : beat.act === 2 ? '2막' : '3막';
                const actColor = beat.act === 1 ? 'text-blue-500' : beat.act === 2 ? 'text-amber-500' : 'text-rose-500';

                return (
                  <div key={beat.id} className="border border-gray-100 rounded">
                    <button
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-50 transition-colors"
                      onClick={() => setExpandedBeat(isExpanded ? null : beat.id)}
                    >
                      {isExpanded
                        ? <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
                        : <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />}
                      <span className={`text-xs font-mono ${actColor} flex-shrink-0`}>{actLabel}</span>
                      <span className="text-xs text-gray-700 font-medium truncate">{beat.name}</span>
                      <span className="text-xs text-gray-400 ml-auto flex-shrink-0">{Math.round(beat.relativePosition * 100)}%</span>
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-2">
                        <textarea
                          value={beat.description}
                          onChange={e => updateBeat(i, 'description', e.target.value)}
                          rows={2}
                          className="w-full bg-gray-50 text-gray-600 text-xs px-2 py-1 rounded border border-gray-200 focus:outline-none focus:border-blue-400 resize-none"
                          disabled={applied}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Threads */}
          <div className="px-4 py-3 border-b border-gray-200">
            <label className="text-xs font-medium text-gray-400 block mb-2">
              플롯 스레드 ({result.threads.length}개)
            </label>
            <div className="space-y-2">
              {result.threads.map((thread, i) => (
                <div key={i} className="flex items-start gap-2 border border-gray-100 rounded px-3 py-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: thread.color }} />
                  <div className="flex-1 min-w-0">
                    <input
                      value={thread.name}
                      onChange={e => updateThread(i, 'name', e.target.value)}
                      className="w-full bg-transparent text-xs text-gray-700 font-medium focus:outline-none"
                      disabled={applied}
                    />
                    <input
                      value={thread.description}
                      onChange={e => updateThread(i, 'description', e.target.value)}
                      className="w-full bg-transparent text-xs text-gray-500 focus:outline-none mt-0.5"
                      disabled={applied}
                    />
                  </div>
                  {!applied && (
                    <button
                      onClick={() => removeThread(i)}
                      className="text-xs text-gray-400 hover:text-red-400 flex-shrink-0"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Apply / Regenerate buttons */}
          <div className="px-4 py-3 flex gap-2">
            {!applied ? (
              <>
                <button
                  onClick={apply}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium bg-green-500 hover:bg-green-600 text-white rounded transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  프로젝트에 적용
                </button>
                <button
                  onClick={generate}
                  disabled={!canGenerate}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs text-gray-500 border border-gray-200 rounded hover:bg-gray-50 transition-colors disabled:opacity-40"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  재생성
                </button>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-green-600 bg-green-50 rounded">
                <Check className="w-3.5 h-3.5" />
                적용 완료 — 비트 보드와 플롯 스레드에서 확인하세요
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!generating && !result && !error && (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 px-8">
          <Sparkles className="w-8 h-8 mb-3 text-violet-300" />
          <p className="text-sm text-center">
            전제를 입력하면 AI가 15비트 스토리 구조와 플롯 스레드를 생성합니다
          </p>
          <p className="text-xs text-center mt-1 text-gray-300">
            캐릭터가 등록되어 있으면 자동으로 반영됩니다
          </p>
        </div>
      )}
    </div>
  );
}
