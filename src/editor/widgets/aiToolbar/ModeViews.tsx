import { useRef } from 'react';
import { Pencil, MessageSquare } from 'lucide-react';
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
        <span className="text-xs text-gray-400"><Pencil className="w-3 h-3 inline" /> 수정 지시</span>
        <button onClick={onClose} className="ml-auto text-gray-600 hover:text-gray-400 text-xs">✕</button>
      </div>
      <input
        ref={inputRef}
        autoFocus
        value={instruction}
        onChange={(e) => onInstruction(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onModify()}
        placeholder="예: 더 긴박하게, 말투를 바꿔서..."
        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400 mb-2"
      />
      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
      {modifiedText ? (
        <>
          {isLoading ? (
            <div className="font-mono text-xs leading-relaxed p-2 bg-gray-50 rounded-lg border border-gray-200">
              <span className="text-gray-700 whitespace-pre-wrap">{modifiedText}</span>
              <span className="animate-pulse text-blue-400 ml-0.5">▊</span>
            </div>
          ) : (
            <InlineDiff original={originalText} modified={modifiedText} />
          )}
          <div className="flex gap-2 mt-2">
            <button onClick={onCancel} disabled={isLoading} className="flex-1 text-xs py-1.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-50">취소</button>
            <button onClick={onApply} disabled={isLoading} className="flex-1 text-xs py-1.5 bg-blue-500 rounded-lg text-white hover:bg-blue-600 disabled:opacity-50">적용</button>
          </div>
        </>
      ) : (
        <button
          onClick={onModify}
          disabled={!instruction.trim() || isLoading}
          className="w-full text-xs py-2 bg-blue-500 rounded-lg text-white hover:bg-blue-600 disabled:opacity-50"
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
        <span className="text-xs text-gray-400"><MessageSquare className="w-3 h-3 inline" /> 자유 지시</span>
        <button onClick={onClose} className="ml-auto text-gray-600 hover:text-gray-400 text-xs">✕</button>
      </div>
      <input
        autoFocus
        value={instruction}
        onChange={(e) => onInstruction(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && onGenerate()}
        placeholder="자유롭게 지시하세요..."
        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400 mb-2"
      />
      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
      <button
        onClick={onGenerate}
        disabled={!instruction.trim() || isLoading}
        className="w-full text-xs py-2 bg-blue-500 rounded-lg text-white hover:bg-blue-600 disabled:opacity-50"
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
          className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition-colors"
        >
          {qa.label}
        </button>
      ))}
      <div className="border-t border-gray-100 mt-1 pt-1">
        <button onClick={onClose} className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600">← 뒤로</button>
      </div>
    </div>
  );
}
