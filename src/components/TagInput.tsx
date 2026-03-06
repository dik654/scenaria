import { useState } from 'react';

export function TagInput({ tags, onChange, readOnly }: {
  tags: string[];
  onChange: (tags: string[]) => void;
  readOnly: boolean;
}) {
  const [inputValue, setInputValue] = useState('');

  const addTag = (value: string) => {
    const tag = value.trim();
    if (!tag || tags.includes(tag)) { setInputValue(''); return; }
    onChange([...tags, tag]);
    setInputValue('');
  };

  return (
    <div className="flex flex-wrap gap-1.5 items-center min-h-7 bg-gray-900 border border-gray-700 rounded px-2 py-1">
      {tags.map((tag) => (
        <span key={tag} className="flex items-center gap-1 bg-gray-700 rounded-full px-2 py-0.5 text-xs text-gray-300">
          {tag}
          {!readOnly && (
            <button
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className="text-gray-500 hover:text-red-400 transition-colors leading-none"
            >
              ×
            </button>
          )}
        </span>
      ))}
      {!readOnly && (
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(inputValue); }
            if (e.key === 'Backspace' && !inputValue && tags.length > 0) onChange(tags.slice(0, -1));
          }}
          onBlur={() => inputValue && addTag(inputValue)}
          placeholder={tags.length === 0 ? '태그 입력 후 Enter' : ''}
          className="bg-transparent text-xs text-gray-300 focus:outline-none min-w-20 placeholder-gray-700"
        />
      )}
    </div>
  );
}
