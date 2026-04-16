import { useEffect, useRef } from 'react';
import type { DialogueBlock } from '../../types/scene';
import type { BlockProps } from './BlockProps';

export function DialogueBlockView({ block, index, isSelected, readOnly, dialogueAlignment, onSelect, onChange, onKeyDown }: BlockProps) {
  const b = block as DialogueBlock;
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isSelected && ref.current) ref.current.focus();
  }, [isSelected]);

  // 초기 마운트 시 높이 자동 조정
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = ref.current.scrollHeight + 'px';
    }
  }, []);

  // Sync textarea when text changes externally (e.g. AI apply, typewriter animation)
  useEffect(() => {
    if (ref.current && ref.current.value !== b.text) {
      if (readOnly) {
        ref.current.value = b.text;
      } else {
        ref.current.focus();
        ref.current.select();
        document.execCommand('insertText', false, b.text);
      }
      ref.current.style.height = 'auto';
      ref.current.style.height = ref.current.scrollHeight + 'px';
    }
  }, [b.text, readOnly]);

  const handleInput = () => {
    if (!ref.current || readOnly) return;
    ref.current.style.height = 'auto';
    ref.current.style.height = ref.current.scrollHeight + 'px';
    onChange(index, { ...b, text: ref.current.value });
  };

  const isCenter = dialogueAlignment === 'center';

  return (
    <div
      className={`py-0.5 transition-colors ${isSelected ? 'border-l-2 border-blue-400' : 'border-l-2 border-transparent'}`}
      style={{ paddingLeft: '3em', paddingRight: '2em' }}
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
        className="w-full bg-transparent resize-none text-gray-700 text-[11pt] leading-[1.8] focus:outline-none overflow-hidden"
        style={{ minHeight: '1.5em' }}
      />
    </div>
  );
}
