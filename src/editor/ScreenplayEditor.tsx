import { useEffect, useRef, useState, useCallback } from 'react';
import type { Scene, SceneBlock, ActionBlock, CharacterBlock, DialogueBlock, ParentheticalBlock, TransitionBlock } from '../types/scene';
import { useSceneStore } from '../store/sceneStore';
import { useCharacterStore } from '../store/characterStore';
import { useProjectStore } from '../store/projectStore';
import { fileIO } from '../io';

// ── Block rendering components ──────────────────────────────────────────────

interface BlockProps {
  block: SceneBlock;
  index: number;
  isSelected: boolean;
  characterNames: Record<string, string>;
  characterColors: Record<string, string>;
  onSelect: (index: number) => void;
  onChange: (index: number, block: SceneBlock) => void;
  onKeyDown: (e: React.KeyboardEvent, index: number) => void;
}

function ActionBlockView({ block, index, isSelected, onSelect, onChange, onKeyDown }: BlockProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const b = block as ActionBlock;

  useEffect(() => {
    if (isSelected && ref.current) ref.current.focus();
  }, [isSelected]);

  const handleInput = () => {
    if (!ref.current) return;
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
        className="w-full bg-transparent resize-none text-gray-200 font-mono text-sm leading-relaxed focus:outline-none overflow-hidden"
        style={{ minHeight: '1.5em' }}
      />
    </div>
  );
}

function CharacterBlockView({ block, index, isSelected, characterNames, characterColors, onSelect, onChange, onKeyDown }: BlockProps) {
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
        onChange={(e) => {
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

function DialogueBlockView({ block, index, isSelected, onSelect, onChange, onKeyDown }: BlockProps) {
  const b = block as DialogueBlock;
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isSelected && ref.current) ref.current.focus();
  }, [isSelected]);

  const handleInput = () => {
    if (!ref.current) return;
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
        className="bg-transparent resize-none text-gray-100 font-mono text-sm leading-relaxed focus:outline-none overflow-hidden"
        style={{ width: '60%', minHeight: '1.5em' }}
      />
    </div>
  );
}

function ParentheticalBlockView({ block, index, isSelected, onSelect, onChange, onKeyDown }: BlockProps) {
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
          onChange={(e) => onChange(index, { ...b, text: e.target.value })}
          className="bg-transparent italic text-gray-400 font-mono text-sm focus:outline-none"
          style={{ width: `${Math.max(b.text.length, 4) + 2}ch` }}
        />
        )
      </span>
    </div>
  );
}

function TransitionBlockView({ block, index, isSelected, onSelect, onChange, onKeyDown }: BlockProps) {
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
        onChange={(e) => onChange(index, { ...b, transitionType: e.target.value })}
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

export function ScreenplayEditor() {
  const { currentScene, updateCurrentScene, markDirty } = useSceneStore();
  const { index: charIndex, characters } = useCharacterStore();
  const { dirHandle, autoSave } = useProjectStore();
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(null);
  const [saveIndicator, setSaveIndicator] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const saveTimerRef = useRef<number | null>(null);

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

  const handleBlockKeyDown = (e: React.KeyboardEvent, index: number) => {
    const block = currentScene.blocks[index];

    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const nextType = getNextBlockType(block, currentScene.blocks, index);
      const newBlock = createEmptyBlock(nextType);
      const newBlocks = [...currentScene.blocks];
      newBlocks.splice(index + 1, 0, newBlock);
      updateCurrentScene({ ...currentScene, blocks: newBlocks });
      setSelectedBlockIndex(index + 1);
    } else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      // Cycle backward through block types
      const types: SceneBlock['type'][] = ['action', 'character', 'dialogue', 'parenthetical', 'transition'];
      const currentTypeIdx = types.indexOf(block.type);
      const prevType = types[(currentTypeIdx - 1 + types.length) % types.length];
      handleBlockChange(index, createEmptyBlock(prevType));
    } else if (e.key === 'F2') {
      // Block type change — TODO: show type picker menu
    } else if (e.key === 'Backspace' && isBlockEmpty(block)) {
      e.preventDefault();
      if (currentScene.blocks.length > 1) {
        const newBlocks = currentScene.blocks.filter((_, i) => i !== index);
        updateCurrentScene({ ...currentScene, blocks: newBlocks });
        setSelectedBlockIndex(Math.max(0, index - 1));
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-950">
      {/* Scene header */}
      <SceneHeader scene={currentScene} onChange={handleHeaderChange} />

      {/* Save indicator */}
      <div className="flex justify-end px-4 py-1">
        <span className={`text-xs ${
          saveIndicator === 'saved' ? 'text-gray-700' :
          saveIndicator === 'saving' ? 'text-yellow-600' : 'text-red-600'
        }`}>
          {saveIndicator === 'saved' ? '저장됨' :
           saveIndicator === 'saving' ? '저장 중...' : '저장 안됨'}
        </span>
      </div>

      {/* Blocks */}
      <div className="flex-1 overflow-y-auto px-16 py-8 max-w-3xl mx-auto w-full">
        {currentScene.blocks.map((block, i) => {
          const props: BlockProps = {
            block,
            index: i,
            isSelected: selectedBlockIndex === i,
            characterNames,
            characterColors,
            onSelect: setSelectedBlockIndex,
            onChange: handleBlockChange,
            onKeyDown: handleBlockKeyDown,
          };
          return (
            <div key={i} className="mb-1">
              {renderBlock(props)}
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
            + 블록 추가
          </button>
        </div>
      </div>
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
