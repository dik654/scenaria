import { useEffect, useRef, useState, useCallback } from 'react';
import type { Scene, SceneBlock, ActionBlock, CharacterBlock, DialogueBlock, ParentheticalBlock, TransitionBlock } from '../types/scene';
import { useSceneStore } from '../store/sceneStore';
import { useCharacterStore } from '../store/characterStore';
import { useProjectStore } from '../store/projectStore';
import { fileIO } from '../io';
import { SlashMenu, type SlashMenuItem } from './widgets/SlashMenu';
import { AIFloatingToolbar } from './widgets/AIFloatingToolbar';

// ── Block rendering components ──────────────────────────────────────────────

interface BlockProps {
  block: SceneBlock;
  index: number;
  isSelected: boolean;
  readOnly: boolean;
  characterNames: Record<string, string>;
  characterColors: Record<string, string>;
  onSelect: (index: number) => void;
  onChange: (index: number, block: SceneBlock) => void;
  onKeyDown: (e: React.KeyboardEvent, index: number) => void;
}

function ActionBlockView({ block, index, isSelected, readOnly, onSelect, onChange, onKeyDown }: BlockProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const b = block as ActionBlock;

  useEffect(() => {
    if (isSelected && ref.current) ref.current.focus();
  }, [isSelected]);

  const handleInput = () => {
    if (!ref.current || readOnly) return;
    ref.current.style.height = 'auto';
    ref.current.style.height = ref.current.scrollHeight + 'px';
    onChange(index, { ...b, text: ref.current.value });
  };

  return (
    <div
      className={`relative group py-1 px-2 rounded ${isSelected ? 'bg-gray-800/50' : 'hover:bg-gray-900/30'}`}
      onClick={() => onSelect(index)}
    >
      {b.isInsert && (
        <span className="text-xs text-yellow-500 font-mono mr-2 uppercase">
          [{b.insertLabel ?? 'INSERT'}]
        </span>
      )}
      <textarea
        ref={ref}
        defaultValue={b.text}
        onInput={handleInput}
        onFocus={() => onSelect(index)}
        onKeyDown={(e) => onKeyDown(e, index)}
        rows={1}
        readOnly={readOnly}
        className="w-full bg-transparent resize-none text-gray-200 font-mono text-sm leading-relaxed focus:outline-none overflow-hidden"
        style={{ minHeight: '1.5em' }}
      />
    </div>
  );
}

function CharacterBlockView({ block, index, isSelected, readOnly, characterNames, characterColors, onSelect, onChange, onKeyDown }: BlockProps) {
  const b = block as CharacterBlock;
  const name = characterNames[b.characterId] ?? b.characterId;
  const color = characterColors[b.characterId] ?? '#DC2626';
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSelected && ref.current) ref.current.focus();
  }, [isSelected]);

  const voiceLabels: Record<string, string> = {
    'V.O.': 'V.O.',
    'O.S.': 'O.S.',
    'E': 'E',
    'N': 'N',
    'normal': '',
  };

  return (
    <div
      className={`flex justify-center items-baseline gap-2 py-2 ${isSelected ? 'bg-gray-800/50' : ''} rounded cursor-pointer`}
      onClick={() => onSelect(index)}
    >
      <input
        ref={ref}
        defaultValue={name}
        onFocus={() => onSelect(index)}
        onKeyDown={(e) => onKeyDown(e, index)}
        readOnly={readOnly}
        onChange={(e) => {
          if (readOnly) return;
          const newId = e.target.value.toLowerCase().replace(/\s+/g, '-');
          onChange(index, { ...b, characterId: newId });
        }}
        className="bg-transparent text-center font-mono font-bold text-sm uppercase tracking-widest focus:outline-none focus:border-b focus:border-dashed"
        style={{ color, width: `${Math.max(name.length, 8) + 2}ch` }}
      />
      {b.voiceType !== 'normal' && (
        <span className="text-xs text-gray-400 font-mono">({voiceLabels[b.voiceType]})</span>
      )}
    </div>
  );
}

function DialogueBlockView({ block, index, isSelected, readOnly, onSelect, onChange, onKeyDown }: BlockProps) {
  const b = block as DialogueBlock;
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isSelected && ref.current) ref.current.focus();
  }, [isSelected]);

  const handleInput = () => {
    if (!ref.current || readOnly) return;
    ref.current.style.height = 'auto';
    ref.current.style.height = ref.current.scrollHeight + 'px';
    onChange(index, { ...b, text: ref.current.value });
  };

  return (
    <div
      className={`flex justify-center py-1 ${isSelected ? 'bg-gray-800/50' : ''} rounded`}
      onClick={() => onSelect(index)}
    >
      <textarea
        ref={ref}
        defaultValue={b.text}
        onInput={handleInput}
        onFocus={() => onSelect(index)}
        onKeyDown={(e) => onKeyDown(e, index)}
        rows={1}
        readOnly={readOnly}
        className="bg-transparent resize-none text-gray-100 font-mono text-sm leading-relaxed focus:outline-none overflow-hidden"
        style={{ width: '60%', minHeight: '1.5em' }}
      />
    </div>
  );
}

function ParentheticalBlockView({ block, index, isSelected, readOnly, onSelect, onChange, onKeyDown }: BlockProps) {
  const b = block as ParentheticalBlock;
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSelected && ref.current) ref.current.focus();
  }, [isSelected]);

  return (
    <div
      className={`flex justify-center py-0.5 ${isSelected ? 'bg-gray-800/50' : ''} rounded`}
      onClick={() => onSelect(index)}
    >
      <span className="text-gray-400 font-mono text-sm italic">
        (
        <input
          ref={ref}
          defaultValue={b.text}
          onFocus={() => onSelect(index)}
          onKeyDown={(e) => onKeyDown(e, index)}
          readOnly={readOnly}
          onChange={(e) => { if (!readOnly) onChange(index, { ...b, text: e.target.value }); }}
          className="bg-transparent italic text-gray-400 font-mono text-sm focus:outline-none"
          style={{ width: `${Math.max(b.text.length, 4) + 2}ch` }}
        />
        )
      </span>
    </div>
  );
}

function TransitionBlockView({ block, index, isSelected, readOnly, onSelect, onChange, onKeyDown }: BlockProps) {
  const b = block as TransitionBlock;
  const ref = useRef<HTMLSelectElement>(null);
  const PRESETS = ['CUT TO:', 'FADE OUT.', 'DISSOLVE TO:', 'SMASH CUT TO:', 'MATCH CUT TO:', 'CUT TO BLACK.', 'FADE IN:'];

  return (
    <div
      className={`flex justify-end py-1 px-2 ${isSelected ? 'bg-gray-800/50' : ''} rounded`}
      onClick={() => onSelect(index)}
    >
      <select
        ref={ref}
        value={b.transitionType}
        onFocus={() => onSelect(index)}
        onKeyDown={(e) => onKeyDown(e as unknown as React.KeyboardEvent, index)}
        onChange={(e) => { if (!readOnly) onChange(index, { ...b, transitionType: e.target.value }); }}
        className="bg-transparent text-gray-400 font-mono text-sm uppercase tracking-widest focus:outline-none cursor-pointer"
      >
        {PRESETS.map((p) => <option key={p} value={p} className="bg-gray-900">{p}</option>)}
        {!PRESETS.includes(b.transitionType) && (
          <option value={b.transitionType} className="bg-gray-900">{b.transitionType}</option>
        )}
      </select>
    </div>
  );
}

// ── Scene Header ─────────────────────────────────────────────────────────────

function SceneHeader({ scene, onChange }: { scene: Scene; onChange: (updates: Partial<Scene>) => void }) {
  const { header } = scene;
  const TIME_OPTIONS = ['DAY', 'NIGHT', 'DAWN', 'DUSK', 'CONTINUOUS'];
  const INT_OPTIONS = ['INT', 'EXT', 'INT/EXT', ''];

  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-gray-900/80 border-b border-gray-800 font-mono text-sm">
      <span className="text-red-500 font-bold">S#{scene.id.replace('s', '').replace(/^0+/, '') || '?'}</span>
      <span className="text-gray-600">·</span>
      <select
        value={header.interior ?? ''}
        onChange={(e) => onChange({ header: { ...header, interior: e.target.value as Scene['header']['interior'] || null } })}
        className="bg-transparent text-yellow-400 font-mono text-sm focus:outline-none cursor-pointer"
      >
        {INT_OPTIONS.map((o) => (
          <option key={o} value={o} className="bg-gray-900">{o || '(없음)'}</option>
        ))}
      </select>
      <input
        value={header.location}
        onChange={(e) => onChange({ header: { ...header, location: e.target.value } })}
        placeholder="장소"
        className="bg-transparent text-white font-mono text-sm focus:outline-none border-b border-transparent focus:border-gray-600 px-1"
      />
      {header.locationDetail && (
        <>
          <span className="text-gray-600">/</span>
          <input
            value={header.locationDetail}
            onChange={(e) => onChange({ header: { ...header, locationDetail: e.target.value } })}
            className="bg-transparent text-gray-300 font-mono text-sm focus:outline-none border-b border-transparent focus:border-gray-600 px-1"
          />
        </>
      )}
      <span className="text-gray-600">-</span>
      <select
        value={header.timeOfDay}
        onChange={(e) => onChange({ header: { ...header, timeOfDay: e.target.value as Scene['header']['timeOfDay'] } })}
        className="bg-transparent text-blue-400 font-mono text-sm focus:outline-none cursor-pointer"
      >
        {TIME_OPTIONS.map((t) => (
          <option key={t} value={t} className="bg-gray-900">{t}</option>
        ))}
      </select>
      {header.timeLabel && (
        <span className="text-gray-500 text-xs">({header.timeLabel})</span>
      )}
    </div>
  );
}

// ── Main Editor ──────────────────────────────────────────────────────────────

// Scene meta editing pane
function SceneMetaPane({ scene, onChange, readOnly }: {
  scene: Scene;
  onChange: (updates: Partial<Scene>) => void;
  readOnly: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { meta } = scene;

  const TONE_OPTIONS = [
    '희망적', '긴장', '슬픔', '분노', '두려움', '기쁨',
    '멜랑꼴리', '우아함', '유머', '극적', '고요함', '혼란',
  ];

  const toggleTone = (tone: string) => {
    if (readOnly) return;
    const current = meta.emotionalTone ?? [];
    const next = current.includes(tone)
      ? current.filter((t) => t !== tone)
      : [...current, tone];
    onChange({ meta: { ...meta, emotionalTone: next } });
  };

  const tensionColor = (level: number) => {
    if (level <= 3) return 'text-blue-400';
    if (level <= 6) return 'text-yellow-400';
    if (level <= 8) return 'text-orange-400';
    return 'text-red-400';
  };

  const tensionLabel = (level: number) => {
    if (level <= 2) return '평온';
    if (level <= 4) return '잔잔';
    if (level <= 6) return '보통';
    if (level <= 8) return '긴장';
    return '폭발';
  };

  return (
    <div className="border-t border-gray-800 bg-gray-950 flex-shrink-0">
      {/* Collapsed bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-1.5 text-xs text-gray-600 hover:text-gray-400 transition-colors"
      >
        <span className={`font-mono font-bold ${tensionColor(meta.tensionLevel ?? 5)}`}>
          긴장 {meta.tensionLevel ?? 5}/10
        </span>
        {meta.emotionalTone?.length ? (
          <span className="text-gray-600">{meta.emotionalTone.slice(0, 3).join(' · ')}</span>
        ) : null}
        {meta.summary ? (
          <span className="flex-1 truncate text-left">{meta.summary}</span>
        ) : (
          <span className="flex-1 text-gray-800 italic">씬 메모 없음</span>
        )}
        <span>{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Expanded */}
      {expanded && (
        <div className="px-4 py-3 space-y-3 border-t border-gray-800/50">
          {/* Summary */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">씬 요약 / 메모</label>
            <textarea
              value={meta.summary ?? ''}
              onChange={(e) => !readOnly && onChange({ meta: { ...meta, summary: e.target.value } })}
              readOnly={readOnly}
              rows={2}
              placeholder="이 씬에서 일어나는 일을 요약하세요..."
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-gray-500 resize-none placeholder-gray-700"
            />
          </div>

          {/* Tension + Minutes row */}
          <div className="flex items-center gap-6">
            <div className="flex-1">
              <label className={`text-xs font-medium mb-1 flex items-center gap-2 ${tensionColor(meta.tensionLevel ?? 5)}`}>
                긴장도
                <span className="font-bold">{meta.tensionLevel ?? 5}</span>
                <span className="text-gray-600 font-normal">({tensionLabel(meta.tensionLevel ?? 5)})</span>
              </label>
              <input
                type="range"
                min={1} max={10}
                value={meta.tensionLevel ?? 5}
                onChange={(e) => !readOnly && onChange({ meta: { ...meta, tensionLevel: Number(e.target.value) } })}
                disabled={readOnly}
                className="w-full accent-red-500 cursor-pointer"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">예상 분량</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0.5} max={30} step={0.5}
                  value={meta.estimatedMinutes ?? 1}
                  onChange={(e) => !readOnly && onChange({ meta: { ...meta, estimatedMinutes: Number(e.target.value) } })}
                  readOnly={readOnly}
                  className="w-16 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none text-center"
                />
                <span className="text-xs text-gray-600">분</span>
              </div>
            </div>
          </div>

          {/* Emotional tones */}
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
                        ? 'border-red-600 bg-red-900/30 text-red-300'
                        : 'border-gray-700 text-gray-600 hover:border-gray-500 hover:text-gray-400'
                    }`}
                  >
                    {tone}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tags */}
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

function TagInput({ tags, onChange, readOnly }: {
  tags: string[];
  onChange: (tags: string[]) => void;
  readOnly: boolean;
}) {
  const [inputValue, setInputValue] = useState('');

  const addTag = (value: string) => {
    const tag = value.trim();
    if (!tag || tags.includes(tag)) { setInputValue(''); return; }
    onChange([...tags, tag]);
    setInputValue('');
  };

  return (
    <div className="flex flex-wrap gap-1.5 items-center min-h-7 bg-gray-900 border border-gray-700 rounded px-2 py-1">
      {tags.map((tag) => (
        <span key={tag} className="flex items-center gap-1 bg-gray-700 rounded-full px-2 py-0.5 text-xs text-gray-300">
          {tag}
          {!readOnly && (
            <button
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className="text-gray-500 hover:text-red-400 transition-colors leading-none"
            >
              ×
            </button>
          )}
        </span>
      ))}
      {!readOnly && (
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(inputValue); }
            if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
              onChange(tags.slice(0, -1));
            }
          }}
          onBlur={() => inputValue && addTag(inputValue)}
          placeholder={tags.length === 0 ? '태그 입력 후 Enter' : ''}
          className="bg-transparent text-xs text-gray-300 focus:outline-none min-w-20 placeholder-gray-700"
        />
      )}
    </div>
  );
}

function renderBlock(props: BlockProps) {
  switch (props.block.type) {
    case 'action': return <ActionBlockView key={props.index} {...props} />;
    case 'character': return <CharacterBlockView key={props.index} {...props} />;
    case 'dialogue': return <DialogueBlockView key={props.index} {...props} />;
    case 'parenthetical': return <ParentheticalBlockView key={props.index} {...props} />;
    case 'transition': return <TransitionBlockView key={props.index} {...props} />;
  }
}

function getNextBlockType(currentBlock: SceneBlock, allBlocks: SceneBlock[], index: number): SceneBlock['type'] {
  switch (currentBlock.type) {
    case 'character': return 'dialogue';
    case 'dialogue': {
      // Check if there's a character block before
      const prevChar = [...allBlocks].slice(0, index).reverse().find(b => b.type === 'character');
      return prevChar ? 'action' : 'action';
    }
    case 'parenthetical': return 'dialogue';
    case 'action': return 'character';
    case 'transition': return 'action';
    default: return 'action';
  }
}

function createEmptyBlock(type: SceneBlock['type']): SceneBlock {
  switch (type) {
    case 'action': return { type: 'action', text: '' };
    case 'character': return { type: 'character', characterId: '', voiceType: 'normal' };
    case 'dialogue': return { type: 'dialogue', text: '' };
    case 'parenthetical': return { type: 'parenthetical', text: '' };
    case 'transition': return { type: 'transition', transitionType: 'CUT TO:' };
  }
}

type EditorMode = 'normal' | 'focus' | 'reading' | 'typewriter';

export function ScreenplayEditor({ mode = 'normal', readOnly = false }: { mode?: EditorMode; readOnly?: boolean }) {
  const { currentScene, updateCurrentScene } = useSceneStore();
  const { index: charIndex } = useCharacterStore();
  const { dirHandle, autoSave } = useProjectStore();
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(null);
  const [saveIndicator, setSaveIndicator] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const saveTimerRef = useRef<number | null>(null);
  const blocksContainerRef = useRef<HTMLDivElement>(null);

  // Typewriter mode: scroll selected block to vertical center
  useEffect(() => {
    if (mode !== 'typewriter' || selectedBlockIndex === null || !blocksContainerRef.current) return;
    const container = blocksContainerRef.current;
    const el = container.querySelector<HTMLElement>(`[data-block-index="${selectedBlockIndex}"]`);
    if (!el) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const offset = elRect.top - containerRect.top - containerRect.height / 2 + elRect.height / 2;
    container.scrollBy({ top: offset, behavior: 'smooth' });
  }, [selectedBlockIndex, mode]);

  // Slash menu state
  const [slashAnchor, setSlashAnchor] = useState<HTMLElement | null>(null);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashBlockIndex, setSlashBlockIndex] = useState<number | null>(null);

  // AI toolbar state
  const [aiSelection, setAISelection] = useState<{
    text: string;
    rect: DOMRect;
    blockIndex: number;
    block: SceneBlock;
  } | null>(null);

  // Handle text selection for AI toolbar
  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      return;
    }
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width > 0 && selectedBlockIndex !== null && currentScene) {
      setAISelection({
        text: selection.toString(),
        rect,
        blockIndex: selectedBlockIndex,
        block: currentScene.blocks[selectedBlockIndex],
      });
    }
  }, [selectedBlockIndex, currentScene]);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [handleSelectionChange]);

  const characterNames = Object.fromEntries(
    charIndex.map((c) => [c.id, c.name])
  );
  const characterColors = Object.fromEntries(
    charIndex.map((c) => [c.id, c.color])
  );

  const saveScene = useCallback(async () => {
    if (!currentScene || !dirHandle) return;
    setSaveIndicator('saving');
    try {
      const state = useSceneStore.getState();
      const entry = state.index.find((s) => s.id === currentScene.id);
      const filename = entry?.filename ?? `${currentScene.id}.json`;
      await fileIO.writeJSON(dirHandle, `screenplay/${filename}`, currentScene);
      state.markClean();
      setSaveIndicator('saved');
      autoSave?.markDirty();
    } catch (err) {
      console.error('씬 저장 실패:', err);
      setSaveIndicator('unsaved');
    }
  }, [currentScene, dirHandle, autoSave]);

  // Debounced autosave
  const scheduleAutosave = useCallback(() => {
    setSaveIndicator('unsaved');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(saveScene, 2000);
  }, [saveScene]);

  // Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveScene();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [saveScene]);

  if (!currentScene) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600">
        <div className="text-center">
          <p className="text-4xl mb-4">📄</p>
          <p>씬을 선택하거나 새 씬을 추가하세요</p>
          <p className="text-sm mt-1">Ctrl+Shift+S로 새 씬 추가</p>
        </div>
      </div>
    );
  }

  const handleBlockChange = (index: number, block: SceneBlock) => {
    const newBlocks = [...currentScene.blocks];
    newBlocks[index] = block;
    updateCurrentScene({ ...currentScene, blocks: newBlocks });
    scheduleAutosave();
  };

  const handleHeaderChange = (updates: Partial<Scene>) => {
    updateCurrentScene({ ...currentScene, ...updates });
    scheduleAutosave();
  };

  const insertBlock = useCallback((atIndex: number, type: SceneBlock['type']) => {
    const newBlock = createEmptyBlock(type);
    const newBlocks = [...currentScene!.blocks];
    newBlocks.splice(atIndex + 1, 0, newBlock);
    updateCurrentScene({ ...currentScene!, blocks: newBlocks });
    setSelectedBlockIndex(atIndex + 1);
  }, [currentScene, updateCurrentScene]);

  const handleSlashMenuSelect = useCallback((item: SlashMenuItem) => {
    setSlashAnchor(null);
    setSlashQuery('');
    if (slashBlockIndex === null || !currentScene) return;

    if (item.blockType === 'scene') {
      // New scene — trigger scene navigator add
      window.dispatchEvent(new CustomEvent('scenaria:addScene'));
      return;
    }
    if (item.blockType === 'foreshadowing' || item.blockType === 'payoff') {
      // TODO: insert foreshadowing marker
      return;
    }
    // Replace current empty block with selected type
    const block = currentScene.blocks[slashBlockIndex];
    if (isBlockEmpty(block)) {
      handleBlockChange(slashBlockIndex, createEmptyBlock(item.blockType as SceneBlock['type']));
    } else {
      insertBlock(slashBlockIndex, item.blockType as SceneBlock['type']);
    }
  }, [slashBlockIndex, currentScene, insertBlock]);

  const handleBlockKeyDown = (e: React.KeyboardEvent, index: number) => {
    const block = currentScene!.blocks[index];

    // Slash menu trigger
    if (e.key === '/' && isBlockEmpty(block)) {
      setSlashAnchor(e.currentTarget as HTMLElement);
      setSlashQuery('');
      setSlashBlockIndex(index);
      return;
    }

    // Close slash menu on Escape or space
    if (slashAnchor) {
      if (e.key === 'Escape' || e.key === ' ') {
        setSlashAnchor(null);
        setSlashQuery('');
      }
      return; // Let SlashMenu handle ArrowUp/Down/Enter
    }

    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const nextType = getNextBlockType(block, currentScene!.blocks, index);
      insertBlock(index, nextType);
    } else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      const types: SceneBlock['type'][] = ['action', 'character', 'dialogue', 'parenthetical', 'transition'];
      const currentTypeIdx = types.indexOf(block.type);
      const prevType = types[(currentTypeIdx - 1 + types.length) % types.length];
      handleBlockChange(index, createEmptyBlock(prevType));
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      // Ctrl+Enter: repeat last character's dialogue
      e.preventDefault();
      const prevChar = [...currentScene!.blocks].slice(0, index).reverse().find(b => b.type === 'character') as CharacterBlock | undefined;
      if (prevChar) {
        const newBlocks = [...currentScene!.blocks];
        newBlocks.splice(index + 1, 0, { ...prevChar } as CharacterBlock);
        newBlocks.splice(index + 2, 0, createEmptyBlock('dialogue'));
        updateCurrentScene({ ...currentScene!, blocks: newBlocks });
        setSelectedBlockIndex(index + 2);
      }
    } else if (e.key === 'Enter' && !e.shiftKey && block.type === 'dialogue') {
      e.preventDefault();
      insertBlock(index, 'action');
    } else if (e.key === 'Backspace' && isBlockEmpty(block)) {
      e.preventDefault();
      if (currentScene!.blocks.length > 1) {
        const newBlocks = currentScene!.blocks.filter((_, i) => i !== index);
        updateCurrentScene({ ...currentScene!, blocks: newBlocks });
        setSelectedBlockIndex(Math.max(0, index - 1));
      }
    }
  };

  // Handle input in blocks to track slash queries
  const handleBlockInput = useCallback((index: number, value: string) => {
    if (slashAnchor && slashBlockIndex === index) {
      const slashPos = value.indexOf('/');
      if (slashPos >= 0) {
        setSlashQuery(value.slice(slashPos + 1));
      } else {
        setSlashAnchor(null);
        setSlashQuery('');
      }
    }
  }, [slashAnchor, slashBlockIndex]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-950" onClick={() => setAISelection(null)}>
      {/* Scene header */}
      <SceneHeader scene={currentScene} onChange={handleHeaderChange} />

      {/* Save indicator */}
      <div className="flex justify-end items-center gap-3 px-4 py-1">
        <span className="text-xs text-gray-700">
          / 슬래시로 블록 선택 · Tab 다음 블록 · Ctrl+Enter 대사 반복
        </span>
        <span className={`text-xs ${
          saveIndicator === 'saved' ? 'text-gray-700' :
          saveIndicator === 'saving' ? 'text-yellow-600' : 'text-red-600'
        }`}>
          {saveIndicator === 'saved' ? '저장됨' :
           saveIndicator === 'saving' ? '저장 중...' : '저장 안됨'}
        </span>
      </div>

      {/* Blocks */}
      <div ref={blocksContainerRef} className="flex-1 overflow-y-auto px-16 py-8 max-w-3xl mx-auto w-full">
        {currentScene.blocks.map((block, i) => {
          const props: BlockProps = {
            block,
            index: i,
            isSelected: selectedBlockIndex === i,
            readOnly,
            characterNames,
            characterColors,
            onSelect: setSelectedBlockIndex,
            onChange: (idx, b) => { handleBlockChange(idx, b); handleBlockInput(idx, 'text' in b ? b.text : ''); },
            onKeyDown: handleBlockKeyDown,
          };
          return (
            <div key={i} data-block-index={i} className="mb-1 relative group">
              {renderBlock(props)}
              {/* Per-block AI alternative button */}
              {(block.type === 'dialogue' || block.type === 'action') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setAISelection({
                      text: 'text' in block ? block.text : '',
                      rect,
                      blockIndex: i,
                      block,
                    });
                  }}
                  title="AI 대안 생성"
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-6 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-600 hover:text-blue-400 w-5 h-5 flex items-center justify-center"
                >
                  🔀
                </button>
              )}
            </div>
          );
        })}

        {/* Add block button */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => {
              const newBlock = createEmptyBlock('action');
              const newBlocks = [...currentScene.blocks, newBlock];
              updateCurrentScene({ ...currentScene, blocks: newBlocks });
              setSelectedBlockIndex(newBlocks.length - 1);
            }}
            className="text-gray-700 hover:text-gray-500 text-sm font-mono transition-colors"
          >
            + 블록 추가 (또는 / 입력)
          </button>
        </div>
      </div>

      {/* Scene meta pane */}
      <SceneMetaPane
        scene={currentScene}
        onChange={(updates) => { updateCurrentScene({ ...currentScene, ...updates }); scheduleAutosave(); }}
        readOnly={readOnly}
      />

      {/* Slash menu */}
      <SlashMenu
        anchorEl={slashAnchor}
        query={slashQuery}
        onSelect={handleSlashMenuSelect}
        onClose={() => { setSlashAnchor(null); setSlashQuery(''); }}
      />

      {/* AI floating toolbar */}
      {aiSelection && (
        <AIFloatingToolbar
          selectedText={aiSelection.text}
          anchorRect={aiSelection.rect}
          sceneId={currentScene.id}
          blockIndex={aiSelection.blockIndex}
          originalBlock={aiSelection.block}
          onApply={(newText) => {
            const block = currentScene.blocks[aiSelection.blockIndex];
            if ('text' in block) {
              handleBlockChange(aiSelection.blockIndex, { ...block, text: newText } as SceneBlock);
            }
          }}
          onClose={() => setAISelection(null)}
        />
      )}
    </div>
  );
}

function isBlockEmpty(block: SceneBlock): boolean {
  switch (block.type) {
    case 'action': return !block.text.trim();
    case 'dialogue': return !block.text.trim();
    case 'parenthetical': return !block.text.trim();
    case 'character': return !block.characterId.trim();
    case 'transition': return false;
  }
}
