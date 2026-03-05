import { useEffect, useRef } from 'react';
import type { ParentheticalBlock } from '../../types/scene';
import type { BlockProps } from './BlockProps';

export function ParentheticalBlockView({ block, index, isSelected, readOnly, onSelect, onChange, onKeyDown }: BlockProps) {
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
