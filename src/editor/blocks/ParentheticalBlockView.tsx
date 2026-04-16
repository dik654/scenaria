import { useEffect, useRef } from 'react';
import type { ParentheticalBlock } from '../../types/scene';
import type { BlockProps } from './BlockProps';

export function ParentheticalBlockView({ block, index, isSelected, readOnly, onSelect, onChange, onKeyDown }: BlockProps) {
  const b = block as ParentheticalBlock;
  const ref = useRef<HTMLTextAreaElement>(null);

  // 괄호 포함한 표시 텍스트 — )가 항상 내용 뒤에 위치
  const display = `(${b.text})`;

  useEffect(() => {
    if (isSelected && ref.current) ref.current.focus();
  }, [isSelected]);

  // 외부 변경 동기화 (타자기 애니메이션 등)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.value !== display) el.value = display;
  }, [display]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    if (readOnly) return;
    let val = e.target.value;
    // 바깥 괄호 제거 → 내부 텍스트만 모델에 전달
    if (val.startsWith('(')) val = val.slice(1);
    if (val.endsWith(')')) val = val.slice(0, -1);
    onChange(index, { ...b, text: val });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const ta = ref.current!;
    const s = ta.selectionStart;
    const end = ta.selectionEnd;
    const len = ta.value.length;

    // 여는 괄호 보호
    if (e.key === 'Backspace' && s <= 1 && end <= 1) { e.preventDefault(); return; }
    if (e.key === 'Delete' && s === 0 && end === 0) { e.preventDefault(); return; }
    // 닫는 괄호 보호
    if (e.key === 'Backspace' && s === len && end === len) { e.preventDefault(); return; }
    if (e.key === 'Delete' && s >= len - 1 && end >= len - 1) { e.preventDefault(); return; }
    // 줄바꿈 방지 — 시각적 래핑만 허용
    if (e.key === 'Enter') { e.preventDefault(); onKeyDown(e, index); return; }

    onKeyDown(e, index);
  }

  return (
    <div
      className={`py-0 transition-colors ${isSelected ? 'border-l-2 border-blue-400' : 'border-l-2 border-transparent'}`}
      style={{ paddingLeft: '3em' }}
      onClick={() => onSelect(index)}
    >
      <textarea
        ref={ref}
        defaultValue={display}
        onFocus={() => onSelect(index)}
        onKeyDown={handleKeyDown}
        readOnly={readOnly}
        onChange={handleChange}
        rows={1}
        className="bg-transparent italic text-gray-500 text-[10pt] focus:outline-none resize-none p-0 border-0 break-words"
        style={{
          maxWidth: '100%',
          overflow: 'hidden',
          fieldSizing: 'content',
        } as React.CSSProperties}
      />
    </div>
  );
}
