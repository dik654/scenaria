import type { SceneBlock } from '../types/scene';
import { renderBlock } from './blocks/renderBlock';
import type { BlockProps } from './blocks/BlockProps';
import { Shuffle, ChevronUp, ChevronDown, Trash2, Sparkles, Wand2 } from 'lucide-react';

interface BlockWrapperProps extends BlockProps {
  dragOverActive: boolean;
  readOnly: boolean;
  selectedBlockIndex: number;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
  onAIClick: (block: SceneBlock, rect: DOMRect) => void;
  onPolishClick: (block: SceneBlock, rect: DOMRect) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export function BlockWrapper({
  dragOverActive,
  readOnly,
  selectedBlockIndex,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onAIClick,
  onPolishClick,
  onMoveUp,
  onMoveDown,
  onDelete,
  isFirst,
  isLast,
  ...blockProps
}: BlockWrapperProps) {
  const { block, index: blockIndex, isSelected } = blockProps;

  return (
    <div
      data-block-index={blockIndex}
      draggable={!readOnly}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`relative group transition-all ${isSelected ? 'z-10' : 'z-0'} ${dragOverActive ? 'border-t-2 border-blue-400' : ''}`}
    >
      {isSelected && blockIndex > 0 && (
        <div
          className="absolute -top-px left-0 right-0 h-px bg-blue-300/40 pointer-events-none"
          title="Ctrl+Shift+\로 여기서 씬 분할"
        />
      )}

      {!readOnly && isSelected && (
        <div className="absolute -left-10 top-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 opacity-40 hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
            disabled={isFirst}
            title="위로 이동"
            className="w-5 h-5 flex items-center justify-center text-zinc-400 hover:text-zinc-600 disabled:opacity-20 disabled:cursor-not-allowed rounded-md hover:bg-zinc-100 transition-colors"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <span
            className="text-zinc-300 hover:text-zinc-500 cursor-grab active:cursor-grabbing select-none text-xs leading-none"
            title="드래그하여 순서 변경"
          >
            ⠿
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
            disabled={isLast}
            title="아래로 이동"
            className="w-5 h-5 flex items-center justify-center text-zinc-400 hover:text-zinc-600 disabled:opacity-20 disabled:cursor-not-allowed rounded-md hover:bg-zinc-100 transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="삭제"
            className="w-5 h-5 flex items-center justify-center text-zinc-400 hover:text-red-400 rounded-md hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          {(block.type === 'dialogue' || block.type === 'action' || block.type === 'parenthetical') && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAIClick(block, e.currentTarget.getBoundingClientRect());
              }}
              title="AI 대안 생성"
              className="w-5 h-5 flex items-center justify-center text-zinc-400 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
            >
              <Shuffle className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* 텍스트 블록 hover 시 AI 버튼 — 선택 블록 인접 시 숨김 */}
      {!readOnly && !isSelected && Math.abs(blockIndex - selectedBlockIndex) > 1 && (block.type === 'action' || block.type === 'dialogue' || block.type === 'parenthetical') && (
        <div className="absolute -left-14 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
          <button
            onClick={(e) => { e.stopPropagation(); onPolishClick(block, e.currentTarget.getBoundingClientRect()); }}
            title="어색한 부분 자연스럽게 수정"
            className="w-5 h-5 flex items-center justify-center text-zinc-300 hover:text-amber-500 rounded-md hover:bg-amber-50 transition-colors"
          >
            <Wand2 className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onAIClick(block, e.currentTarget.getBoundingClientRect()); }}
            title="AI 대안 생성"
            className="w-5 h-5 flex items-center justify-center text-zinc-300 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
          >
            <Sparkles className="w-3 h-3" />
          </button>
        </div>
      )}

      {renderBlock({ ...blockProps, readOnly })}
    </div>
  );
}
