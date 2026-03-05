import { useEffect, useRef } from 'react';
import type { DialogueBlock } from '../../types/scene';
import type { BlockProps } from './BlockProps';

export function DialogueBlockView({ block, index, isSelected, readOnly, dialogueAlignment, onSelect, onChange, onKeyDown }: BlockProps) {
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

  const isCenter = dialogueAlignment === 'center';

  return (
    <div
      className={`${isCenter ? 'flex justify-center' : 'px-12'} py-1 ${isSelected ? 'bg-gray-800/50' : ''} rounded`}
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
        style={{ width: isCenter ? '60%' : '100%', minHeight: '1.5em' }}
      />
    </div>
  );
}
