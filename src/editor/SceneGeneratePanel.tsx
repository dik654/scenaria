import { useState, useCallback, useMemo, useRef } from 'react';
import { Sparkles, Users, FileText, Wand2, Loader2, Link2, Unlink2 } from 'lucide-react';
import { callAI, callAIStream, findBalancedJSON } from '../ai/aiClient';
import {
  SYSTEM_SCENE_FROM_CHARACTERS,
  SYSTEM_SCENE_FROM_OVERVIEW,
  SYSTEM_SCENE_ELABORATE,
  SYSTEM_SCENE_STRUCTURED,
  buildCharacterScenePrompt,
  buildOverviewScenePrompt,
  buildElaboratePrompt,
  buildStoryContext,
} from '../ai/prompts/sceneGeneration';
import { SYSTEM_SCENE_SUMMARY } from '../ai/prompts/sceneMeta';
import { getStoryContextBudget, estimateTokens } from '../ai/tokenBudget';
import { useProjectStore } from '../store/projectStore';
import { useCharacterStore } from '../store/characterStore';
import { useStoryStore } from '../store/storyStore';
import { useSceneStore } from '../store/sceneStore';
import { fileIO } from '../io';
import type { Scene, SceneBlock, CharacterState } from '../types/scene';
import type { CharacterIndexEntry } from '../types/character';

type Mode = 'characters' | 'overview' | 'elaborate';

interface SceneGeneratePanelProps {
  currentScene: Scene;
  onApply: (updates: Partial<Scene>) => void;
}

function recoverJSON(raw: string): string | null {
  // Use balanced brace matching to find the first complete JSON object
  // This correctly ignores trailing metadata like {"sources":...} from Gemini
  const balanced = findBalancedJSON(raw);
  if (balanced) return balanced;

  // Try to recover truncated JSON (streaming cut off mid-response)
  const json = raw.match(/\{[\s\S]*/)?.[0] ?? null;
  if (!json) return null;
  let recovered = json.replace(/,\s*"[^"]*$/, '').replace(/,\s*$/, '');
  const opens = (recovered.match(/\[/g) || []).length - (recovered.match(/\]/g) || []).length;
  const braces = (recovered.match(/\{/g) || []).length - (recovered.match(/\}/g) || []).length;
  recovered += ']'.repeat(Math.max(0, opens)) + '}'.repeat(Math.max(0, braces));
  return recovered;
}

function parseGeneratedBlocks(raw: string, charIndex: CharacterIndexEntry[]): { header?: Scene['header']; blocks: SceneBlock[] } | null {
  const jsonStr = recoverJSON(raw);
  if (!jsonStr) return null;

  // AI가 이름을 보낼 수 있으므로 이름/alias → ID 매핑
  const nameToId = new Map<string, string>();
  for (const c of charIndex) {
    nameToId.set(c.name.toLowerCase(), c.id);
    if (c.alias) nameToId.set(c.alias.toLowerCase(), c.id);
  }
  const resolveCharId = (raw: string) => {
    const trimmed = raw.trim();
    // 이미 유효한 ID인 경우
    if (charIndex.some(c => c.id === trimmed)) return trimmed;
    // 이름/alias로 찾기
    return nameToId.get(trimmed.toLowerCase()) ?? trimmed;
  };

  try {
    const parsed = JSON.parse(jsonStr);
    const blocks: SceneBlock[] = [];
    for (const b of (parsed.blocks ?? [])) {
      if (b.type === 'action' && b.text) blocks.push({ type: 'action', text: b.text });
      else if (b.type === 'character' && b.characterId) blocks.push({ type: 'character', characterId: resolveCharId(b.characterId), voiceType: b.voiceType ?? 'normal' });
      else if (b.type === 'dialogue' && b.text) blocks.push({ type: 'dialogue', text: b.text });
      else if (b.type === 'parenthetical' && b.text) blocks.push({ type: 'parenthetical', text: b.text });
      else if (b.type === 'transition') blocks.push({ type: 'transition', transitionType: b.transitionType ?? '컷', customText: b.customText });
    }
    if (blocks.length === 0) return null;
    return { header: parsed.header, blocks };
  } catch {
    return null;
  }
}

export function SceneGeneratePanel({ currentScene, onApply }: SceneGeneratePanelProps) {
  const [mode, setMode] = useState<Mode>('characters');
  const [generating, setGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [hint, setHint] = useState('');
  const [overview, setOverview] = useState('');
  const [error, setError] = useState('');
  const [selectedChars, setSelectedChars] = useState<Set<string>>(new Set());
  const [useStoryCtx, setUseStoryCtx] = useState(true);

  const { settings, meta } = useProjectStore();
  const { index: charIndex, characters: loadedChars } = useCharacterStore();
  const sceneIndex = useSceneStore(s => s.index);
  const { threadIndex, threads, structure, unresolvedForeshadowing } = useStoryStore();

  const hasExistingContent = currentScene.blocks.some(b => 'text' in b && b.text.trim());

  // 스토리 컨텍스트 요약 정보
  const storyCtxSummary = useMemo(() => {
    const currentIdx = sceneIndex.findIndex(s => s.id === currentScene.id);
    const prevCount = Math.min(currentIdx, 3);
    const nextCount = Math.min(sceneIndex.length - currentIdx - 1, 2);
    const threadCount = threadIndex.length;
    const foreshadowCount = unresolvedForeshadowing().length;
    return { prevCount, nextCount, threadCount, foreshadowCount, scenePos: currentIdx + 1, sceneTotal: sceneIndex.length };
  }, [sceneIndex, currentScene.id, threadIndex, unresolvedForeshadowing]);

  // 스토리 컨텍스트 조립
  const assembleStoryContext = useCallback(async () => {
    const currentIdx = sceneIndex.findIndex(s => s.id === currentScene.id);
    const { projectRef } = useProjectStore.getState();

    // 이전 씬: 요약이 없으면 실제 씬 파일에서 내용 발췌 + 캐릭터 상태 수집
    const prevEntries = sceneIndex.slice(Math.max(0, currentIdx - 3), currentIdx);
    let prevCharacterStates: CharacterState[] | undefined;

    const prevScenes = await Promise.all(prevEntries.map(async (s, i) => {
      // 파일 로드가 필요한 경우 (요약 없음 or 직전 씬의 캐릭터 상태 필요)
      const isLastPrev = i === prevEntries.length - 1;
      const needsFile = !s.summary || isLastPrev;

      if (needsFile && projectRef) {
        try {
          const scene = await fileIO.readJSON<Scene>(projectRef, `screenplay/${s.filename}`);
          // 직전 씬의 캐릭터 상태 수집
          if (isLastPrev && scene.meta.characterStates?.length) {
            prevCharacterStates = scene.meta.characterStates;
          }
          if (!s.summary) {
            const excerpt = scene.blocks
              .filter((b: SceneBlock) => 'text' in b && (b as { text: string }).text.trim())
              .map((b: SceneBlock) => (b as { text: string }).text)
              .join(' ')
              .slice(0, 300);
            if (excerpt) return { number: s.number, location: s.location, summary: `[내용 발췌] ${excerpt}` };
          }
        } catch { /* skip */ }
      }
      return { number: s.number, location: s.location, summary: s.summary };
    }));

    const nextEntries = sceneIndex.slice(currentIdx + 1, currentIdx + 3);
    const nextScenes = await Promise.all(nextEntries.map(async (s) => {
      if (s.summary) return { number: s.number, location: s.location, summary: s.summary };
      if (projectRef) {
        try {
          const scene = await fileIO.readJSON<Scene>(projectRef, `screenplay/${s.filename}`);
          const excerpt = scene.blocks
            .filter((b: SceneBlock) => 'text' in b && (b as { text: string }).text.trim())
            .map((b: SceneBlock) => (b as { text: string }).text)
            .join(' ')
            .slice(0, 300);
          if (excerpt) return { number: s.number, location: s.location, summary: `[내용 발췌] ${excerpt}` };
        } catch { /* skip */ }
      }
      return { number: s.number, location: s.location, summary: s.summary };
    }));

    // 캐릭터 상세 (선택된 캐릭터 또는 전체)
    const targetChars = mode === 'characters' ? charIndex.filter(c => selectedChars.has(c.id)) : charIndex;
    const characters = targetChars.map(c => {
      const full = loadedChars[c.id];
      const rels = full?.relationships?.map(r => {
        const targetName = charIndex.find(ci => ci.id === r.targetId)?.name ?? r.targetId;
        return `${targetName}: ${r.description}`;
      });
      return {
        name: c.name,
        description: full?.description,
        speechStyle: full?.personality?.speechStyle,
        occupation: full?.occupation,
        traits: full?.personality?.traits,
        goal: full?.drama?.goal,
        flaw: full?.drama?.flaw,
        arc: full?.drama?.arc,
        relationships: rels,
        speechExamples: full?.personality?.speechExamples,
      };
    });

    // 활성 플롯 스레드
    const activeThreads = threadIndex.map(t => {
      const full = threads[t.id];
      return { name: t.name, description: full?.description ?? '' };
    }).filter(t => t.description);

    // 현재 비트 (적응적 매칭)
    let currentBeat: { name: string; description: string; act: number } | undefined;
    if (structure && structure.beats.length > 0 && sceneIndex.length > 0) {
      // 0.0 (첫 씬) ~ 1.0 (마지막 씬) 범위로 정규화
      const pos = sceneIndex.length <= 1 ? 0 : currentIdx / (sceneIndex.length - 1);
      // 허용 오차: 씬 수에 반비례 (최소 0.03, 최대 0.2)
      const tolerance = Math.max(0.03, Math.min(0.2, 1 / (2 * sceneIndex.length)));
      // 허용 범위 내 가장 가까운 비트 선택
      let bestBeat: typeof structure.beats[0] | undefined;
      let bestDist = Infinity;
      for (const b of structure.beats) {
        const dist = Math.abs(b.relativePosition - pos);
        if (dist <= tolerance && dist < bestDist) {
          bestDist = dist;
          bestBeat = b;
        }
      }
      if (bestBeat) currentBeat = { name: bestBeat.name, description: bestBeat.description, act: bestBeat.act };
    }

    // 미해결 복선
    const foreshadowing = unresolvedForeshadowing().map(f => ({
      description: f.plantedIn.description, importance: f.importance,
    }));

    // 현재 씬 정보 (기존 내용 + 메타데이터)
    const currentSceneCtx: {
      header?: string;
      existingContent?: string;
      emotionalTone?: string[];
      tags?: string[];
      status?: string;
      notes?: string;
    } = {};

    const header = currentScene.header;
    if (header.location) {
      currentSceneCtx.header = `${header.interior ?? ''}. ${header.location} - ${header.timeOfDay}`;
    }

    // 기존 작성된 블록 내용 (elaborate 모드가 아닐 때도 포함)
    const existingBlocks = currentScene.blocks
      .filter((b) => ('text' in b && b.text.trim()) || b.type === 'character')
      .map((b) => {
        if (b.type === 'character') return `[캐릭터] ${b.characterId}`;
        if ('text' in b) return `[${b.type}] ${b.text}`;
        return '';
      })
      .filter(Boolean);
    if (existingBlocks.length >= 2) {
      currentSceneCtx.existingContent = existingBlocks.join('\n');
    }

    // 씬 메타데이터
    if (currentScene.meta.emotionalTone?.length) currentSceneCtx.emotionalTone = currentScene.meta.emotionalTone;
    if (currentScene.meta.tags?.length) currentSceneCtx.tags = currentScene.meta.tags;
    if (currentScene.meta.status) currentSceneCtx.status = currentScene.meta.status;
    if (currentScene.meta.notes) currentSceneCtx.notes = currentScene.meta.notes;

    // 토큰 예산 계산 (출력 4096 토큰 + 모드별 프롬프트 ~500 토큰)
    const tokenBudget = getStoryContextBudget(settings.ai, 4096, 500);

    return buildStoryContext({
      meta: { title: meta?.title, genre: meta?.genre, logline: meta?.logline },
      scenePosition: { current: currentIdx + 1, total: sceneIndex.length },
      currentScene: Object.keys(currentSceneCtx).length > 0 ? currentSceneCtx : undefined,
      prevScenes, nextScenes, characters, activeThreads, currentBeat,
      unresolvedForeshadowing: foreshadowing.length > 0 ? foreshadowing : undefined,
      prevCharacterStates,
    }, tokenBudget);
  }, [sceneIndex, currentScene, charIndex, loadedChars, selectedChars, mode, threadIndex, threads, structure, meta, unresolvedForeshadowing]);

  const toggleChar = (id: string) => {
    setSelectedChars(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const generate = useCallback(async () => {
    // 생성 시작 시점의 씬 데이터를 캡처 (씬 전환되어도 올바른 씬에 적용하기 위해)
    const targetScene = { ...currentScene };
    const targetSceneId = currentScene.id;

    setGenerating(true);
    setGenStatus('컨텍스트 준비 중...');
    setElapsed(0);
    elapsedRef.current = setInterval(() => setElapsed(t => t + 1), 1000);
    setError('');
    try {
      let systemPrompt: string;
      let userPrompt: string;

      const charInfos = charIndex
        .filter(c => mode === 'characters' ? selectedChars.has(c.id) : true)
        .map(c => {
          const full = loadedChars[c.id];
          return {
            name: c.name,
            description: full?.description ?? '',
            speechStyle: full?.personality?.speechStyle,
            speechTaboos: full?.personality?.speechTaboos,
            speechExamples: full?.personality?.speechExamples,
            occupation: full?.occupation,
            traits: full?.personality?.traits,
            goal: full?.drama?.goal,
            flaw: full?.drama?.flaw,
            arc: full?.drama?.arc,
          };
        });

      // 스토리 연동 시 컨텍스트 prepend
      const storyCtxPrefix = useStoryCtx ? (await assembleStoryContext()) + '\n---\n\n' : '';

      if (mode === 'characters') {
        if (charInfos.length === 0) { setError('캐릭터를 선택해주세요.'); setGenerating(false); return; }
        systemPrompt = useStoryCtx ? SYSTEM_SCENE_STRUCTURED : SYSTEM_SCENE_FROM_CHARACTERS;
        userPrompt = storyCtxPrefix + buildCharacterScenePrompt(charInfos, meta?.logline, hint || undefined);
      } else if (mode === 'overview') {
        if (!overview.trim()) { setError('씬 설명을 입력해주세요.'); setGenerating(false); return; }
        systemPrompt = useStoryCtx ? SYSTEM_SCENE_STRUCTURED : SYSTEM_SCENE_FROM_OVERVIEW;
        userPrompt = storyCtxPrefix + buildOverviewScenePrompt(overview, charInfos.length > 0 ? charInfos : undefined);
      } else {
        systemPrompt = useStoryCtx ? SYSTEM_SCENE_STRUCTURED : SYSTEM_SCENE_ELABORATE;
        const blockData = targetScene.blocks.map(b => ({
          type: b.type,
          text: 'text' in b ? b.text : undefined,
          characterId: b.type === 'character' ? b.characterId : undefined,
        }));
        userPrompt = storyCtxPrefix + buildElaboratePrompt(blockData, charInfos.length > 0 ? charInfos : undefined);
      }

      setGenStatus('AI가 씬을 작성 중...');
      // 씬 생성은 속도 우선 — claude-code에서는 haiku 사용
      const genAI = settings.ai.provider === 'claude-code'
        ? { ...settings.ai, model: 'haiku' }
        : settings.ai;
      let result = '';
      let charCount = 0;
      for await (const chunk of callAIStream(genAI, systemPrompt, userPrompt, 2048)) {
        result += chunk;
        charCount += chunk.length;
        if (charCount % 50 < chunk.length) {
          setGenStatus(`AI가 씬을 작성 중... (${Math.round(charCount / 2)}자)`);
        }
      }
      setGenStatus('응답 처리 중...');
      const parsed = parseGeneratedBlocks(result, charIndex);

      if (!parsed) { setError('AI 응답을 파싱할 수 없습니다. 다시 시도해주세요.'); setGenerating(false); setGenStatus(''); return; }

      const newHeader = (parsed.header && mode !== 'elaborate')
        ? {
            ...targetScene.header,
            interior: parsed.header.interior ?? targetScene.header.interior,
            location: parsed.header.location ?? targetScene.header.location,
            timeOfDay: parsed.header.timeOfDay ?? targetScene.header.timeOfDay,
          }
        : targetScene.header;

      // 현재 씬이 아직 대상 씬이면 → onApply (타이프라이터 등 UI 반영)
      const stillOnTarget = useSceneStore.getState().currentScene?.id === targetSceneId;
      if (stillOnTarget) {
        const updates: Partial<Scene> = { blocks: parsed.blocks };
        if (parsed.header && mode !== 'elaborate') updates.header = newHeader;
        onApply(updates);
      } else {
        // 씬이 전환됨 → 대상 씬 파일에 직접 저장
        const { projectRef } = useProjectStore.getState();
        if (projectRef) {
          const entry = useSceneStore.getState().index.find(s => s.id === targetSceneId);
          const filename = entry?.filename ?? `${targetSceneId}.json`;
          const savedScene: Scene = {
            ...targetScene,
            header: newHeader,
            blocks: parsed.blocks,
          };
          await fileIO.writeJSON(projectRef, `screenplay/${filename}`, savedScene);
        }
      }

      // Auto-generate scene memo in background
      try {
        const sceneText = parsed.blocks
          .map((b: SceneBlock) => {
            if ('text' in b) return b.text;
            if (b.type === 'character') return b.characterId;
            if (b.type === 'transition') return b.transitionType;
            return '';
          })
          .filter(Boolean)
          .join('\n');
        const headerStr = `${newHeader.interior}. ${newHeader.location} - ${newHeader.timeOfDay}`;
        const [summary] = await callAI(settings.ai, SYSTEM_SCENE_SUMMARY, `씬 헤더: ${headerStr}\n\n${sceneText}`, 1);
        if (summary) {
          const stillOnTargetNow = useSceneStore.getState().currentScene?.id === targetSceneId;
          if (stillOnTargetNow) {
            onApply({ meta: { ...targetScene.meta, summary } });
          } else {
            // 파일에 직접 요약 저장
            const { projectRef } = useProjectStore.getState();
            if (projectRef) {
              const entry = useSceneStore.getState().index.find(s => s.id === targetSceneId);
              const filename = entry?.filename ?? `${targetSceneId}.json`;
              try {
                const existing = await fileIO.readJSON<Scene>(projectRef, `screenplay/${filename}`);
                existing.meta = { ...existing.meta, summary };
                await fileIO.writeJSON(projectRef, `screenplay/${filename}`, existing);
              } catch { /* ignore */ }
            }
          }
          // 인덱스 업데이트 (어느 씬에 있든 인덱스는 갱신)
          useSceneStore.getState().updateIndexEntry(targetSceneId, { summary });
          const { projectRef } = useProjectStore.getState();
          if (projectRef) {
            await fileIO.writeJSON(projectRef, 'screenplay/_index.json', {
              scenes: useSceneStore.getState().index,
            });
          }
        }
      } catch { /* 메모 생성 실패는 무시 */ }
    } catch (err) {
      setError(`생성 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
    } finally {
      setGenerating(false);
      setGenStatus('');
      if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
    }
  }, [mode, selectedChars, hint, overview, charIndex, loadedChars, settings.ai, meta, currentScene, onApply, useStoryCtx, assembleStoryContext]);

  const MODES: { id: Mode; label: string; icon: typeof Users; desc: string }[] = [
    { id: 'characters', label: '캐릭터 기반', icon: Users, desc: '선택한 캐릭터들로 랜덤 씬 생성' },
    { id: 'overview', label: '큰그림 기반', icon: FileText, desc: '씬 설명/시놉시스로 생성' },
    { id: 'elaborate', label: '상세 작성', icon: Wand2, desc: '기존 내용을 블록 단위로 확장' },
  ];

  return (
    <div>
      {/* 스토리 연동 토글 */}
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
        <button
          onClick={() => setUseStoryCtx(!useStoryCtx)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            useStoryCtx
              ? 'bg-violet-100 text-violet-700 ring-1 ring-violet-300'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          {useStoryCtx ? <Link2 className="w-3 h-3" /> : <Unlink2 className="w-3 h-3" />}
          {useStoryCtx ? '스토리 연동' : '자유 생성'}
        </button>
        {useStoryCtx && (
          <span className="text-[10px] text-violet-500">
            이전 씬 {storyCtxSummary.prevCount}개 · 캐릭터 {charIndex.length}명
            {storyCtxSummary.threadCount > 0 && ` · 스레드 ${storyCtxSummary.threadCount}`}
            {storyCtxSummary.foreshadowCount > 0 && ` · 복선 ${storyCtxSummary.foreshadowCount}`}
          </span>
        )}
      </div>

      {/* 모드 선택 */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {MODES.map(m => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            disabled={m.id === 'elaborate' && !hasExistingContent}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
              mode === m.id
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            } disabled:opacity-30 disabled:cursor-not-allowed`}
          >
            <m.icon className="w-3 h-3" />
            {m.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-gray-400 mb-3">{MODES.find(m => m.id === mode)?.desc}</p>

      {/* 캐릭터 기반 모드 */}
      {mode === 'characters' && (
        <div className="space-y-3">
          {charIndex.length === 0 ? (
            <p className="text-xs text-gray-400">등록된 캐릭터가 없습니다. 먼저 캐릭터를 추가해주세요.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {charIndex.map(c => (
                <button
                  key={c.id}
                  onClick={() => toggleChar(c.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors ${
                    selectedChars.has(c.id)
                      ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name}
                </button>
              ))}
            </div>
          )}
          <textarea
            value={hint}
            onChange={e => setHint(e.target.value)}
            placeholder="추가 요청 (선택사항): 예) 두 캐릭터가 과거에 대해 이야기하는 장면, 긴장감 있는 대치 장면..."
            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 placeholder-gray-400 resize-none focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100"
            rows={2}
          />
        </div>
      )}

      {/* 큰그림 기반 모드 */}
      {mode === 'overview' && (
        <textarea
          value={overview}
          onChange={e => setOverview(e.target.value)}
          placeholder="씬 설명을 입력하세요. 예)&#10;민수가 카페에서 수진을 기다리고 있다. 수진이 도착하고 두 사람은 오랜만에 재회한다. 민수는 떠났던 이유를 묻고, 수진은 진실을 말하려다 망설인다. 긴장과 그리움이 교차하는 장면."
          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 placeholder-gray-400 resize-none focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100"
          rows={4}
        />
      )}

      {/* 상세 작성 모드 */}
      {mode === 'elaborate' && (
        <p className="text-xs text-gray-500 bg-white rounded-lg px-3 py-2 border border-gray-200">
          현재 씬의 {currentScene.blocks.length}개 블록을 AI가 더 상세하게 확장합니다.
          지문은 구체적 묘사를 추가하고, 대사 사이에 적절한 지문/지시문이 삽입됩니다.
        </p>
      )}

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

      <button
        onClick={generate}
        disabled={generating}
        className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {generating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {genStatus || '생성 중...'} {elapsed > 0 && <span className="opacity-60">({elapsed}초)</span>}
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            {mode === 'elaborate' ? '상세 확장' : '씬 생성'}
          </>
        )}
      </button>
    </div>
  );
}
