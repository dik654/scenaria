/**
 * 시각화 패널 공용 AI 생성 훅
 * 스트리밍 AI 호출 + JSON 파싱 + 프로젝트 컨텍스트 자동 수집
 */
import { useState, useRef, useCallback } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useSceneStore } from '../../store/sceneStore';
import { useCharacterStore } from '../../store/characterStore';
import { useStoryStore } from '../../store/storyStore';
import { useAIActivityStore } from '../../store/aiActivityStore';
import { callAIStream, findBalancedJSON } from '../../ai/aiClient';
import type { ProjectContext } from '../../ai/prompts/visualizationGen';

interface UseVisualizationAIOptions {
  systemPrompt: string;
  buildUserPrompt: (ctx: ProjectContext, userRequirements?: string) => string;
  maxTokens?: number;
}

interface UseVisualizationAIReturn<T> {
  generate: (userRequirements?: string) => Promise<T | null>;
  generating: boolean;
  streamText: string;
  error: string;
  stop: () => void;
}

export function useVisualizationAI<T>({
  systemPrompt,
  buildUserPrompt,
  maxTokens = 4096,
}: UseVisualizationAIOptions): UseVisualizationAIReturn<T> {
  const { settings, meta } = useProjectStore();
  const { index: scenes } = useSceneStore();
  const { index: charIndex, characters: charMap } = useCharacterStore();
  const { threadIndex, threads: threadMap, structure, foreshadowing } = useStoryStore();
  const aiActivity = useAIActivityStore();

  const [generating, setGenerating] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [error, setError] = useState('');
  const abortRef = useRef(false);

  const gatherContext = useCallback((): ProjectContext => {
    const characters = charIndex.map(c => {
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

    const sceneList = scenes.map(s => ({
      id: s.id,
      number: s.number,
      location: s.location,
      summary: s.summary,
      timeOfDay: s.timeOfDay,
    }));

    const existingThreads = threadIndex
      .map(t => threadMap[t.id])
      .filter(Boolean)
      .map(t => ({ name: t!.name, description: t!.description }));

    const existingBeats = structure?.beats?.map(b => ({
      id: b.id,
      name: b.name,
      description: b.description,
    })) ?? [];

    const existingForeshadowing = (foreshadowing?.items ?? []).map(f => ({
      description: f.plantedIn.description,
      status: f.status,
      importance: f.importance,
    }));

    return {
      meta: meta ? { title: meta.title, logline: meta.logline, genre: meta.genre } : undefined,
      characters,
      scenes: sceneList,
      existingThreads,
      existingBeats,
      existingForeshadowing,
    };
  }, [charIndex, charMap, scenes, threadIndex, threadMap, structure, foreshadowing, meta]);

  const generate = useCallback(async (userRequirements?: string): Promise<T | null> => {
    setGenerating(true);
    setError('');
    setStreamText('');
    abortRef.current = false;
    aiActivity.start();

    try {
      const ctx = gatherContext();
      const userPrompt = buildUserPrompt(ctx, userRequirements);
      let accumulated = '';

      for await (const chunk of callAIStream(settings.ai, systemPrompt, userPrompt, maxTokens)) {
        if (abortRef.current) break;
        accumulated += chunk;
        setStreamText(accumulated);
      }

      if (abortRef.current) {
        setError('생성이 중단되었습니다.');
        return null;
      }

      // JSON 파싱 (StoryWizard 패턴)
      let cleaned = accumulated.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) cleaned = fenceMatch[1].trim();
      const jsonStr = findBalancedJSON(cleaned);

      if (!jsonStr) {
        setError('AI 응답에서 JSON을 찾을 수 없습니다. 다시 시도해주세요.');
        return null;
      }

      return JSON.parse(jsonStr) as T;
    } catch (err) {
      setError(err instanceof Error ? err.message : '생성 중 오류가 발생했습니다.');
      return null;
    } finally {
      setGenerating(false);
      aiActivity.stop();
    }
  }, [settings.ai, systemPrompt, buildUserPrompt, maxTokens, gatherContext, aiActivity]);

  const stop = useCallback(() => {
    abortRef.current = true;
  }, []);

  return { generate, generating, streamText, error, stop };
}
