import { useEffect, useRef } from 'react';
import type { ActionBlock } from '../../types/scene';
import type { BlockProps } from './BlockProps';

export function ActionBlockView({ block, index, isSelected, readOnly, onSelect, onChange, onKeyDown }: BlockProps) {
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
