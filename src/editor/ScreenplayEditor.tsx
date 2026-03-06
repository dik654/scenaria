import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { Scene, SceneBlock, SceneIndexEntry, CharacterBlock, ActionBlock } from '../types/scene';
import { useSceneStore } from '../store/sceneStore';
import { useCharacterStore } from '../store/characterStore';
import { useProjectStore } from '../store/projectStore';
import { fileIO } from '../io';
import { SlashMenu, type SlashMenuItem } from './widgets/SlashMenu';
import { AIFloatingToolbar } from './widgets/AIFloatingToolbar';
import { nextSceneId, renumberScenes } from '../utils/sceneNumbering';
import { sceneFilename } from '../utils/fileNaming';
import { SceneHeader } from './SceneHeader';
import { SceneMetaPane } from './SceneMetaPane';
import { renderBlock, getNextBlockType, createEmptyBlock, isBlockEmpty } from './blocks/renderBlock';
import type { BlockProps } from './blocks/BlockProps';
import { buildContextMarkdown } from '../ai/contextBuilder';

type EditorMode = 'normal' | 'focus' | 'reading' | 'typewriter';

/** Query the editable element inside a block wrapper */
function getBlockEditableEl(container: HTMLDivElement, blockIndex: number): HTMLElement | null {
  return container.querySelector<HTMLElement>(
    `[data-block-index="${blockIndex}"] textarea, [data-block-index="${blockIndex}"] [contenteditable="true"]`
  );
}

export function ScreenplayEditor({ mode = 'normal', readOnly = false }: { mode?: EditorMode; readOnly?: boolean }) {
  const { currentScene, updateCurrentScene, index: sceneIndex, currentSceneId } = useSceneStore();
  const { index: charIndex, characters: loadedCharacters } = useCharacterStore();
  const { dirHandle, autoSave, settings, meta: projectMeta } = useProjectStore();
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(null);
  const [saveIndicator, setSaveIndicator] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  // Build AI context markdown (memoized; rebuilt when scene or characters change)
  const contextMarkdown = useMemo(() => {
    if (!currentScene || !settings.ai.apiKey) return undefined;
    const curIdx = sceneIndex.findIndex(s => s.id === currentSceneId);
    const prevEntry = curIdx > 0 ? sceneIndex[curIdx - 1] : undefined;
    const nextEntry = curIdx >= 0 && curIdx < sceneIndex.length - 1 ? sceneIndex[curIdx + 1] : undefined;
    const characters = Object.values(loadedCharacters);
    return buildContextMarkdown({
      project: {
        title: projectMeta?.title ?? '제목 없음',
        logline: projectMeta?.logline ?? '',
        genre: projectMeta?.genre ?? [],
      },
      currentScene,
      prevScene: prevEntry ? { meta: { summary: prevEntry.summary ?? '', emotionalTone: [], tensionLevel: 5, estimatedMinutes: 1, tags: [] } } : undefined,
      nextScene: nextEntry ? { meta: { summary: nextEntry.summary ?? '', emotionalTone: [], tensionLevel: 5, estimatedMinutes: 1, tags: [] } } : undefined,
      characters,
      totalTokens: 0,
    });
  }, [currentScene, currentSceneId, sceneIndex, loadedCharacters, projectMeta, settings.ai.apiKey]);
  const saveTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const blocksContainerRef = useRef<HTMLDivElement>(null);

  // Cancel pending rAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
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

  const [dragBlockIndex, setDragBlockIndex] = useState<number | null>(null);
  const [dragOverBlockIndex, setDragOverBlockIndex] = useState<number | null>(null);
  const [slashAnchor, setSlashAnchor] = useState<HTMLElement | null>(null);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashBlockIndex, setSlashBlockIndex] = useState<number | null>(null);
  const [aiSelection, setAISelection] = useState<{
    text: string;
    rect: DOMRect;
    blockIndex: number;
    block: SceneBlock;
  } | null>(null);

  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return;
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

  const characterNames = Object.fromEntries(charIndex.map((c) => [c.id, c.name]));
  const characterColors = Object.fromEntries(charIndex.map((c) => [c.id, c.color]));

  const saveScene = useCallback(async () => {
    if (!currentScene || !dirHandle) return;
    setSaveIndicator('saving');
    try {
      const state = useSceneStore.getState();
      const entry = state.index.find((s) => s.id === currentScene.id);
      const filename = entry?.filename ?? `${currentScene.id}.json`;

      const characterIds = [
        ...new Set(
          currentScene.blocks
            .filter((b): b is CharacterBlock => b.type === 'character')
            .map((b) => b.characterId)
            .filter(Boolean)
        ),
      ];
      const sceneToSave: Scene = { ...currentScene, characters: characterIds };

      await fileIO.writeJSON(dirHandle, `screenplay/${filename}`, sceneToSave);

      const indexUpdates: Partial<SceneIndexEntry> = {
        location: sceneToSave.header.location,
        timeOfDay: sceneToSave.header.timeOfDay,
        interior: sceneToSave.header.interior,
        summary: sceneToSave.meta.summary || undefined,
        tags: sceneToSave.meta.tags,
        cardColor: sceneToSave.meta.cardColor,
        tensionLevel: sceneToSave.meta.tensionLevel,
        status: sceneToSave.meta.status,
        characters: characterIds,
        characterCount: characterIds.length,
      };
      state.updateIndexEntry(sceneToSave.id, indexUpdates);

      const newIndex = useSceneStore.getState().index;
      await fileIO.writeJSON(dirHandle, 'screenplay/_index.json', { scenes: newIndex });

      state.updateCurrentScene(sceneToSave);
      state.markClean();
      setSaveIndicator('saved');
      autoSave?.markDirty();
    } catch (err) {
      console.error('씬 저장 실패:', err);
      setSaveIndicator('unsaved');
    }
  }, [currentScene, dirHandle, autoSave]);

  const scheduleAutosave = useCallback(() => {
    setSaveIndicator('unsaved');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(saveScene, 2000);
  }, [saveScene]);

  const handleBlockDragEnd = useCallback(() => {
    if (dragBlockIndex !== null && dragOverBlockIndex !== null && dragBlockIndex !== dragOverBlockIndex) {
      const newBlocks = [...currentScene!.blocks];
      const [moved] = newBlocks.splice(dragBlockIndex, 1);
      newBlocks.splice(dragOverBlockIndex, 0, moved);
      updateCurrentScene({ ...currentScene!, blocks: newBlocks });
      setSelectedBlockIndex(dragOverBlockIndex);
      scheduleAutosave();
    }
    setDragBlockIndex(null);
    setDragOverBlockIndex(null);
  }, [dragBlockIndex, dragOverBlockIndex, currentScene, updateCurrentScene, scheduleAutosave]);

  const splitScene = useCallback(async () => {
    if (!currentScene || !dirHandle || selectedBlockIndex === null || selectedBlockIndex === 0) return;
    const state = useSceneStore.getState();
    const entry = state.index.find((s) => s.id === currentScene.id);
    if (!entry) return;

    const blocksA = currentScene.blocks.slice(0, selectedBlockIndex);
    const blocksB = currentScene.blocks.slice(selectedBlockIndex);
    if (blocksA.length === 0 || blocksB.length === 0) return;

    const currentIndex = state.index;
    const newId = nextSceneId(currentIndex);
    const extractChars = (blocks: SceneBlock[]) =>
      [...new Set(blocks.filter((b): b is CharacterBlock => b.type === 'character').map((b) => b.characterId).filter(Boolean))];

    const newScene: Scene = { ...currentScene, id: newId, version: 1, blocks: blocksB, characters: extractChars(blocksB) };
    const sceneA: Scene = { ...currentScene, blocks: blocksA, characters: extractChars(blocksA) };
    const newFilename = sceneFilename(newId, newScene.header.location);

    await fileIO.writeJSON(dirHandle, `screenplay/${entry.filename}`, sceneA);
    await fileIO.writeJSON(dirHandle, `screenplay/${newFilename}`, newScene);

    const insertAt = currentIndex.findIndex((s) => s.id === currentScene.id) + 1;
    const newEntry: SceneIndexEntry = { ...entry, id: newId, filename: newFilename, characterCount: newScene.characters.length };
    const renumbered = renumberScenes([...currentIndex.slice(0, insertAt), newEntry, ...currentIndex.slice(insertAt)]);
    await fileIO.writeJSON(dirHandle, 'screenplay/_index.json', { scenes: renumbered });

    state.updateCurrentScene(sceneA);
    state.markClean();
    state.updateIndexEntry(currentScene.id, { characterCount: sceneA.characters.length });
    state.setIndex(renumbered);
    state.setCurrentScene(newId, newScene);
    setSelectedBlockIndex(0);
    setSaveIndicator('saved');
  }, [currentScene, dirHandle, selectedBlockIndex]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveScene();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '\\') {
        e.preventDefault();
        splitScene();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [saveScene, splitScene]);

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
      setSlashAnchor(e.currentTarget as HTMLElement);
      setSlashQuery('');
      setSlashBlockIndex(index);
      return;
    }

    if (slashAnchor) {
      if (e.key === 'Escape' || e.key === ' ') { setSlashAnchor(null); setSlashQuery(''); }
      return;
    }

    // Arrow key cross-block navigation
    const isPlainArrow = !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (isPlainArrow && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      const container = blocksContainerRef.current;
      if (!container) return;
      const el = getBlockEditableEl(container, index);
      if (!el) return;

      if (e.key === 'ArrowUp' && index > 0) {
        const atStart = el.tagName === 'TEXTAREA'
          ? (el as HTMLTextAreaElement).selectionStart === 0
          : (() => {
              const sel = window.getSelection();
              if (!sel?.rangeCount) return false;
              const pre = document.createRange();
              pre.selectNodeContents(el);
              pre.setEnd(sel.getRangeAt(0).startContainer, sel.getRangeAt(0).startOffset);
              return pre.toString().length === 0;
            })();
        if (atStart) { e.preventDefault(); focusBlock(index - 1, true); }

      } else if (e.key === 'ArrowDown' && index < currentScene.blocks.length - 1) {
        const atEnd = el.tagName === 'TEXTAREA'
          ? (el as HTMLTextAreaElement).selectionStart === (el as HTMLTextAreaElement).value.length
          : (() => {
              const sel = window.getSelection();
              if (!sel?.rangeCount) return false;
              const post = document.createRange();
              post.selectNodeContents(el);
              post.setStart(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset);
              return post.toString().length === 0;
            })();
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
      const prevType = types[(types.indexOf(block.type) - 1 + types.length) % types.length];
      handleBlockChange(index, createEmptyBlock(prevType));
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

  const handleBlockInput = (index: number, value: string) => {
    if (slashAnchor && slashBlockIndex === index) {
      const slashPos = value.indexOf('/');
      if (slashPos >= 0) setSlashQuery(value.slice(slashPos + 1));
      else { setSlashAnchor(null); setSlashQuery(''); }
    }
  };

  // Page count derived from blocks (no state needed)
  const wordCount = currentScene.blocks.reduce((sum, b) => {
    const text = 'text' in b ? b.text : '';
    return sum + (text.trim() ? text.trim().split(/\s+/).length : 0);
  }, 0);
  const estimatedPages = Math.max(0.1, currentScene.blocks.reduce((sum, b) => {
    if (b.type === 'dialogue') return sum + b.text.length * 0.004;
    if (b.type === 'action') return sum + (b as ActionBlock).text.length * 0.003;
    return sum + 0.05;
  }, 0));

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-950" onClick={() => setAISelection(null)}>
      <SceneHeader scene={currentScene} onChange={handleHeaderChange} />

      <div className="flex justify-end items-center gap-3 px-4 py-1">
        <span className="text-xs text-gray-700">
          / 슬래시로 블록 선택 · Tab 다음 블록 · Ctrl+Enter 대사 반복 · Ctrl+Shift+\ 씬 분할
        </span>
        <span className="text-xs text-gray-700">
          {currentScene.blocks.length}블록 · {wordCount}어절 · 약 {estimatedPages.toFixed(1)}페이지
        </span>
        <span className={`text-xs ${
          saveIndicator === 'saved' ? 'text-gray-700' :
          saveIndicator === 'saving' ? 'text-yellow-600' : 'text-red-600'
        }`}>
          {saveIndicator === 'saved' ? '저장됨' : saveIndicator === 'saving' ? '저장 중...' : '저장 안됨'}
        </span>
      </div>

      <div
        ref={blocksContainerRef}
        className="flex-1 overflow-y-auto px-16 py-8 max-w-3xl mx-auto w-full"
        style={{ fontSize: `${settings.editorFontSize}pt`, lineHeight: settings.lineHeight }}
      >
        {currentScene.blocks.map((block, i) => {
          const props: BlockProps = {
            block,
            index: i,
            isSelected: selectedBlockIndex === i,
            readOnly,
            characterNames,
            characterColors,
            charEntries: charIndex,
            dialogueAlignment: settings.dialogueAlignment,
            onSelect: setSelectedBlockIndex,
            onChange: (idx, b) => { handleBlockChange(idx, b); handleBlockInput(idx, 'text' in b ? b.text : ''); },
            onKeyDown: handleBlockKeyDown,
          };
          return (
            <div
              key={i}
              data-block-index={i}
              draggable={!readOnly}
              onDragStart={() => setDragBlockIndex(i)}
              onDragOver={(e) => { e.preventDefault(); setDragOverBlockIndex(i); }}
              onDrop={handleBlockDragEnd}
              onDragEnd={handleBlockDragEnd}
              className={`mb-1 relative group transition-all ${
                dragOverBlockIndex === i && dragBlockIndex !== i ? 'border-t-2 border-blue-500' : ''
              }`}
            >
              {i === selectedBlockIndex && i > 0 && (
                <div className="absolute -top-px left-0 right-0 h-px bg-orange-500/40 pointer-events-none" title="Ctrl+Shift+\로 여기서 씬 분할" />
              )}
              {!readOnly && (
                <span
                  className="absolute -left-5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-700 hover:text-gray-400 cursor-grab active:cursor-grabbing select-none text-xs"
                  title="드래그하여 순서 변경"
                >
                  ⠿
                </span>
              )}
              {renderBlock(props)}
              {(block.type === 'dialogue' || block.type === 'action') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setAISelection({ text: 'text' in block ? block.text : '', rect, blockIndex: i, block });
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

        <div className="mt-8 flex justify-center">
          <button
            onClick={() => {
              const newBlocks = [...currentScene.blocks, createEmptyBlock('action')];
              updateCurrentScene({ ...currentScene, blocks: newBlocks });
              setSelectedBlockIndex(newBlocks.length - 1);
            }}
            className="text-gray-700 hover:text-gray-500 text-sm font-mono transition-colors"
          >
            + 블록 추가 (또는 / 입력)
          </button>
        </div>
      </div>

      <SceneMetaPane
        scene={currentScene}
        onChange={(updates) => { updateCurrentScene({ ...currentScene, ...updates }); scheduleAutosave(); }}
        readOnly={readOnly}
      />

      <SlashMenu
        anchorEl={slashAnchor}
        query={slashQuery}
        onSelect={handleSlashMenuSelect}
        onClose={() => { setSlashAnchor(null); setSlashQuery(''); }}
      />

      {aiSelection && (
        <AIFloatingToolbar
          selectedText={aiSelection.text}
          anchorRect={aiSelection.rect}
          sceneId={currentScene.id}
          blockIndex={aiSelection.blockIndex}
          originalBlock={aiSelection.block}
          contextMarkdown={contextMarkdown}
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
