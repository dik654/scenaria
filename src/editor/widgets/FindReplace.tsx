import { useState, useRef, useEffect, useCallback } from 'react';
import { useSceneStore } from '../../store/sceneStore';
import { useProjectStore } from '../../store/projectStore';
import { fileIO } from '../../io';
import type { Scene, SceneBlock, ActionBlock, DialogueBlock } from '../../types/scene';

interface Match {
  sceneId: string;
  filename: string;
  blockIndex: number;
  charStart: number;
  charEnd: number;
  preview: string;
}

interface FindReplaceProps {
  onClose: () => void;
  onNavigate?: (sceneId: string) => void;
  initialReplace?: boolean;
}

type SearchScope = 'all' | 'current' | 'action' | 'dialogue';

function getBlockText(block: SceneBlock): string {
  if ('text' in block) return block.text;
  return '';
}

function setBlockText(block: SceneBlock, text: string): SceneBlock {
  if ('text' in block) return { ...block, text } as SceneBlock;
  return block;
}

export function FindReplace({ onClose, onNavigate, initialReplace = false }: FindReplaceProps) {
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [scope, setScope] = useState<SearchScope>('all');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [showReplace, setShowReplace] = useState(initialReplace);
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentMatch, setCurrentMatch] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const queryRef = useRef<HTMLInputElement>(null);

  const { index: sceneIndex, currentScene, setCurrentScene } = useSceneStore();
  const { dirHandle } = useProjectStore();

  // Focus on open
  useEffect(() => { queryRef.current?.focus(); }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'F3' || (e.key === 'Enter' && !e.shiftKey && document.activeElement === queryRef.current)) {
        e.preventDefault();
        goToMatch(currentMatch + 1);
      }
      if (e.key === 'F3' && e.shiftKey) {
        e.preventDefault();
        goToMatch(currentMatch - 1);
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [currentMatch, matches]);

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

  const handleSearch = useCallback(async () => {
    if (!query || !dirHandle) { setMatches([]); return; }
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
              : await fileIO.readJSON<Scene>(dirHandle, `screenplay/${entry.filename}`);
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

    // Navigate to first match
    if (found.length > 0) navigateToMatch(found[0]);
  }, [query, scope, dirHandle, currentScene, sceneIndex, buildRegex]);

  const navigateToMatch = async (match: Match) => {
    if (!dirHandle) return;
    if (match.sceneId !== currentScene?.id) {
      try {
        const scene = await fileIO.readJSON<Scene>(dirHandle, `screenplay/${match.filename}`);
        setCurrentScene(match.sceneId, scene);
        onNavigate?.(match.sceneId);
      } catch { return; }
    }
    // Highlight block — scroll it into view
    setTimeout(() => {
      const el = document.querySelector(`[data-block-index="${match.blockIndex}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const goToMatch = (idx: number) => {
    if (matches.length === 0) return;
    const clamped = ((idx % matches.length) + matches.length) % matches.length;
    setCurrentMatch(clamped);
    navigateToMatch(matches[clamped]);
  };

  const handleReplaceOne = async () => {
    if (!dirHandle || matches.length === 0) return;
    const match = matches[currentMatch];
    if (!match) return;
    setStatusMsg('교체 중...');

    try {
      const scene = match.sceneId === currentScene?.id
        ? currentScene
        : await fileIO.readJSON<Scene>(dirHandle, `screenplay/${match.filename}`);

      const block = scene.blocks[match.blockIndex];
      const text = getBlockText(block);
      const re = buildRegex(query)!;
      re.lastIndex = 0;
      const newText = text.replace(re, replacement);
      const newBlocks = [...scene.blocks];
      newBlocks[match.blockIndex] = setBlockText(block, newText);
      const updatedScene = { ...scene, blocks: newBlocks };

      await fileIO.writeJSON(dirHandle, `screenplay/${match.filename}`, updatedScene);
      if (match.sceneId === currentScene?.id) setCurrentScene(match.sceneId, updatedScene);

      // Remove this match and go to next
      const newMatches = matches.filter((_, i) => i !== currentMatch);
      setMatches(newMatches);
      setCurrentMatch(Math.min(currentMatch, newMatches.length - 1));
      setStatusMsg(`교체됨. 남은 ${newMatches.length}개`);
    } catch (err) {
      setStatusMsg('교체 실패');
    }
  };

  const handleReplaceAll = async () => {
    if (!dirHandle || matches.length === 0) return;
    setStatusMsg('전체 교체 중...');

    // Group by scene
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
          : await fileIO.readJSON<Scene>(dirHandle, `screenplay/${entry.filename}`);

        const newBlocks = scene.blocks.map(block => {
          const text = getBlockText(block);
          if (!text) return block;
          re.lastIndex = 0;
          const newText = text.replace(re, replacement);
          if (newText !== text) { count++; return setBlockText(block, newText); }
          return block;
        });
        const updatedScene = { ...scene, blocks: newBlocks };
        await fileIO.writeJSON(dirHandle, `screenplay/${entry.filename}`, updatedScene);
        if (sceneId === currentScene?.id) setCurrentScene(sceneId, updatedScene);
      } catch { /* skip */ }
    }

    setMatches([]);
    setStatusMsg(`${count}개 교체됨`);
  };

  return (
    <div className="fixed bottom-4 right-16 z-50 w-96 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <div className="flex gap-2">
          <button onClick={() => setShowReplace(false)}
            className={`text-xs px-2 py-0.5 rounded transition-colors ${!showReplace ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            찾기
          </button>
          <button onClick={() => setShowReplace(true)}
            className={`text-xs px-2 py-0.5 rounded transition-colors ${showReplace ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            찾기 및 바꾸기
          </button>
        </div>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-400 text-xs">✕</button>
      </div>

      <div className="p-3 space-y-2">
        {/* Query */}
        <div className="flex gap-1">
          <input
            ref={queryRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="검색..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500"
          />
          <button onClick={handleSearch} disabled={isSearching || !query}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg disabled:opacity-50">
            {isSearching ? '...' : '검색'}
          </button>
        </div>

        {/* Replace */}
        {showReplace && (
          <div className="flex gap-1">
            <input
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              placeholder="바꿀 텍스트..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
            <button onClick={handleReplaceOne} disabled={matches.length === 0}
              className="px-2 py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-xs rounded-lg disabled:opacity-50">
              교체
            </button>
            <button onClick={handleReplaceAll} disabled={matches.length === 0}
              className="px-2 py-1.5 bg-blue-900 hover:bg-blue-800 text-white text-xs rounded-lg disabled:opacity-50">
              전체
            </button>
          </div>
        )}

        {/* Options */}
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} className="accent-red-500" />
            <span className="text-xs text-gray-500">대소문자</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={useRegex} onChange={(e) => setUseRegex(e.target.checked)} className="accent-red-500" />
            <span className="text-xs text-gray-500">정규식</span>
          </label>
          <select value={scope} onChange={(e) => setScope(e.target.value as SearchScope)}
            className="text-xs bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-gray-400 focus:outline-none">
            <option value="all">전체</option>
            <option value="current">현재 씬</option>
            <option value="dialogue">대사만</option>
            <option value="action">지문만</option>
          </select>
        </div>

        {/* Status + navigation */}
        {statusMsg && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{statusMsg}</span>
            {matches.length > 0 && (
              <div className="flex items-center gap-1">
                <button onClick={() => goToMatch(currentMatch - 1)}
                  className="text-xs text-gray-500 hover:text-white px-1.5 py-0.5 border border-gray-700 rounded">
                  ◀
                </button>
                <span className="text-xs text-gray-500 min-w-12 text-center">
                  {currentMatch + 1}/{matches.length}
                </span>
                <button onClick={() => goToMatch(currentMatch + 1)}
                  className="text-xs text-gray-500 hover:text-white px-1.5 py-0.5 border border-gray-700 rounded">
                  ▶
                </button>
              </div>
            )}
          </div>
        )}

        {/* Matches preview */}
        {matches.length > 0 && (
          <div className="max-h-40 overflow-y-auto border border-gray-800 rounded-lg divide-y divide-gray-800">
            {matches.slice(0, 20).map((m, i) => (
              <button key={i} onClick={() => { setCurrentMatch(i); navigateToMatch(m); }}
                className={`w-full text-left px-2 py-1.5 text-xs transition-colors ${i === currentMatch ? 'bg-gray-700' : 'hover:bg-gray-800'}`}>
                <span className="text-red-400 font-mono mr-2">{m.sceneId}</span>
                <span className="text-gray-400 truncate">...{m.preview}...</span>
              </button>
            ))}
            {matches.length > 20 && (
              <div className="px-2 py-1 text-xs text-gray-600">+ {matches.length - 20}개 더</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
