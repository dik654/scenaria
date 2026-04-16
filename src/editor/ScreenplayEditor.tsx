import { useEffect, useRef, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { FileText as FileTextIcon, User as UserIcon, MessageSquare, File, Sparkles, X } from 'lucide-react';
import type { Scene, SceneBlock, CharacterBlock, ActionBlock, Marker } from '../types/scene';
import { useSceneStore } from '../store/sceneStore';
import { useCharacterStore } from '../store/characterStore';
import { useProjectStore } from '../store/projectStore';
import { useStoryStore } from '../store/storyStore';
import type { ForeshadowingItem } from '../types/story';
import { nanoid } from 'nanoid';
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
import { SceneGeneratePanel } from './SceneGeneratePanel';
import { useTypewriterAnimation } from './hooks/useTypewriterAnimation';
import { useSceneHistory } from './hooks/useSceneHistory';

type EditorMode = 'normal' | 'focus' | 'reading' | 'typewriter';

function getBlockEditableEl(container: HTMLDivElement, blockIndex: number): HTMLElement | null {
  return container.querySelector<HTMLElement>(
    `[data-block-index="${blockIndex}"] textarea, [data-block-index="${blockIndex}"] [contenteditable="true"]`
  );
}

/* ---------- Block Type Conversion Menu (F2) ---------- */
interface BlockTypeOption {
  type: SceneBlock['type'];
  label: string;
  icon: ReactNode;
  shortcut: string;
}

const BLOCK_TYPE_OPTIONS: BlockTypeOption[] = [
  { type: 'action',        label: '지문',   icon: <FileTextIcon className="w-4 h-4" />, shortcut: 'A' },
  { type: 'character',     label: '캐릭터명', icon: <UserIcon className="w-4 h-4" />, shortcut: 'C' },
  { type: 'dialogue',      label: '대사',   icon: <MessageSquare className="w-4 h-4" />, shortcut: 'D' },
  { type: 'parenthetical', label: '지시문', icon: '()',  shortcut: 'P' },
  { type: 'transition',    label: '전환',   icon: '→',  shortcut: 'T' },
];

const BLOCK_TYPE_LABEL_MAP: Record<string, string> = {
  action: '지문', character: '캐릭터', dialogue: '대사',
  parenthetical: '지시문', transition: '전환',
};

function BlockTypeMenu({
  anchorEl,
  currentType,
  onSelect,
  onClose,
}: {
  anchorEl: HTMLElement | null;
  currentType: SceneBlock['type'];
  onSelect: (type: SceneBlock['type']) => void;
  onClose: () => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // Reset selection when the menu opens
  useEffect(() => {
    const idx = BLOCK_TYPE_OPTIONS.findIndex((o) => o.type === currentType);
    setSelectedIndex(idx >= 0 ? idx : 0);
  }, [currentType]);

  // Keyboard navigation
  useEffect(() => {
    if (!anchorEl) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((i) => (i + 1) % BLOCK_TYPE_OPTIONS.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((i) => (i - 1 + BLOCK_TYPE_OPTIONS.length) % BLOCK_TYPE_OPTIONS.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        onSelect(BLOCK_TYPE_OPTIONS[selectedIndex].type);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [anchorEl, selectedIndex, onSelect, onClose]);

  // Close when clicking outside
  useEffect(() => {
    if (!anchorEl) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [anchorEl, onClose]);

  if (!anchorEl) return null;

  const rect = anchorEl.getBoundingClientRect();

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: rect.bottom + 4,
        left: Math.min(rect.left, window.innerWidth - 220),
        zIndex: 1000,
        width: 220,
      }}
      className="bg-white border border-zinc-200 rounded-xl shadow-lg overflow-hidden"
    >
      <div className="px-3 py-1.5 border-b border-zinc-100 text-xs text-zinc-400 font-mono">
        단락 유형 <span className="text-zinc-300">(F2)</span>
      </div>
      {BLOCK_TYPE_OPTIONS.map((opt, i) => (
        <button
          key={opt.type}
          onClick={() => onSelect(opt.type)}
          onMouseEnter={() => setSelectedIndex(i)}
          className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
            i === selectedIndex ? 'bg-zinc-50' : 'hover:bg-zinc-50'
          } ${opt.type === currentType ? 'ring-1 ring-inset ring-blue-400/30' : ''}`}
        >
          <span className="text-base w-6 text-center text-zinc-500">{opt.icon}</span>
          <span className="text-sm text-zinc-700 font-medium flex-1">{opt.label}</span>
          <span className="text-xs text-zinc-400 font-mono">{opt.shortcut}</span>
        </button>
      ))}
    </div>
  );
}
/* ---------------------------------------------------- */

export function ScreenplayEditor({ mode = 'normal', readOnly = false }: { mode?: EditorMode; readOnly?: boolean }) {
  const { currentScene, updateCurrentScene, updateIndexEntry, index: sceneIndex, currentSceneId } = useSceneStore();
  const { index: charIndex, characters: loadedCharacters } = useCharacterStore();
  const { settings, meta: projectMeta } = useProjectStore();

  const { saveScene, scheduleAutosave, saveIndicator, setSaveIndicator } = useSceneSave(currentScene);
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(null);
  const { splitScene } = useSplitScene(currentScene, selectedBlockIndex);
  const hasAI = !!settings.ai.apiKey || settings.ai.provider === 'local-vllm' || settings.ai.provider === 'claude-code';
  const contextMarkdown = useAIContext(
    currentScene, currentSceneId, sceneIndex, loadedCharacters, projectMeta, hasAI
  );

  const [exampleDismissed, setExampleDismissed] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const sceneHistory = useSceneHistory();

  // 씬 전환 시 예시 상태 및 히스토리 초기화
  useEffect(() => { setExampleDismissed(false); sceneHistory.clear(); }, [currentSceneId, sceneHistory]);

  // AI 씬 생성 타자기 애니메이션
  const typewriter = useTypewriterAnimation((finalBlocks) => {
    if (currentScene) {
      updateCurrentScene({ ...currentScene, blocks: finalBlocks });
      // 즉시 캐릭터 수 업데이트 (저장 전에도 사이드바 반영)
      const uniqueChars = [...new Set(
        finalBlocks.filter((b): b is CharacterBlock => b.type === 'character').map(b => b.characterId.trim()).filter(Boolean)
      )];
      updateIndexEntry(currentScene.id, { characterCount: uniqueChars.length, characters: uniqueChars });
      scheduleAutosave();
      // 완료 후 마지막 블록에 포커스
      setSelectedBlockIndex(finalBlocks.length - 1);
      requestAnimationFrame(() => {
        const container = blocksContainerRef.current;
        if (container) {
          const lastEl = getBlockEditableEl(container, finalBlocks.length - 1);
          lastEl?.focus();
          const scrollParent = container.closest('.editor-desk') as HTMLElement | null;
          if (scrollParent) {
            scrollParent.scrollTo({ top: scrollParent.scrollHeight, behavior: 'smooth' });
          }
        }
      });
    }
  });

  const rafRef = useRef<number | null>(null);
  const blocksContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, []);

  // 타자기 애니메이션 중 자동 스크롤 + Esc 스킵
  useEffect(() => {
    if (!typewriter.isAnimating || !blocksContainerRef.current) return;
    const container = blocksContainerRef.current;
    const lastBlock = container.querySelector<HTMLElement>(`[data-block-index="${typewriter.displayBlocks.length - 1}"]`);
    if (lastBlock) {
      const scrollParent = lastBlock.closest('.editor-desk') as HTMLElement | null;
      if (scrollParent) {
        // 마지막 블록 하단이 스크롤 영역의 70% 지점에 오도록
        const blockRect = lastBlock.getBoundingClientRect();
        const parentRect = scrollParent.getBoundingClientRect();
        const offset = blockRect.bottom - parentRect.top + scrollParent.scrollTop;
        scrollParent.scrollTo({ top: offset - parentRect.height * 0.7, behavior: 'smooth' });
      }
    }
  }, [typewriter.isAnimating, typewriter.displayBlocks.length]);

  useEffect(() => {
    if (!typewriter.isAnimating) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); typewriter.skip(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [typewriter.isAnimating, typewriter.skip]);

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
  const [aiSelection, setAISelection] = useState<{ text: string; rect: DOMRect; blockIndex: number; block: SceneBlock; initialPrompt?: string } | null>(null);
  const [blockTypeMenuIndex, setBlockTypeMenuIndex] = useState<number | null>(null);

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

  const handleBlockDragEnd = useCallback(() => {
    if (!currentScene || dragBlockIndex === null || dragOverBlockIndex === null || dragBlockIndex === dragOverBlockIndex) {
      setDragBlockIndex(null);
      setDragOverBlockIndex(null);
      return;
    }
    sceneHistory.push(currentScene);
    const newBlocks = [...currentScene.blocks];
    const [moved] = newBlocks.splice(dragBlockIndex, 1);
    newBlocks.splice(dragOverBlockIndex, 0, moved);
    updateCurrentScene({ ...currentScene, blocks: newBlocks });
    setSelectedBlockIndex(dragOverBlockIndex);
    scheduleAutosave();
    setDragBlockIndex(null);
    setDragOverBlockIndex(null);
  }, [dragBlockIndex, dragOverBlockIndex, currentScene, updateCurrentScene, scheduleAutosave]);

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

  // Undo / Redo (구조 변경 전용 — textarea 내 텍스트 undo는 브라우저가 처리)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const active = document.activeElement;
      const inTextInput = active?.tagName === 'TEXTAREA' || active?.tagName === 'INPUT';
      if (e.key === 'z' && !e.shiftKey) {
        if (!sceneHistory.canUndo()) return;
        e.preventDefault();
        const cur = useSceneStore.getState().currentScene;
        if (!cur) return;
        const prev = sceneHistory.undo(cur);
        if (prev) { updateCurrentScene(prev); scheduleAutosave(); }
      }
      if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        if (!sceneHistory.canRedo()) return;
        e.preventDefault();
        const cur = useSceneStore.getState().currentScene;
        if (!cur) return;
        const next = sceneHistory.redo(cur);
        if (next) { updateCurrentScene(next); scheduleAutosave(); }
      }
    };
    window.addEventListener('keydown', handler, true);  // capture phase로 브라우저 undo보다 먼저 처리
    return () => window.removeEventListener('keydown', handler, true);
  }, [sceneHistory, updateCurrentScene, scheduleAutosave]);

  if (!currentScene) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4 flex justify-center"><File className="w-10 h-10 text-zinc-300" /></div>
          <p className="text-zinc-500">씬을 선택하거나 새 씬을 추가하세요</p>
          <p className="text-sm mt-1 text-zinc-400">Ctrl+Shift+S로 새 씬 추가</p>
        </div>
      </div>
    );
  }

  const handleBlockChange = (index: number, block: SceneBlock) => {
    // 텍스트 타이핑은 textarea 자체 undo로 처리 — 구조 변경만 히스토리 기록
    const oldBlock = currentScene.blocks[index];
    const isTextOnly = oldBlock.type === block.type && 'text' in oldBlock && 'text' in block;
    if (!isTextOnly) sceneHistory.push(currentScene);
    const newBlocks = [...currentScene.blocks];
    newBlocks[index] = block;
    updateCurrentScene({ ...currentScene, blocks: newBlocks });
    scheduleAutosave();
  };

  const insertBlock = (atIndex: number, type: SceneBlock['type']) => {
    sceneHistory.push(currentScene);
    const newBlocks = [...currentScene.blocks];
    newBlocks.splice(atIndex + 1, 0, createEmptyBlock(type));
    updateCurrentScene({ ...currentScene, blocks: newBlocks });
    setSelectedBlockIndex(atIndex + 1);
  };

  const moveBlockUp = (index: number) => {
    if (index <= 0) return;
    sceneHistory.push(currentScene);
    const newBlocks = [...currentScene.blocks];
    [newBlocks[index - 1], newBlocks[index]] = [newBlocks[index], newBlocks[index - 1]];
    updateCurrentScene({ ...currentScene, blocks: newBlocks });
    setSelectedBlockIndex(index - 1);
    scheduleAutosave();
  };

  const moveBlockDown = (index: number) => {
    if (index >= currentScene.blocks.length - 1) return;
    sceneHistory.push(currentScene);
    const newBlocks = [...currentScene.blocks];
    [newBlocks[index], newBlocks[index + 1]] = [newBlocks[index + 1], newBlocks[index]];
    updateCurrentScene({ ...currentScene, blocks: newBlocks });
    setSelectedBlockIndex(index + 1);
    scheduleAutosave();
  };

  const deleteBlock = (index: number) => {
    if (currentScene.blocks.length <= 1) return;
    sceneHistory.push(currentScene);
    updateCurrentScene({ ...currentScene, blocks: currentScene.blocks.filter((_, i) => i !== index) });
    setSelectedBlockIndex(Math.max(0, index - 1));
    scheduleAutosave();
  };

  const handleSlashMenuSelect = (item: SlashMenuItem) => {
    setSlashAnchor(null);
    setSlashQuery('');
    if (slashBlockIndex === null) return;
    if (item.blockType === 'scene') { window.dispatchEvent(new CustomEvent('scenaria:addScene')); return; }
    if (item.blockType === 'foreshadowing') {
      const block = currentScene.blocks[slashBlockIndex];
      if ('text' in block && block.type === 'action') {
        const markerId = `fs-${nanoid(8)}`;
        const marker: Marker = { type: 'foreshadowing', id: markerId, label: block.text.slice(0, 30) || '복선' };
        const newBlock = { ...block, markers: [...(block.markers ?? []), marker] } as ActionBlock;
        handleBlockChange(slashBlockIndex, newBlock);
        // Register in foreshadowing store
        const fsItem: ForeshadowingItem = {
          id: markerId, type: 'foreshadowing',
          plantedIn: { scene: currentScene.id, blockIndex: slashBlockIndex, description: block.text.slice(0, 60) },
          payoff: null, status: 'planted', importance: 'major',
        };
        useStoryStore.getState().addForeshadowingItem(fsItem);
      }
      return;
    }
    if (item.blockType === 'payoff') {
      const block = currentScene.blocks[slashBlockIndex];
      if ('text' in block && block.type === 'action') {
        // Find unresolved foreshadowing items for payoff linking
        const unresolved = useStoryStore.getState().unresolvedForeshadowing();
        if (unresolved.length > 0) {
          // Link to most recent unresolved foreshadowing
          const target = unresolved[unresolved.length - 1];
          const marker: Marker = { type: 'payoff', id: `po-${nanoid(8)}`, label: `회수: ${target.plantedIn.description.slice(0, 20)}`, linkedTo: target.id };
          const newBlock = { ...block, markers: [...(block.markers ?? []), marker] } as ActionBlock;
          handleBlockChange(slashBlockIndex, newBlock);
          // Update foreshadowing status
          useStoryStore.getState().updateForeshadowingItem(target.id, {
            status: 'resolved',
            payoff: { scene: currentScene.id, blockIndex: slashBlockIndex, description: block.text.slice(0, 60), strength: 'medium' },
          });
        }
      }
      return;
    }
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
    if (e.key === 'F2') {
      e.preventDefault();
      setBlockTypeMenuIndex(index);
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
    } else if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      const el = e.currentTarget as HTMLElement;
      const isAtEnd = el.tagName === 'TEXTAREA'
        ? (el as unknown as HTMLTextAreaElement).selectionStart === (el as unknown as HTMLTextAreaElement).value.length
        : true;
      if (isAtEnd || block.type !== 'action') {
        e.preventDefault();
        insertBlock(index, getNextBlockType(block, currentScene.blocks, index));
      }
    } else if (e.key === 'Backspace' && isBlockEmpty(block)) {
      e.preventDefault();
      if (currentScene.blocks.length > 1) {
        sceneHistory.push(currentScene);
        updateCurrentScene({ ...currentScene, blocks: currentScene.blocks.filter((_, i) => i !== index) });
        setSelectedBlockIndex(Math.max(0, index - 1));
      }
    }
  };

  const characterNames = Object.fromEntries(charIndex.map((c) => [c.id, c.name]));
  const characterColors = Object.fromEntries(charIndex.map((c) => [c.id, c.color]));
  const wordCount = currentScene.blocks.reduce((sum, b) => sum + ('text' in b && b.text.trim() ? b.text.trim().split(/\s+/).length : 0), 0);
  const estimatedPages = Math.max(0.1, currentScene.blocks.reduce((sum, b) => {
    if (b.type === 'dialogue') return sum + b.text.length * 0.004;
    if (b.type === 'action') return sum + (b as ActionBlock).text.length * 0.003;
    return sum + 0.05;
  }, 0));

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white" onClick={(e) => {
      setAISelection(null);
      // 바깥 클릭 시 블록 포커스 해제 (블록 내부 클릭은 stopPropagation 불필요 — data-block-index로 판별)
      const target = e.target as HTMLElement;
      if (!target.closest('[data-block-index]')) setSelectedBlockIndex(null);
    }}>
      {/* 읽기 모드: 툴바 완전 숨김 / 집중 모드: 최소 정보만 / 일반: 전체 */}
      {!readOnly && (
        <div className="flex items-center gap-3 px-6 py-1.5">
          {mode === 'normal' && selectedBlockIndex !== null && currentScene.blocks[selectedBlockIndex] && (
            <button
              onClick={() => setBlockTypeMenuIndex(selectedBlockIndex)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 transition-colors text-[11px] text-zinc-600 font-medium"
              title="단락 유형 변경 (F2)"
            >
              <span className="text-zinc-400">
                {BLOCK_TYPE_OPTIONS.find(o => o.type === currentScene.blocks[selectedBlockIndex!].type)?.icon}
              </span>
              {BLOCK_TYPE_LABEL_MAP[currentScene.blocks[selectedBlockIndex!].type]}
              <span className="text-zinc-300 text-[9px] ml-1">F2</span>
            </button>
          )}
          <div className="flex-1" />
          {mode === 'normal' && (
            <span className="text-[11px] text-zinc-400">
              Enter 다음 · Tab 요소 전환 · / 삽입 · F2 유형
            </span>
          )}
          <span className="text-[11px] text-zinc-400">{wordCount}어절 · {estimatedPages.toFixed(1)}p</span>
          <span className={`text-[11px] ${saveIndicator === 'saved' ? 'text-zinc-300' : saveIndicator === 'saving' ? 'text-amber-500' : 'text-red-500'}`}>
            {saveIndicator === 'saved' ? '저장됨' : saveIndicator === 'saving' ? '저장 중...' : '저장 안됨'}
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto editor-desk">
        <div
          ref={blocksContainerRef}
          className="editor-paper mx-auto my-8 rounded-sm"
          style={{ maxWidth: '210mm', minHeight: '297mm', padding: '2.5cm 2cm', fontSize: `${settings.editorFontSize}pt`, lineHeight: settings.lineHeight }}
        >
          {(() => {
            const showExample = !exampleDismissed && currentScene.blocks.every(isBlockEmpty) && !readOnly && !typewriter.isAnimating && !showGenerateModal;
            return (
              <>
                <SceneHeader scene={currentScene} onChange={(updates) => { updateCurrentScene({ ...currentScene, ...updates as Scene }); scheduleAutosave(); }} />
                {showExample && (
                  <div
                    className="select-none cursor-pointer opacity-60 hover:opacity-70 transition-opacity"
                    onClick={() => {
                      setExampleDismissed(true);
                      setSelectedBlockIndex(0);
                      requestAnimationFrame(() => {
                        const container = blocksContainerRef.current;
                        if (container) {
                          const el = getBlockEditableEl(container, 0);
                          el?.focus();
                        }
                      });
                    }}
                  >
                    {/* 블록 구조 예시 — 각 블록을 카드로 시각화 */}
                    {[
                      { tag: '지문', color: 'border-gray-300', content: (
                        <div className="text-[11pt] leading-[1.8] text-gray-500">
                          카페 안. 오후의 햇살이 유리창을 통해 비스듬히 들어온다. 한쪽 구석 테이블 위에 식어버린 아메리카노 두 잔이 놓여 있다. 민수(30대 초반)가 초조하게 핸드폰을 확인한다. 카페 문이 열리고 수진(30대 초반)이 들어온다.
                        </div>
                      )},
                      { tag: '캐릭터', color: 'border-red-300', content: (
                        <div className="font-bold text-[11pt] tracking-wide text-gray-500" style={{ paddingLeft: '3em' }}>민수</div>
                      )},
                      { tag: '대사', color: 'border-blue-300', content: (
                        <div className="text-[11pt] leading-[1.8] text-gray-500" style={{ paddingLeft: '3em', paddingRight: '2em' }}>
                          우리가 마지막으로 여기 온 게 언제였지?
                        </div>
                      )},
                      { tag: '캐릭터', color: 'border-red-300', content: (
                        <div className="font-bold text-[11pt] tracking-wide text-gray-500" style={{ paddingLeft: '3em' }}>수진</div>
                      )},
                      { tag: '지시문', color: 'border-amber-300', content: (
                        <div className="italic text-[10pt] text-gray-400" style={{ paddingLeft: '3em' }}>(커피잔을 내려놓으며)</div>
                      )},
                      { tag: '대사', color: 'border-blue-300', content: (
                        <div className="text-[11pt] leading-[1.8] text-gray-500" style={{ paddingLeft: '3em', paddingRight: '2em' }}>
                          기억 안 나? 네가 떠나기 전날이었어. 비가 엄청 오던 날.
                        </div>
                      )},
                      { tag: '지문', color: 'border-gray-300', content: (
                        <div className="text-[11pt] leading-[1.8] text-gray-500">
                          민수의 표정이 굳는다. 창밖으로 눈길을 돌린다. 거리에는 우산을 쓴 행인들이 지나간다.
                        </div>
                      )},
                      { tag: '캐릭터 (V.O.)', color: 'border-purple-300', content: (
                        <div className="font-bold text-[11pt] tracking-wide text-gray-500" style={{ paddingLeft: '3em' }}>
                          민수 <span className="font-normal text-[10pt] text-gray-400">(V.O.)</span>
                        </div>
                      )},
                      { tag: '대사', color: 'border-blue-300', content: (
                        <div className="text-[11pt] leading-[1.8] text-gray-500" style={{ paddingLeft: '3em', paddingRight: '2em' }}>
                          그날도 이렇게 비가 왔었다. 아무것도 모르던 우리는 그게 마지막인 줄 몰랐다.
                        </div>
                      )},
                      { tag: '지문', color: 'border-gray-300', content: (
                        <div className="text-[11pt] leading-[1.8] text-gray-500">
                          수진이 가방에서 낡은 사진 한 장을 꺼내 테이블 위에 놓는다. 사진 속에는 젊은 두 사람이 웃고 있다.
                        </div>
                      )},
                      { tag: '캐릭터 (O.S.)', color: 'border-purple-300', content: (
                        <div className="font-bold text-[11pt] tracking-wide text-gray-500" style={{ paddingLeft: '3em' }}>
                          카페 주인 <span className="font-normal text-[10pt] text-gray-400">(O.S.)</span>
                        </div>
                      )},
                      { tag: '대사', color: 'border-blue-300', content: (
                        <div className="text-[11pt] leading-[1.8] text-gray-500" style={{ paddingLeft: '3em', paddingRight: '2em' }}>
                          손님, 곧 마감이에요.
                        </div>
                      )},
                      { tag: '지문', color: 'border-gray-300', content: (
                        <div className="text-[11pt] leading-[1.8] text-gray-500">
                          수진이 천천히 일어선다. 사진을 테이블 위에 남겨두고 문 쪽으로 걸어간다.
                        </div>
                      )},
                      { tag: '전환', color: 'border-green-300', content: (
                        <div className="text-right text-[11pt] font-bold tracking-wider text-gray-500 pr-4">컷</div>
                      )},
                    ].map((block, i) => (
                      <div key={i} className={`border-l-2 ${block.color} pl-3 py-1 mb-1`}>
                        <span className="text-[9px] text-zinc-400 font-mono">{block.tag}</span>
                        {block.content}
                      </div>
                    ))}

                    {/* ── 조작 안내 ── */}
                    <div className="mt-8 pt-5 border-t border-zinc-200/50 space-y-1.5">
                      <div className="text-center text-xs text-zinc-500 font-medium mb-3">작성 단축키</div>
                      <div className="flex justify-center gap-8 text-[11px] text-zinc-500">
                        <div className="space-y-1.5 text-center">
                          <div><span className="font-mono bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-600">Enter</span> 다음 블록</div>
                          <div><span className="font-mono bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-600">Tab</span> 블록 유형 전환</div>
                          <div><span className="font-mono bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-600">/</span> 삽입 메뉴</div>
                        </div>
                        <div className="space-y-1.5 text-center">
                          <div><span className="font-mono bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-600">F2</span> 블록 유형 변경</div>
                          <div><span className="font-mono bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-600">Ctrl+Enter</span> 같은 캐릭터 대사</div>
                          <div><span className="font-mono bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-600">텍스트 선택</span> AI 도구</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 text-center text-xs text-zinc-400">
                      클릭하여 작성 시작
                    </div>
                  </div>
                )}
                {!readOnly && (
                  <div className="mt-4 flex justify-center">
                    <button
                      onClick={() => setShowGenerateModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      AI 씬 생성
                    </button>
                  </div>
                )}
              </>
            );
          })()}
          {(() => {
            const renderBlocks = typewriter.isAnimating ? typewriter.displayBlocks : currentScene.blocks;
            const isReadOnly = typewriter.isAnimating || readOnly;
            return renderBlocks.map((block, i) => {
              const props: BlockProps = {
                block, index: i, isSelected: !readOnly && selectedBlockIndex === i, readOnly: isReadOnly,
                characterNames, characterColors, charEntries: charIndex,
                dialogueAlignment: settings.dialogueAlignment,
                onSelect: setSelectedBlockIndex,
                onChange: handleBlockChange,
                onKeyDown: handleBlockKeyDown,
              };
              return (
                <div key={i}>
                  {i > 0 && !isReadOnly && (
                    <div className="group/insert h-3 flex items-center">
                      <button
                        onClick={() => insertBlock(i - 1, 'action')}
                        className="w-full h-full flex items-center opacity-0 group-hover/insert:opacity-100 transition-opacity cursor-pointer"
                      >
                        <div className="flex-1 h-0.5 bg-zinc-300" />
                        <span className="mx-1 text-[10px] text-zinc-400 leading-none select-none">+</span>
                        <div className="flex-1 h-0.5 bg-zinc-300" />
                      </button>
                    </div>
                  )}
                  <BlockWrapper
                    {...props}
                    dragOverActive={dragOverBlockIndex === i && dragBlockIndex !== i}
                    readOnly={isReadOnly}
                    selectedBlockIndex={selectedBlockIndex}
                    onDragStart={() => setDragBlockIndex(i)}
                    onDragOver={(e) => { e.preventDefault(); setDragOverBlockIndex(i); }}
                    onDrop={handleBlockDragEnd}
                    onDragEnd={handleBlockDragEnd}
                    onAIClick={(b, rect) => setAISelection({ text: 'text' in b ? b.text : '', rect, blockIndex: i, block: b })}
                    onPolishClick={(b, rect) => setAISelection({ text: 'text' in b ? b.text : '', rect, blockIndex: i, block: b, initialPrompt: '내용과 의미는 그대로 유지하되 어색한 표현만 자연스럽게 다듬어주세요' })}
                    onMoveUp={() => moveBlockUp(i)}
                    onMoveDown={() => moveBlockDown(i)}
                    onDelete={() => deleteBlock(i)}
                    isFirst={i === 0}
                    isLast={i === renderBlocks.length - 1}
                  />
                </div>
              );
            });
          })()}
          {typewriter.isAnimating && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={typewriter.skip}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs text-zinc-500 bg-white/80 border border-zinc-200 rounded-full hover:bg-zinc-50 hover:text-zinc-700 transition-colors shadow-sm"
              >
                건너뛰기
                <span className="text-[10px] text-zinc-400 font-mono">Esc</span>
              </button>
            </div>
          )}
          {!typewriter.isAnimating && (
            <div className="mt-8 flex justify-center">
              <button
                onClick={() => { sceneHistory.push(currentScene); const nb = [...currentScene.blocks, createEmptyBlock('action')]; updateCurrentScene({ ...currentScene, blocks: nb }); setSelectedBlockIndex(nb.length - 1); }}
                className="text-zinc-300 hover:text-blue-600 text-sm transition-colors"
              >+</button>
            </div>
          )}
        </div>
      </div>

      <SceneMetaPane
        scene={currentScene}
        onChange={(updates) => { updateCurrentScene({ ...currentScene, ...updates }); scheduleAutosave(); }}
        readOnly={readOnly}
      />

      <SlashMenu anchorEl={slashAnchor} query={slashQuery} onSelect={handleSlashMenuSelect}
        onClose={() => { setSlashAnchor(null); setSlashQuery(''); }} />

      <BlockTypeMenu
        anchorEl={
          blockTypeMenuIndex !== null && blocksContainerRef.current
            ? blocksContainerRef.current.querySelector<HTMLElement>(`[data-block-index="${blockTypeMenuIndex}"]`)
            : null
        }
        currentType={blockTypeMenuIndex !== null ? currentScene.blocks[blockTypeMenuIndex].type : 'action'}
        onSelect={(newType) => {
          if (blockTypeMenuIndex !== null) {
            const oldBlock = currentScene.blocks[blockTypeMenuIndex];
            const newBlock = createEmptyBlock(newType);
            // Preserve text content when both source and destination have a text field
            if ('text' in oldBlock && 'text' in newBlock) {
              (newBlock as { text: string }).text = oldBlock.text;
            }
            handleBlockChange(blockTypeMenuIndex, newBlock);
          }
          setBlockTypeMenuIndex(null);
        }}
        onClose={() => setBlockTypeMenuIndex(null)}
      />

      {aiSelection && (
        <AIFloatingToolbar
          selectedText={aiSelection.text} anchorRect={aiSelection.rect}
          sceneId={currentScene.id} blockIndex={aiSelection.blockIndex}
          originalBlock={aiSelection.block} contextMarkdown={contextMarkdown}
          initialPrompt={aiSelection.initialPrompt}
          onApply={(newText) => {
            const block = currentScene.blocks[aiSelection.blockIndex];
            if ('text' in block) handleBlockChange(aiSelection.blockIndex, { ...block, text: newText } as SceneBlock);
          }}
          onClose={() => setAISelection(null)}
        />
      )}

      {showGenerateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) setShowGenerateModal(false); }}
        >
          <div className="bg-white rounded-xl shadow-xl w-[400px] max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-semibold text-zinc-800">AI 씬 생성</span>
              </div>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-4 pb-4">
              <SceneGeneratePanel
                currentScene={currentScene}
                onApply={(updates) => {
                  setShowGenerateModal(false);
                  setExampleDismissed(true);
                  if (updates.header) {
                    updateCurrentScene({ ...currentScene, header: updates.header, blocks: [] });
                  } else {
                    updateCurrentScene({ ...currentScene, blocks: [] });
                  }
                  setSelectedBlockIndex(0);
                  if (updates.blocks) typewriter.start(updates.blocks);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
