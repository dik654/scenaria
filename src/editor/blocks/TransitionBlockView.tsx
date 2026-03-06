import { useRef } from 'react';
import type { TransitionBlock } from '../../types/scene';
import type { BlockProps } from './BlockProps';

const TRANSITION_PRESETS = ['CUT TO:', 'FADE OUT.', 'DISSOLVE TO:', 'SMASH CUT TO:', 'MATCH CUT TO:', 'CUT TO BLACK.', 'FADE IN:'];

export function TransitionBlockView({ block, index, isSelected, readOnly, onSelect, onChange, onKeyDown }: BlockProps) {
  const b = block as TransitionBlock;
  const ref = useRef<HTMLSelectElement>(null);

  return (
    <div
      className={`flex justify-end py-1 px-2 ${isSelected ? 'bg-gray-800/50' : ''} rounded`}
      onClick={() => onSelect(index)}
    >
      <select
        ref={ref}
        value={b.transitionType}
        onFocus={() => onSelect(index)}
        onKeyDown={(e) => onKeyDown(e as unknown as React.KeyboardEvent, index)}
        onChange={(e) => { if (!readOnly) onChange(index, { ...b, transitionType: e.target.value }); }}
        className="bg-transparent text-gray-400 font-mono text-sm uppercase tracking-widest focus:outline-none cursor-pointer"
      >
        {TRANSITION_PRESETS.map((p) => <option key={p} value={p} className="bg-gray-900">{p}</option>)}
        {!TRANSITION_PRESETS.includes(b.transitionType) && (
          <option value={b.transitionType} className="bg-gray-900">{b.transitionType}</option>
        )}
      </select>
    </div>
  );
}
