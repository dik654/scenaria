import { useRef } from 'react';
import type { TransitionBlock } from '../../types/scene';
import type { BlockProps } from './BlockProps';

const TRANSITION_PRESETS = ['컷', 'F.O.', 'F.I.', 'O.L.', '암전', '점프 컷', '매치 컷'];

export function TransitionBlockView({ block, index, isSelected, readOnly, onSelect, onChange, onKeyDown }: BlockProps) {
  const b = block as TransitionBlock;
  const ref = useRef<HTMLSelectElement>(null);

  return (
    <div
      className={`flex justify-end pt-3 pb-1 px-2 transition-colors ${isSelected ? 'border-l-2 border-blue-400' : 'border-l-2 border-transparent'}`}
      onClick={() => onSelect(index)}
    >
      <select
        ref={ref}
        value={b.transitionType}
        onFocus={() => onSelect(index)}
        onKeyDown={(e) => onKeyDown(e as unknown as React.KeyboardEvent, index)}
        onChange={(e) => { if (!readOnly) onChange(index, { ...b, transitionType: e.target.value }); }}
        className="bg-transparent text-gray-500 text-[10pt] uppercase tracking-widest focus:outline-none cursor-pointer"
      >
        {TRANSITION_PRESETS.map((p) => <option key={p} value={p} className="bg-white">{p}</option>)}
        {!TRANSITION_PRESETS.includes(b.transitionType) && (
          <option value={b.transitionType} className="bg-white">{b.transitionType}</option>
        )}
      </select>
    </div>
  );
}
