import type { SceneBlock } from '../types/scene';
import { renderBlock } from './blocks/renderBlock';
import type { BlockProps } from './blocks/BlockProps';

interface BlockWrapperProps extends BlockProps {
  dragOverActive: boolean;
  readOnly: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
  onAIClick: (block: SceneBlock, rect: DOMRect) => void;
}

export function BlockWrapper({
  dragOverActive,
  readOnly,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onAIClick,
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
      className={`mb-1 relative group transition-all ${dragOverActive ? 'border-t-2 border-blue-500' : ''}`}
    >
      {isSelected && blockIndex > 0 && (
        <div
          className="absolute -top-px left-0 right-0 h-px bg-orange-500/40 pointer-events-none"
          title="Ctrl+Shift+\로 여기서 씬 분할"
        />
      )}

      {!readOnly && (
        <span
          className="absolute -left-5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-700 hover:text-gray-400 cursor-grab active:cursor-grabbing select-none text-xs"
          title="드래그하여 순서 변경"
        >
          ⠿
        </span>
      )}

      {renderBlock({ ...blockProps, readOnly })}

      {(block.type === 'dialogue' || block.type === 'action') && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAIClick(block, e.currentTarget.getBoundingClientRect());
          }}
          title="AI 대안 생성"
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-6 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-600 hover:text-blue-400 w-5 h-5 flex items-center justify-center"
        >
          🔀
        </button>
      )}
    </div>
  );
}
