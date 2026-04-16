import { useState, useCallback, useEffect } from 'react';
import { useSceneStore } from '../../store/sceneStore';
import { useProjectStore } from '../../store/projectStore';
import { fileIO } from '../../io';
import type { Scene, SceneBlock } from '../../types/scene';

export interface Match {
  sceneId: string;
  filename: string;
  blockIndex: number;
  charStart: number;
  charEnd: number;
  preview: string;
}

export type SearchScope = 'all' | 'current' | 'action' | 'dialogue';

function getBlockText(block: SceneBlock): string {
  if ('text' in block) return block.text;
  return '';
}

function setBlockText(block: SceneBlock, text: string): SceneBlock {
  if ('text' in block) return { ...block, text } as SceneBlock;
  return block;
}

export function useFindReplace(onNavigate?: (sceneId: string) => void) {
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [scope, setScope] = useState<SearchScope>('all');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentMatch, setCurrentMatch] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const { index: sceneIndex, currentScene, setCurrentScene } = useSceneStore();
  const { projectRef } = useProjectStore();

  const buildRegex = useCallback((q: string): RegExp | null => {
    if (!q) return null;
    try {
      if (useRegex) return new RegExp(q, caseSensitive ? 'g' : 'gi');
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(escaped, caseSensitive ? 'g' : 'gi');
    } catch {
      return null;
    }
  }, [useRegex, caseSensitive]);

  const searchInText = (text: string, re: RegExp): { start: number; end: number }[] => {
    const results: { start: number; end: number }[] = [];
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      results.push({ start: m.index, end: m.index + m[0].length });
      if (!re.global) break;
    }
    return results;
  };

  const navigateToMatch = useCallback(async (match: Match) => {
    if (!projectRef) return;
    if (match.sceneId !== currentScene?.id) {
      try {
        const scene = await fileIO.readJSON<Scene>(projectRef, `screenplay/${match.filename}`);
        setCurrentScene(match.sceneId, scene);
        onNavigate?.(match.sceneId);
      } catch { return; }
    }
    setTimeout(() => {
      const el = document.querySelector(`[data-block-index="${match.blockIndex}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, [projectRef, currentScene, setCurrentScene, onNavigate]);

  const handleSearch = useCallback(async () => {
    if (!query || !projectRef) { setMatches([]); return; }
    const re = buildRegex(query);
    if (!re) { setStatusMsg('잘못된 정규식입니다'); return; }

    setIsSearching(true);
    setStatusMsg('검색 중...');
    const found: Match[] = [];

    const scenesToSearch = scope === 'current' && currentScene
      ? [{ scene: currentScene, entry: sceneIndex.find(s => s.id === currentScene.id)! }]
      : await Promise.all(sceneIndex.map(async entry => {
          try {
            const scene = entry.id === currentScene?.id
              ? currentScene
              : await fileIO.readJSON<Scene>(projectRef, `screenplay/${entry.filename}`);
            return { scene, entry };
          } catch { return null; }
        })).then(r => r.filter(Boolean) as { scene: Scene; entry: typeof sceneIndex[0] }[]);

    for (const { scene, entry } of scenesToSearch) {
      scene.blocks.forEach((block, blockIdx) => {
        if (scope === 'action' && block.type !== 'action') return;
        if (scope === 'dialogue' && block.type !== 'dialogue') return;
        const text = getBlockText(block);
        if (!text) return;
        re.lastIndex = 0;
        const hits = searchInText(text, re);
        for (const hit of hits) {
          found.push({
            sceneId: scene.id,
            filename: entry.filename,
            blockIndex: blockIdx,
            charStart: hit.start,
            charEnd: hit.end,
            preview: text.slice(Math.max(0, hit.start - 20), hit.end + 20),
          });
        }
      });
    }

    setMatches(found);
    setCurrentMatch(0);
    setStatusMsg(found.length === 0 ? '결과 없음' : `${found.length}개 발견`);
    setIsSearching(false);

    if (found.length > 0) navigateToMatch(found[0]);
  }, [query, scope, projectRef, currentScene, sceneIndex, buildRegex, navigateToMatch]);

  const goToMatch = useCallback((idx: number) => {
    if (matches.length === 0) return;
    const clamped = ((idx % matches.length) + matches.length) % matches.length;
    setCurrentMatch(clamped);
    navigateToMatch(matches[clamped]);
  }, [matches, navigateToMatch]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F3' && !e.shiftKey) { e.preventDefault(); goToMatch(currentMatch + 1); }
      if (e.key === 'F3' && e.shiftKey) { e.preventDefault(); goToMatch(currentMatch - 1); }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [currentMatch, goToMatch]);

  const handleReplaceOne = async () => {
    if (!projectRef || matches.length === 0) return;
    const match = matches[currentMatch];
    if (!match) return;
    setStatusMsg('교체 중...');
    try {
      const scene = match.sceneId === currentScene?.id
        ? currentScene
        : await fileIO.readJSON<Scene>(projectRef, `screenplay/${match.filename}`);
      const block = scene.blocks[match.blockIndex];
      const text = getBlockText(block);
      const re = buildRegex(query)!;
      re.lastIndex = 0;
      const newText = text.replace(re, replacement);
      const newBlocks = [...scene.blocks];
      newBlocks[match.blockIndex] = setBlockText(block, newText);
      const updatedScene = { ...scene, blocks: newBlocks };
      await fileIO.writeJSON(projectRef, `screenplay/${match.filename}`, updatedScene);
      if (match.sceneId === currentScene?.id) setCurrentScene(match.sceneId, updatedScene);
      const newMatches = matches.filter((_, i) => i !== currentMatch);
      setMatches(newMatches);
      setCurrentMatch(Math.min(currentMatch, newMatches.length - 1));
      setStatusMsg(`교체됨. 남은 ${newMatches.length}개`);
    } catch {
      setStatusMsg('교체 실패');
    }
  };

  const handleReplaceAll = async () => {
    if (!projectRef || matches.length === 0) return;
    setStatusMsg('전체 교체 중...');
    const byScene = new Map<string, Match[]>();
    for (const m of matches) {
      const arr = byScene.get(m.sceneId) ?? [];
      arr.push(m);
      byScene.set(m.sceneId, arr);
    }
    let count = 0;
    const re = buildRegex(query)!;
    for (const [sceneId, sceneMatches] of byScene) {
      const entry = sceneMatches[0];
      try {
        const scene = sceneId === currentScene?.id
          ? currentScene
          : await fileIO.readJSON<Scene>(projectRef, `screenplay/${entry.filename}`);
        const newBlocks = scene.blocks.map(block => {
          const text = getBlockText(block);
          if (!text) return block;
          re.lastIndex = 0;
          const newText = text.replace(re, replacement);
          if (newText !== text) { count++; return setBlockText(block, newText); }
          return block;
        });
        const updatedScene = { ...scene, blocks: newBlocks };
        await fileIO.writeJSON(projectRef, `screenplay/${entry.filename}`, updatedScene);
        if (sceneId === currentScene?.id) setCurrentScene(sceneId, updatedScene);
      } catch { /* skip */ }
    }
    setMatches([]);
    setStatusMsg(`${count}개 교체됨`);
  };

  return {
    query, setQuery,
    replacement, setReplacement,
    scope, setScope,
    caseSensitive, setCaseSensitive,
    useRegex, setUseRegex,
    matches,
    currentMatch,
    isSearching,
    statusMsg,
    handleSearch,
    goToMatch,
    handleReplaceOne,
    handleReplaceAll,
    navigateToMatch,
  };
}
