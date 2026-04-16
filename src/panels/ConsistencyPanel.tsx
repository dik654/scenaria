import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { useConsistencyStore } from '../store/consistencyStore';
import { useProjectStore } from '../store/projectStore';
import { useSceneStore } from '../store/sceneStore';
import { fileIO } from '../io';
import type { ConsistencyData, ConsistencyIssue, IssueSeverity } from '../types/consistency';
import type { ForeshadowingIndex } from '../types/story';
import type { Scene, SceneBlock } from '../types/scene';
import {
  checkUnresolvedForeshadowing,
  checkSceneTimeContradictions,
  checkCharacterLocationContradictions,
  checkCharacterBehaviorAI,
  checkSpeechStyleAI,
} from '../ai/consistencyChecker';
import { callAIStream } from '../ai/aiClient';
import { findBalancedJSON } from '../ai/aiClient';
import { useCharacterStore } from '../store/characterStore';
import { useAIActivityStore } from '../store/aiActivityStore';
import type { Character } from '../types/character';
import { CircleAlert, TriangleAlert, Info, Search, Lightbulb, Sparkles, Wand2, Check, X, Loader2 } from 'lucide-react';

// ── AI Fix for a single issue ──

const FIX_SYSTEM_PROMPT = `당신은 한국 영화 시나리오 정합성 수정 전문가입니다.
정합성 이슈 설명과 제안을 읽고, 해당 씬의 블록들을 수정하세요.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "changes": [
    { "blockIndex": 0, "action": "edit", "newText": "수정된 텍스트" },
    { "blockIndex": 3, "action": "delete" },
    { "blockIndex": 5, "action": "insert_after", "newBlock": { "type": "action", "text": "새 지문" } }
  ],
  "explanation": "수정 사항 요약 (1~2줄)"
}

규칙:
- action은 "edit" (텍스트 수정), "delete" (블록 삭제), "insert_after" (블록 뒤에 삽입) 중 선택
- edit은 대사/지문/지시문 블록만 가능. character/transition 블록은 edit 불가
- 최소한의 변경으로 이슈를 해결하세요 — 관련 없는 블록은 건드리지 마세요
- 캐릭터의 말투(speechStyle)를 반드시 유지하세요
- JSON만 반환하세요`;

interface FixState {
  issueId: string;
  status: 'loading' | 'preview' | 'applying' | 'error';
  sceneId?: string;
  changes?: { blockIndex: number; action: string; newText?: string; newBlock?: Partial<SceneBlock> }[];
  explanation?: string;
  error?: string;
  originalBlocks?: SceneBlock[];
}

const SEVERITY_ICON: Record<IssueSeverity, ReactNode> = {
  error: <CircleAlert className="w-4 h-4 text-red-400" />,
  warning: <TriangleAlert className="w-4 h-4 text-yellow-400" />,
  info: <Info className="w-4 h-4 text-blue-400" />,
};

const SEVERITY_ORDER: Record<IssueSeverity, number> = { error: 0, warning: 1, info: 2 };

export function ConsistencyPanel() {
  const { data, openIssues, setData, resolveIssue, ignoreIssue, isChecking, setChecking } = useConsistencyStore();
  const { projectRef, settings } = useProjectStore();
  const { index: sceneIndex } = useSceneStore();
  const { index: charIndex, characters: charMap } = useCharacterStore();
  const aiActivity = useAIActivityStore();
  const [filter, setFilter] = useState<'all' | IssueSeverity>('all');
  const [aiChecking, setAIChecking] = useState(false);
  const [fixState, setFixState] = useState<FixState | null>(null);

  const handleAIFix = useCallback(async (issue: ConsistencyIssue) => {
    if (!projectRef) return;

    // AI가 "s001~s005 (전체)" 같은 범위 텍스트를 반환할 수 있으므로 실제 씬 ID 추출
    const resolveSceneIds = (raw: string[]): string[] => {
      const ids: string[] = [];
      for (const s of raw) {
        // 정확한 씬 ID인 경우
        if (sceneIndex.some(si => si.id === s)) { ids.push(s); continue; }
        // "s001~s005 (전체)" → s001, s002, ... 범위 추출
        const rangeMatch = s.match(/s?(\d+)\s*[~\-]\s*s?(\d+)/i);
        if (rangeMatch) {
          const start = parseInt(rangeMatch[1]);
          const end = parseInt(rangeMatch[2]);
          for (const si of sceneIndex) {
            const num = parseInt(si.id.replace(/\D/g, ''));
            if (num >= start && num <= end) ids.push(si.id);
          }
          continue;
        }
        // "s003" 형태가 포함된 경우
        const idMatch = s.match(/s\d+/gi);
        if (idMatch) {
          for (const m of idMatch) {
            if (sceneIndex.some(si => si.id === m)) ids.push(m);
          }
        }
      }
      return ids.length > 0 ? ids : sceneIndex.map(s => s.id);
    };

    const targetIds = resolveSceneIds(issue.scenes ?? []);
    const targetSceneId = targetIds[0];
    if (!targetSceneId) return;
    const entry = sceneIndex.find(s => s.id === targetSceneId);
    if (!entry) return;

    setFixState({ issueId: issue.id, status: 'loading', sceneId: targetSceneId });

    try {
      const scene = await fileIO.readJSON<Scene>(projectRef, `screenplay/${entry.filename}`);
      const blocksText = scene.blocks.map((b, i) => {
        if (b.type === 'character') return `[${i}] 캐릭터: ${b.characterId}`;
        if (b.type === 'transition') return `[${i}] 전환: ${b.transitionType}`;
        if ('text' in b) return `[${i}] ${b.type}: ${b.text}`;
        return `[${i}] ${(b as { type: string }).type}`;
      }).join('\n');

      // 캐릭터 프로필 포함 (이름 또는 ID로 매핑)
      const relatedChars = (issue.characters ?? []).map(cNameOrId => {
        let full = charMap[cNameOrId];
        if (!full) {
          // 이름으로 검색
          const found = charIndex.find(c => c.name === cNameOrId || c.alias === cNameOrId);
          if (found) full = charMap[found.id];
        }
        if (!full) return '';
        const lines = [`### ${full.name}`];
        if (full.drama?.goal) lines.push(`목표: ${full.drama.goal}`);
        if (full.drama?.flaw) lines.push(`결점: ${full.drama.flaw}`);
        if (full.personality?.speechStyle) lines.push(`말투: ${full.personality.speechStyle}`);
        if (full.personality?.speechTaboos) lines.push(`금지 표현: ${full.personality.speechTaboos}`);
        if (full.personality?.speechExamples?.length) {
          lines.push(`대사 예시: "${full.personality.speechExamples[0]}"`);
        }
        return lines.join('\n');
      }).filter(Boolean).join('\n\n');

      const userPrompt = [
        `## 이슈\n${issue.description}`,
        issue.suggestion ? `\n## 제안\n${issue.suggestion}` : '',
        relatedChars ? `\n## 관련 캐릭터 프로필\n${relatedChars}` : '',
        `\n## 씬 ${targetSceneId} 블록\n${blocksText}`,
        '\n위 이슈를 해결하기 위해 최소한의 블록만 수정해주세요.',
      ].join('\n');

      console.log('[ai-fix] calling AI, prompt length:', userPrompt.length);
      let result = '';
      for await (const chunk of callAIStream(settings.ai, FIX_SYSTEM_PROMPT, userPrompt, 1024)) {
        result += chunk;
      }

      console.log('[ai-fix] AI result length:', result.length, 'preview:', result.slice(0, 200));
      const jsonStr = findBalancedJSON(result);
      if (!jsonStr) {
        console.log('[ai-fix] failed to parse JSON from result');
        setFixState({ issueId: issue.id, status: 'error', error: 'AI 응답을 파싱할 수 없습니다' });
        return;
      }

      const parsed = JSON.parse(jsonStr);
      console.log('[ai-fix] parsed changes:', parsed.changes?.length, 'explanation:', parsed.explanation);
      setFixState({
        issueId: issue.id,
        status: 'preview',
        sceneId: targetSceneId,
        changes: parsed.changes ?? [],
        explanation: parsed.explanation ?? '',
        originalBlocks: scene.blocks,
      });
    } catch (err) {
      console.error('[ai-fix] error:', err);
      setFixState({ issueId: issue.id, status: 'error', error: err instanceof Error ? err.message : '수정 실패' });
    }
  }, [projectRef, sceneIndex, settings.ai, charMap, charIndex]);

  const applyFix = useCallback(async () => {
    if (!fixState || fixState.status !== 'preview' || !fixState.originalBlocks || !fixState.sceneId || !projectRef) return;
    setFixState(prev => prev ? { ...prev, status: 'applying' } : null);

    try {
      const entry = sceneIndex.find(s => s.id === fixState.sceneId);
      if (!entry) throw new Error('씬을 찾을 수 없습니다');

      const scene = await fileIO.readJSON<Scene>(projectRef, `screenplay/${entry.filename}`);
      const newBlocks = [...scene.blocks];

      // Apply changes in reverse order to preserve indices
      const sorted = [...(fixState.changes ?? [])].sort((a, b) => b.blockIndex - a.blockIndex);
      for (const change of sorted) {
        if (change.action === 'edit' && change.newText !== undefined) {
          const block = newBlocks[change.blockIndex];
          if (block && 'text' in block) {
            (newBlocks[change.blockIndex] as { text: string }).text = change.newText;
          }
        } else if (change.action === 'delete') {
          newBlocks.splice(change.blockIndex, 1);
        } else if (change.action === 'insert_after' && change.newBlock) {
          newBlocks.splice(change.blockIndex + 1, 0, change.newBlock as SceneBlock);
        }
      }

      const updatedScene = { ...scene, blocks: newBlocks };
      await fileIO.writeJSON(projectRef, `screenplay/${entry.filename}`, updatedScene);

      // 현재 열린 씬이면 UI 업데이트
      const currentId = useSceneStore.getState().currentSceneId;
      if (currentId === fixState.sceneId) {
        useSceneStore.getState().updateCurrentScene(updatedScene);
      }

      handleResolve(fixState.issueId);
      setFixState(null);
    } catch (err) {
      setFixState(prev => prev ? { ...prev, status: 'error', error: err instanceof Error ? err.message : '적용 실패' } : null);
    }
  }, [fixState, projectRef, sceneIndex]);

  const runFullCheck = async () => {
    if (!projectRef || isChecking) return;
    setChecking(true);
    try {
      // Load all scenes
      const scenes: Scene[] = [];
      for (const entry of sceneIndex) {
        try {
          const scene = await fileIO.readJSON<Scene>(projectRef, `screenplay/${entry.filename}`);
          if (scene) scenes.push(scene);
        } catch { /* skip */ }
      }

      // Load foreshadowing
      const foreshadowing = await fileIO.readJSON<ForeshadowingIndex>(projectRef, 'story/foreshadowing.json')
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
      await fileIO.writeJSON(projectRef, 'story/consistency.json', updated);

      // Update hasConsistencyIssue flags on SceneIndexEntry
      const affectedSceneIds = new Set(
        issues.flatMap((issue: ConsistencyIssue) => issue.scenes ?? [])
      );
      const { updateIndexEntry, index } = useSceneStore.getState();
      for (const entry of index) {
        updateIndexEntry(entry.id, { hasConsistencyIssue: affectedSceneIds.has(entry.id) });
      }
      const newIndex = useSceneStore.getState().index;
      await fileIO.writeJSON(projectRef, 'screenplay/_index.json', { scenes: newIndex });
    } catch (err) {
      console.error('정합성 검사 실패:', err);
    } finally {
      setChecking(false);
    }
  };

  const runAICheck = async () => {
    if (!projectRef || aiChecking) return;
    setAIChecking(true);
    aiActivity.start();
    try {
      // Load all scenes
      const scenes: Scene[] = [];
      for (const entry of sceneIndex) {
        try {
          const scene = await fileIO.readJSON<Scene>(projectRef, `screenplay/${entry.filename}`);
          if (scene) scenes.push(scene);
        } catch { /* skip */ }
      }

      // Load all characters
      const characters: Character[] = [];
      for (const entry of charIndex) {
        const full = charMap[entry.id];
        if (full) {
          characters.push(full);
        } else {
          try {
            const char = await fileIO.readJSON<Character>(projectRef, `characters/${entry.filename}`);
            if (char) characters.push(char);
          } catch { /* skip */ }
        }
      }

      // Run AI checks in parallel
      const [behaviorIssues, speechIssues] = await Promise.all([
        checkCharacterBehaviorAI(scenes, characters, settings.ai),
        checkSpeechStyleAI(scenes, characters, settings.ai),
      ]);

      const aiIssues = [...behaviorIssues, ...speechIssues];

      // Merge with existing data — replace old AI issues, keep rule-based ones
      const existingNonAI = (data?.issues ?? []).filter(
        i => i.type !== 'character_behavior' && i.type !== 'speech_inconsistency'
      );
      const updated: ConsistencyData = {
        lastChecked: new Date().toISOString(),
        issues: [...existingNonAI, ...aiIssues],
        rules: data?.rules ?? [],
      };
      setData(updated);
      await fileIO.writeJSON(projectRef, 'story/consistency.json', updated);
    } catch (err) {
      console.error('AI 정합성 분석 실패:', err);
    } finally {
      setAIChecking(false);
      aiActivity.stop();
    }
  };

  useEffect(() => {
    if (!projectRef || data) return;
    fileIO.readJSON<ConsistencyData>(projectRef, 'story/consistency.json')
      .then(d => {
        setData(d);
        // Also check foreshadowing
        return fileIO.readJSON<ForeshadowingIndex>(projectRef, 'story/foreshadowing.json');
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
  }, [projectRef]);

  const saveConsistency = async (updated: ConsistencyData) => {
    if (!projectRef) return;
    await fileIO.writeJSON(projectRef, 'story/consistency.json', updated);
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
      {/* Run check buttons */}
      <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2 flex-shrink-0">
        <button
          onClick={runFullCheck}
          disabled={isChecking || aiChecking || sceneIndex.length === 0}
          className="flex-1 text-xs py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-gray-800 border border-gray-200 rounded transition-colors disabled:opacity-50"
        >
          <span className="inline-flex items-center gap-1.5">{isChecking ? '검사 중...' : <><Search className="w-3.5 h-3.5" /> 규칙 검사</>}</span>
        </button>
        <button
          onClick={runAICheck}
          disabled={isChecking || aiChecking || sceneIndex.length === 0 || charIndex.length === 0}
          className="flex-1 text-xs py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-600 border border-violet-200 rounded transition-colors disabled:opacity-50"
        >
          <span className="inline-flex items-center gap-1.5">{aiChecking ? 'AI 분석 중...' : <><Sparkles className="w-3.5 h-3.5" /> AI 분석</>}</span>
        </button>
      </div>

      {/* Summary */}
      <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-3">
        <div className="flex gap-2 text-xs">
          {errorCount > 0 && (
            <span className="flex items-center gap-1 text-red-400">
              <CircleAlert className="w-3.5 h-3.5" /> {errorCount}
            </span>
          )}
          {warnCount > 0 && (
            <span className="flex items-center gap-1 text-yellow-400">
              <TriangleAlert className="w-3.5 h-3.5" /> {warnCount}
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
                filter === f ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'
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
            <div key={issue.id} className="group border-b border-gray-100 px-3 py-3">
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 mt-0.5">{SEVERITY_ICON[issue.severity]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700 leading-relaxed">{issue.description}</p>
                  {issue.suggestion && (
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><Lightbulb className="w-3 h-3 flex-shrink-0" /> {issue.suggestion}</p>
                  )}
                  {issue.scenes && issue.scenes.length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {issue.scenes.map(s => (
                        <button
                          key={s}
                          onClick={() => window.dispatchEvent(new CustomEvent('scenaria:gotoScene', { detail: s }))}
                          className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono hover:bg-blue-50 hover:text-blue-600 cursor-pointer transition-colors"
                          title={`${s} 씬으로 이동`}
                        >{s}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* AI Fix Preview */}
              {fixState?.issueId === issue.id && fixState.status === 'preview' && fixState.changes && (
                <div className="mt-2 pl-6 space-y-2">
                  <div className="bg-violet-50 border border-violet-200 rounded-lg p-2">
                    <p className="text-xs text-violet-700 font-medium mb-1.5">AI 수정안</p>
                    {fixState.explanation && (
                      <p className="text-xs text-violet-600 mb-2">{fixState.explanation}</p>
                    )}
                    {fixState.changes.map((c, ci) => (
                      <div key={ci} className="text-xs mb-1.5">
                        {c.action === 'edit' && (
                          <div className="space-y-0.5">
                            <div className="bg-red-50 text-red-700 px-2 py-1 rounded line-through opacity-70">
                              [{c.blockIndex}] {(fixState.originalBlocks?.[c.blockIndex] as { text?: string })?.text?.slice(0, 80)}...
                            </div>
                            <div className="bg-green-50 text-green-700 px-2 py-1 rounded">
                              [{c.blockIndex}] {c.newText?.slice(0, 80)}{(c.newText?.length ?? 0) > 80 ? '...' : ''}
                            </div>
                          </div>
                        )}
                        {c.action === 'delete' && (
                          <div className="bg-red-50 text-red-700 px-2 py-1 rounded line-through">
                            [{c.blockIndex}] 삭제
                          </div>
                        )}
                        {c.action === 'insert_after' && (
                          <div className="bg-blue-50 text-blue-700 px-2 py-1 rounded">
                            [{c.blockIndex}] 뒤에 삽입: {(c.newBlock as { text?: string })?.text?.slice(0, 80)}
                          </div>
                        )}
                      </div>
                    ))}
                    <div className="flex gap-2 mt-2">
                      <button onClick={applyFix} className="flex items-center gap-1 text-xs px-2 py-1 bg-violet-500 hover:bg-violet-600 text-white rounded transition-colors">
                        <Check className="w-3 h-3" /> 적용
                      </button>
                      <button onClick={() => setFixState(null)} className="flex items-center gap-1 text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded transition-colors">
                        <X className="w-3 h-3" /> 취소
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {fixState?.issueId === issue.id && fixState.status === 'loading' && (
                <div className="mt-2 pl-6 flex items-center gap-1.5 text-xs text-violet-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> AI가 수정안을 생성하고 있습니다...
                </div>
              )}

              {fixState?.issueId === issue.id && fixState.status === 'error' && (
                <div className="mt-2 pl-6 text-xs text-red-500">
                  {fixState.error} <button onClick={() => setFixState(null)} className="underline ml-1">닫기</button>
                </div>
              )}

              <div className="flex gap-2 mt-2 pl-6">
                {(fixState?.issueId !== issue.id) && (
                  <button
                    onClick={() => handleAIFix(issue)}
                    disabled={fixState?.status === 'loading'}
                    className="flex items-center gap-1 text-xs text-violet-500 hover:text-violet-400"
                  >
                    <Wand2 className="w-3 h-3" /> AI 수정
                  </button>
                )}
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
        <div className="px-3 py-2 border-t border-gray-100 text-xs text-gray-400">
          마지막 검사: {new Date(data.lastChecked).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
    </div>
  );
}
