import { useState, useRef, useMemo, useEffect, useLayoutEffect } from 'react';
import type { Scene } from '../types/scene';
import { useSceneStore } from '../store/sceneStore';

const TIME_OPTIONS = ['DAY', 'NIGHT', 'DAWN', 'DUSK', 'CONTINUOUS'] as const;
const INT_OPTIONS = ['INT', 'EXT', 'INT/EXT'] as const;

const INT_LABELS: Record<string, string> = {
  'INT': '실내',
  'EXT': '실외',
  'INT/EXT': '실내/실외',
};

const TIME_LABELS: Record<string, string> = {
  'DAY': '낮',
  'NIGHT': '밤',
  'DAWN': '새벽',
  'DUSK': '황혼',
  'CONTINUOUS': '연속',
};

/** 숨겨진 span으로 실제 텍스트 폭을 측정하는 인라인 input */
function AutoInput({
  value,
  onChange,
  placeholder,
  className,
  onFocus,
  inputRef,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  onFocus?: () => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const measRef = useRef<HTMLSpanElement>(null);
  const localRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? localRef;
  const [width, setWidth] = useState(40);

  useLayoutEffect(() => {
    if (measRef.current) setWidth(measRef.current.scrollWidth + 2);
  }, [value, placeholder]);

  const display = value || placeholder || '';

  return (
    <span className="relative inline-flex items-baseline">
      {/* 측정용 숨겨진 span — input과 동일한 폰트/크기 상속 */}
      <span
        ref={measRef}
        className={className}
        style={{ position: 'absolute', visibility: 'hidden', whiteSpace: 'pre', height: 0, overflow: 'hidden', pointerEvents: 'none' }}
        aria-hidden
      >
        {display}
      </span>
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        placeholder={placeholder}
        className={className}
        style={{ width: `${Math.max(24, width)}px` }}
      />
    </span>
  );
}

/** 클릭하면 옵션이 뜨는 인라인 텍스트 드롭다운 */
function InlineSelect<T extends string>({
  value,
  options,
  labels,
  onChange,
}: {
  value: T;
  options: readonly T[];
  labels: Record<string, string>;
  onChange: (val: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const display = labels[value] || value;

  return (
    <span ref={ref} className="relative inline-block">
      <span
        onClick={() => setOpen(!open)}
        className="cursor-pointer hover:text-blue-600 transition-colors"
      >
        {display}
      </span>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-0.5 min-w-[4rem]">
          {options.map((o) => (
            <button
              key={o}
              onClick={() => { onChange(o); setOpen(false); }}
              className={`block w-full text-left px-3 py-1 text-sm font-normal transition-colors ${o === value ? 'text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              {labels[o]}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

function LocationAutocomplete({
  value,
  onChange,
  suggestions,
  placeholder,
  className,
}: {
  value: string;
  onChange: (val: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!value.trim()) { setFilteredSuggestions([]); return; }
    const filtered = suggestions.filter(
      s => s !== value && s.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredSuggestions(filtered.slice(0, 8));
  }, [value, suggestions]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node) && !inputRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <span className="relative inline-flex">
      <AutoInput
        value={value}
        onChange={(v) => { onChange(v); setIsOpen(true); }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className={className}
        inputRef={inputRef}
      />
      {isOpen && filteredSuggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-[200px] max-h-48 overflow-y-auto"
        >
          {filteredSuggestions.map((s) => (
            <button
              key={s}
              onClick={() => { onChange(s); setIsOpen(false); }}
              className="block w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

export function SceneHeader({ scene, onChange }: { scene: Scene; onChange: (updates: Partial<Scene>) => void }) {
  const { header } = scene;
  const { index } = useSceneStore();

  const sceneNumber = scene.id.replace('s', '').replace(/^0+/, '') || '?';
  const intLabel = INT_LABELS[header.interior ?? ''];

  const locationSuggestions = useMemo(() => {
    const locations = new Set<string>();
    for (const entry of index) {
      if (entry.location) locations.add(entry.location);
    }
    return [...locations].sort();
  }, [index]);

  // Format: S#1. 실내. 장소명 (밤)
  return (
    <div className="pb-4 mb-4 border-b border-gray-300 text-[12pt] font-bold leading-relaxed tracking-wide">
      <span className="text-gray-800">S#{sceneNumber}.</span>
      {' '}
      <InlineSelect
        value={(header.interior ?? 'INT') as typeof INT_OPTIONS[number]}
        options={INT_OPTIONS}
        labels={INT_LABELS}
        onChange={(val) => onChange({ header: { ...header, interior: val as Scene['header']['interior'] } })}
      />
      {intLabel && <span className="text-gray-800">.</span>}
      {' '}
      <LocationAutocomplete
        value={header.location}
        onChange={(val) => onChange({ header: { ...header, location: val } })}
        suggestions={locationSuggestions}
        placeholder="장소"
        className="bg-transparent text-gray-800 text-[12pt] font-bold focus:outline-none border-b border-transparent focus:border-gray-400 hover:border-gray-300 transition-colors p-0"
      />
      {header.locationDetail && (
        <>
          <span className="text-gray-400 mx-0.5">/</span>
          <AutoInput
            value={header.locationDetail}
            onChange={(val) => onChange({ header: { ...header, locationDetail: val } })}
            className="bg-transparent text-gray-800 text-[12pt] font-bold focus:outline-none border-b border-transparent focus:border-gray-400 hover:border-gray-300 transition-colors p-0"
          />
        </>
      )}
      {' '}
      <span className="text-gray-800">(</span>
      <InlineSelect
        value={header.timeOfDay}
        options={TIME_OPTIONS}
        labels={TIME_LABELS}
        onChange={(val) => onChange({ header: { ...header, timeOfDay: val as Scene['header']['timeOfDay'] } })}
      />
      <span className="text-gray-800">)</span>
    </div>
  );
}
