import { useState, useRef, useEffect } from 'react';
import { useFindReplace } from './useFindReplace';

interface FindReplaceProps {
  onClose: () => void;
  onNavigate?: (sceneId: string) => void;
  initialReplace?: boolean;
}

export function FindReplace({ onClose, onNavigate, initialReplace = false }: FindReplaceProps) {
  const queryRef = useRef<HTMLInputElement>(null);
  const [showReplace, setShowReplace] = useState(initialReplace);
  const {
    query, setQuery,
    replacement, setReplacement,
    scope, setScope,
    caseSensitive, setCaseSensitive,
    useRegex, setUseRegex,
    matches, currentMatch,
    isSearching, statusMsg,
    handleSearch, goToMatch,
    handleReplaceOne, handleReplaceAll,
    navigateToMatch,
  } = useFindReplace(onNavigate);

  useEffect(() => { queryRef.current?.focus(); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'Enter' && !e.shiftKey && document.activeElement === queryRef.current) {
        e.preventDefault();
        handleSearch();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [onClose, handleSearch]);

  return (
    <div className="fixed bottom-4 right-16 z-50 w-96 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <div className="flex gap-2">
          <button onClick={() => setShowReplace(false)}
            className={`text-xs px-2 py-0.5 rounded transition-colors ${!showReplace ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>
            찾기
          </button>
          <button onClick={() => setShowReplace(true)}
            className={`text-xs px-2 py-0.5 rounded transition-colors ${showReplace ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>
            찾기 및 바꾸기
          </button>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
      </div>

      <div className="p-3 space-y-2">
        <div className="flex gap-1">
          <input
            ref={queryRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="검색..."
            className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400"
          />
          <button onClick={handleSearch} disabled={isSearching || !query}
            className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-lg disabled:opacity-50">
            {isSearching ? '...' : '검색'}
          </button>
        </div>

        {showReplace && (
          <div className="flex gap-1">
            <input
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              placeholder="바꿀 텍스트..."
              className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400"
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

        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} className="accent-blue-500" />
            <span className="text-xs text-gray-500">대소문자</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={useRegex} onChange={(e) => setUseRegex(e.target.checked)} className="accent-blue-500" />
            <span className="text-xs text-gray-500">정규식</span>
          </label>
          <select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}
            className="text-xs bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 text-gray-500 focus:outline-none">
            <option value="all">전체</option>
            <option value="current">현재 씬</option>
            <option value="dialogue">대사만</option>
            <option value="action">지문만</option>
          </select>
        </div>

        {statusMsg && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{statusMsg}</span>
            {matches.length > 0 && (
              <div className="flex items-center gap-1">
                <button onClick={() => goToMatch(currentMatch - 1)}
                  className="text-xs text-gray-500 hover:text-gray-800 px-1.5 py-0.5 border border-gray-200 rounded">◀</button>
                <span className="text-xs text-gray-500 min-w-12 text-center">
                  {currentMatch + 1}/{matches.length}
                </span>
                <button onClick={() => goToMatch(currentMatch + 1)}
                  className="text-xs text-gray-500 hover:text-gray-800 px-1.5 py-0.5 border border-gray-200 rounded">▶</button>
              </div>
            )}
          </div>
        )}

        {matches.length > 0 && (
          <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
            {matches.slice(0, 20).map((m, i) => (
              <button key={i} onClick={() => navigateToMatch(m)}
                className={`w-full text-left px-2 py-1.5 text-xs transition-colors ${i === currentMatch ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                <span className="text-blue-500 font-mono mr-2">{m.sceneId}</span>
                <span className="text-gray-500 truncate">...{m.preview}...</span>
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
