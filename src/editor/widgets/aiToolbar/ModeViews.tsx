import { useRef } from 'react';
import { InlineDiff } from '../InlineDiff';

interface ModifyModeProps {
  instruction: string;
  onInstruction: (v: string) => void;
  modifiedText: string | null;
  originalText: string;
  isLoading: boolean;
  error: string | null;
  onModify: () => void;
  onApply: () => void;
  onCancel: () => void;
  onClose: () => void;
}

export function ModifyMode({
  instruction, onInstruction, modifiedText, originalText,
  isLoading, error, onModify, onApply, onCancel, onClose,
}: ModifyModeProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="p-3 w-80">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-gray-400">✏️ 수정 지시</span>
        <button onClick={onClose} className="ml-auto text-gray-600 hover:text-gray-400 text-xs">✕</button>
      </div>
      <input
        ref={inputRef}
        autoFocus
        value={instruction}
        onChange={(e) => onInstruction(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onModify()}
        placeholder="예: 더 긴박하게, 말투를 바꿔서..."
        className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500 mb-2"
      />
      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
      {modifiedText ? (
        <>
          <InlineDiff original={originalText} modified={modifiedText} />
          <div className="flex gap-2 mt-2">
            <button onClick={onCancel} className="flex-1 text-xs py-1.5 border border-gray-600 rounded-lg text-gray-400 hover:bg-gray-800">취소</button>
            <button onClick={onApply} className="flex-1 text-xs py-1.5 bg-green-700 rounded-lg text-white hover:bg-green-600">적용</button>
          </div>
        </>
      ) : (
        <button
          onClick={onModify}
          disabled={!instruction.trim() || isLoading}
          className="w-full text-xs py-2 bg-red-600 rounded-lg text-white hover:bg-red-700 disabled:opacity-50"
        >
          {isLoading ? '생성 중...' : 'AI에게 수정 요청'}
        </button>
      )}
    </div>
  );
}

interface FreeformModeProps {
  instruction: string;
  onInstruction: (v: string) => void;
  isLoading: boolean;
  error: string | null;
  onGenerate: () => void;
  onClose: () => void;
}

export function FreeformMode({ instruction, onInstruction, isLoading, error, onGenerate, onClose }: FreeformModeProps) {
  return (
    <div className="p-3 w-80">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-gray-400">💬 자유 지시</span>
        <button onClick={onClose} className="ml-auto text-gray-600 hover:text-gray-400 text-xs">✕</button>
      </div>
      <input
        autoFocus
        value={instruction}
        onChange={(e) => onInstruction(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && onGenerate()}
        placeholder="자유롭게 지시하세요..."
        className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500 mb-2"
      />
      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
      <button
        onClick={onGenerate}
        disabled={!instruction.trim() || isLoading}
        className="w-full text-xs py-2 bg-red-600 rounded-lg text-white hover:bg-red-700 disabled:opacity-50"
      >
        {isLoading ? '생성 중...' : '대안 생성'}
      </button>
    </div>
  );
}

interface QuickActionsModeProps {
  actions: { id: string; label: string; prompt: string }[];
  onSelect: (prompt: string) => void;
  onClose: () => void;
}

export function QuickActionsMode({ actions, onSelect, onClose }: QuickActionsModeProps) {
  return (
    <div className="w-52 py-1">
      {actions.map((qa) => (
        <button
          key={qa.id}
          onClick={() => onSelect(qa.prompt)}
          className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
        >
          {qa.label}
        </button>
      ))}
      <div className="border-t border-gray-700 mt-1 pt-1">
        <button onClick={onClose} className="w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:text-gray-400">← 뒤로</button>
      </div>
    </div>
  );
}
