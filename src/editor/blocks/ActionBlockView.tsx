import { useEffect, useRef } from 'react';
import type { ActionBlock, Marker } from '../../types/scene';
import type { BlockProps } from './BlockProps';

const MARKER_CONFIG: Record<Marker['type'], { icon: string; base: string }> = {
  foreshadowing: {
    icon: '\u{1F517}',
    base: 'bg-blue-900/60 text-blue-300 border-blue-700/50',
  },
  payoff: {
    icon: '\u{1F3AF}',
    base: 'bg-green-900/60 text-green-300 border-green-700/50',
  },
  note: {
    icon: '\u{1F4DD}',
    base: 'bg-gray-700/60 text-gray-300 border-gray-600/50',
  },
  inconsistency: {
    icon: '\u26A0\uFE0F',
    base: '', // resolved per-severity below
  },
  todo: {
    icon: '\u2610',
    base: 'bg-orange-900/60 text-orange-300 border-orange-700/50',
  },
};

function markerClasses(marker: Marker): string {
  if (marker.type === 'inconsistency') {
    if (marker.severity === 'error') {
      return 'bg-red-900/60 text-red-300 border-red-700/50';
    }
    // 'warning' or default
    return 'bg-yellow-900/60 text-yellow-300 border-yellow-700/50';
  }
  return MARKER_CONFIG[marker.type].base;
}

export function ActionBlockView({ block, index, isSelected, readOnly, onSelect, onChange, onKeyDown }: BlockProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const b = block as ActionBlock;

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
        // readOnly에서는 execCommand가 동작하지 않으므로 직접 설정
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

  const markers = b.markers;

  return (
    <div
      className={`relative group py-1 px-2 transition-colors ${isSelected ? 'border-l-2 border-blue-400' : 'border-l-2 border-transparent'}`}
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
        className="w-full bg-transparent resize-none text-gray-700 text-[11pt] leading-[1.8] focus:outline-none overflow-hidden"
        style={{ minHeight: '1.5em' }}
      />
      {markers && markers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1 mb-0.5">
          {markers.map((m) => (
            <span
              key={m.id}
              title={m.linkedTo ? `Linked to: ${m.linkedTo}` : undefined}
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] leading-tight rounded-full border ${markerClasses(m)}`}
            >
              <span className="flex-shrink-0">{MARKER_CONFIG[m.type].icon}</span>
              <span className="truncate max-w-[180px]">{m.label}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
