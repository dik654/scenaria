import { useEffect, useRef, useState, useCallback } from 'react';
import type { Scene, SceneBlock, CharacterBlock, ActionBlock } from '../types/scene';
import { useSceneStore } from '../store/sceneStore';
import { useCharacterStore } from '../store/characterStore';
import { useProjectStore } from '../store/projectStore';
import { SlashMenu, type SlashMenuItem } from './widgets/SlashMenu';
import { AIFloatingToolbar } from './widgets/AIFloatingToolbar';
import { SceneHeader } from './SceneHeader';
import { SceneMetaPane } from './SceneMetaPane';
import { getNextBlockType, createEmptyBlock, isBlockEmpty } from './blocks/renderBlock';
import type { BlockProps } from './blocks/BlockProps';
import { BlockWrapper } from './BlockWrapper';
import { useSceneSave } from './hooks/useSceneSave';
import { useSplitScene } from './hooks/useSplitScene';
import { useAIContext } from './hooks/useAIContext';

type EditorMode = 'normal' | 'focus' | 'reading' | 'typewriter';

function getBlockEditableEl(container: HTMLDivElement, blockIndex: number): HTMLElement | null {
  return container.querySelector<HTMLElement>(
    `[data-block-index="${blockIndex}"] textarea, [data-block-index="${blockIndex}"] [contenteditable="true"]`
  );
}

export function ScreenplayEditor({ mode = 'normal', readOnly = false }: { mode?: EditorMode; readOnly?: boolean }) {
  const { currentScene, updateCurrentScene, index: sceneIndex, currentSceneId } = useSceneStore();
  const { index: charIndex, characters: loadedCharacters } = useCharacterStore();
  const { settings, meta: projectMeta } = useProjectStore();

  const { saveScene, scheduleAutosave, saveIndicator, setSaveIndicator } = useSceneSave(currentScene);
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(null);
  const { splitScene } = useSplitScene(currentScene, selectedBlockIndex);
  const contextMarkdown = useAIContext(
    currentScene, currentSceneId, sceneIndex, loadedCharacters, projectMeta, !!settings.ai.apiKey
  );

  const rafRef = useRef<number | null>(null);
  const blocksContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, []);

  const focusBlock = useCallback((index: number, atEnd = false) => {
    setSelectedBlockIndex(index);
    if (atEnd) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const container = blocksContainerRef.current;
        if (!container) return;
        const el = getBlockEditableEl(container, index);
        if (!el) return;
        if (el.tagName === 'TEXTAREA') {
          const ta = el as HTMLTextAreaElement;
          ta.setSelectionRange(ta.value.length, ta.value.length);
        } else {
          const range = document.createRange();
          const sel = window.getSelection();
          range.selectNodeContents(el);
          range.collapse(false);
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
      });
    }
  }, []);

  useEffect(() => {
    if (mode !== 'typewriter' || selectedBlockIndex === null || !blocksContainerRef.current) return;
    const container = blocksContainerRef.current;
    const el = container.querySelector<HTMLElement>(`[data-block-index="${selectedBlockIndex}"]`);
    if (!el) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    container.scrollBy({ top: elRect.top - containerRect.top - containerRect.height / 2 + elRect.height / 2, behavior: 'smooth' });
  }, [selectedBlockIndex, mode]);

  const [dragBlockIndex, setDragBlockIndex] = useState<number | null>(null);
  const [dragOverBlockIndex, setDragOverBlockIndex] = useState<number | null>(null);
  const [slashAnchor, setSlashAnchor] = useState<HTMLElement | null>(null);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashBlockIndex, setSlashBlockIndex] = useState<number | null>(null);
  const [aiSelection, setAISelection] = useState<{ text: string; rect: DOMRect; blockIndex: number; block: SceneBlock } | null>(null);

  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width > 0 && selectedBlockIndex !== null && currentScene) {
      setAISelection({ text: selection.toString(), rect, blockIndex: selectedBlockIndex, block: currentScene.blocks[selectedBlockIndex] });
    }
  }, [selectedBlockIndex, currentScene]);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [handleSelectionChange]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveScene();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '\\') {
        e.preventDefault();
        splitScene().then(() => { setSelectedBlockIndex(0); setSaveIndicator('saved'); });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [saveScene, splitScene, setSaveIndicator]);

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

  const insertBlock = (atIndex: number, type: SceneBlock['type']) => {
    const newBlocks = [...currentScene.blocks];
    newBlocks.splice(atIndex + 1, 0, createEmptyBlock(type));
    updateCurrentScene({ ...currentScene, blocks: newBlocks });
    setSelectedBlockIndex(atIndex + 1);
  };

  const handleSlashMenuSelect = (item: SlashMenuItem) => {
    setSlashAnchor(null);
    setSlashQuery('');
    if (slashBlockIndex === null) return;
    if (item.blockType === 'scene') { window.dispatchEvent(new CustomEvent('scenaria:addScene')); return; }
    if (item.blockType === 'foreshadowing' || item.blockType === 'payoff') return;
    const block = currentScene.blocks[slashBlockIndex];
    if (isBlockEmpty(block)) {
      handleBlockChange(slashBlockIndex, createEmptyBlock(item.blockType as SceneBlock['type']));
    } else {
      insertBlock(slashBlockIndex, item.blockType as SceneBlock['type']);
    }
  };

  const handleBlockKeyDown = (e: React.KeyboardEvent, index: number) => {
    const block = currentScene.blocks[index];
    if (e.key === '/' && isBlockEmpty(block)) {
      setSlashAnchor(e.currentTarget as HTMLElement); setSlashQuery(''); setSlashBlockIndex(index); return;
    }
    if (slashAnchor) {
      if (e.key === 'Escape' || e.key === ' ') { setSlashAnchor(null); setSlashQuery(''); }
      return;
    }
    const isPlainArrow = !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (isPlainArrow && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      const container = blocksContainerRef.current;
      if (!container) return;
      const el = getBlockEditableEl(container, index);
      if (!el) return;
      if (e.key === 'ArrowUp' && index > 0) {
        const atStart = el.tagName === 'TEXTAREA'
          ? (el as HTMLTextAreaElement).selectionStart === 0
          : (() => { const sel = window.getSelection(); if (!sel?.rangeCount) return false; const pre = document.createRange(); pre.selectNodeContents(el); pre.setEnd(sel.getRangeAt(0).startContainer, sel.getRangeAt(0).startOffset); return pre.toString().length === 0; })();
        if (atStart) { e.preventDefault(); focusBlock(index - 1, true); }
      } else if (e.key === 'ArrowDown' && index < currentScene.blocks.length - 1) {
        const atEnd = el.tagName === 'TEXTAREA'
          ? (el as HTMLTextAreaElement).selectionStart === (el as HTMLTextAreaElement).value.length
          : (() => { const sel = window.getSelection(); if (!sel?.rangeCount) return false; const post = document.createRange(); post.selectNodeContents(el); post.setStart(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset); return post.toString().length === 0; })();
        if (atEnd) { e.preventDefault(); focusBlock(index + 1, false); }
      }
      return;
    }
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      insertBlock(index, getNextBlockType(block, currentScene.blocks, index));
    } else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      const types: SceneBlock['type'][] = ['action', 'character', 'dialogue', 'parenthetical', 'transition'];
      handleBlockChange(index, createEmptyBlock(types[(types.indexOf(block.type) - 1 + types.length) % types.length]));
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const prevChar = currentScene.blocks.slice(0, index).reverse().find(b => b.type === 'character') as CharacterBlock | undefined;
      if (prevChar) {
        const newBlocks = [...currentScene.blocks];
        newBlocks.splice(index + 1, 0, { ...prevChar } as CharacterBlock);
        newBlocks.splice(index + 2, 0, createEmptyBlock('dialogue'));
        updateCurrentScene({ ...currentScene, blocks: newBlocks });
        setSelectedBlockIndex(index + 2);
      }
    } else if (e.key === 'Enter' && !e.shiftKey && block.type === 'dialogue') {
      e.preventDefault();
      insertBlock(index, 'action');
    } else if (e.key === 'Backspace' && isBlockEmpty(block)) {
      e.preventDefault();
      if (currentScene.blocks.length > 1) {
        updateCurrentScene({ ...currentScene, blocks: currentScene.blocks.filter((_, i) => i !== index) });
        setSelectedBlockIndex(Math.max(0, index - 1));
      }
    }
  };

  const handleBlockDragEnd = useCallback(() => {
    if (dragBlockIndex !== null && dragOverBlockIndex !== null && dragBlockIndex !== dragOverBlockIndex) {
      const newBlocks = [...currentScene.blocks];
      const [moved] = newBlocks.splice(dragBlockIndex, 1);
      newBlocks.splice(dragOverBlockIndex, 0, moved);
      updateCurrentScene({ ...currentScene, blocks: newBlocks });
      setSelectedBlockIndex(dragOverBlockIndex);
      scheduleAutosave();
    }
    setDragBlockIndex(null);
    setDragOverBlockIndex(null);
  }, [dragBlockIndex, dragOverBlockIndex, currentScene, updateCurrentScene, scheduleAutosave]);

  const characterNames = Object.fromEntries(charIndex.map((c) => [c.id, c.name]));
  const characterColors = Object.fromEntries(charIndex.map((c) => [c.id, c.color]));
  const wordCount = currentScene.blocks.reduce((sum, b) => sum + ('text' in b && b.text.trim() ? b.text.trim().split(/\s+/).length : 0), 0);
  const estimatedPages = Math.max(0.1, currentScene.blocks.reduce((sum, b) => {
    if (b.type === 'dialogue') return sum + b.text.length * 0.004;
    if (b.type === 'action') return sum + (b as ActionBlock).text.length * 0.003;
    return sum + 0.05;
  }, 0));

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-950" onClick={() => setAISelection(null)}>
      <SceneHeader scene={currentScene} onChange={(updates) => { updateCurrentScene({ ...currentScene, ...updates as Scene }); scheduleAutosave(); }} />

      <div className="flex justify-end items-center gap-3 px-4 py-1">
        <span className="text-xs text-gray-700">
          / 슬래시로 블록 선택 · Tab 다음 블록 · Ctrl+Enter 대사 반복 · Ctrl+Shift+\ 씬 분할
        </span>
        <span className="text-xs text-gray-700">{currentScene.blocks.length}블록 · {wordCount}어절 · 약 {estimatedPages.toFixed(1)}페이지</span>
        <span className={`text-xs ${saveIndicator === 'saved' ? 'text-gray-700' : saveIndicator === 'saving' ? 'text-yellow-600' : 'text-red-600'}`}>
          {saveIndicator === 'saved' ? '저장됨' : saveIndicator === 'saving' ? '저장 중...' : '저장 안됨'}
        </span>
      </div>

      <div ref={blocksContainerRef} className="flex-1 overflow-y-auto px-16 py-8 max-w-3xl mx-auto w-full"
        style={{ fontSize: `${settings.editorFontSize}pt`, lineHeight: settings.lineHeight }}
      >
        {currentScene.blocks.map((block, i) => {
          const props: BlockProps = {
            block, index: i, isSelected: selectedBlockIndex === i, readOnly,
            characterNames, characterColors, charEntries: charIndex,
            dialogueAlignment: settings.dialogueAlignment,
            onSelect: setSelectedBlockIndex,
            onChange: handleBlockChange,
            onKeyDown: handleBlockKeyDown,
          };
          return (
            <BlockWrapper
              key={i} {...props}
              dragOverActive={dragOverBlockIndex === i && dragBlockIndex !== i}
              readOnly={readOnly}
              onDragStart={() => setDragBlockIndex(i)}
              onDragOver={(e) => { e.preventDefault(); setDragOverBlockIndex(i); }}
              onDrop={handleBlockDragEnd}
              onDragEnd={handleBlockDragEnd}
              onAIClick={(b, rect) => setAISelection({ text: 'text' in b ? b.text : '', rect, blockIndex: i, block: b })}
            />
          );
        })}
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => { const nb = [...currentScene.blocks, createEmptyBlock('action')]; updateCurrentScene({ ...currentScene, blocks: nb }); setSelectedBlockIndex(nb.length - 1); }}
            className="text-gray-700 hover:text-gray-500 text-sm font-mono transition-colors"
          >+ 블록 추가 (또는 / 입력)</button>
        </div>
      </div>

      <SceneMetaPane
        scene={currentScene}
        onChange={(updates) => { updateCurrentScene({ ...currentScene, ...updates }); scheduleAutosave(); }}
        readOnly={readOnly}
      />

      <SlashMenu anchorEl={slashAnchor} query={slashQuery} onSelect={handleSlashMenuSelect}
        onClose={() => { setSlashAnchor(null); setSlashQuery(''); }} />

      {aiSelection && (
        <AIFloatingToolbar
          selectedText={aiSelection.text} anchorRect={aiSelection.rect}
          sceneId={currentScene.id} blockIndex={aiSelection.blockIndex}
          originalBlock={aiSelection.block} contextMarkdown={contextMarkdown}
          onApply={(newText) => {
            const block = currentScene.blocks[aiSelection.blockIndex];
            if ('text' in block) handleBlockChange(aiSelection.blockIndex, { ...block, text: newText } as SceneBlock);
          }}
          onClose={() => setAISelection(null)}
        />
      )}
    </div>
  );
}
