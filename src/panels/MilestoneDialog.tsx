import { useState } from 'react';

interface MilestoneDialogProps {
  onClose: () => void;
  onCreated: (name: string) => void;
}

export function MilestoneDialog({ onClose, onCreated }: MilestoneDialogProps) {
  const [name, setName] = useState('');

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white border border-gray-200 rounded-xl p-6 w-80 shadow-lg">
        <h2 className="text-lg font-bold text-gray-900 mb-4">★ 이름 붙이기</h2>
        <p className="text-xs text-gray-500 mb-3">현재 상태에 이름을 붙입니다.</p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && onCreated(name.trim())}
          placeholder="예: 초고, 감독 피드백 반영, 최종본"
          autoFocus
          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-100 mb-4"
        />
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => name.trim() && onCreated(name.trim())}
            disabled={!name.trim()}
            className="flex-1 px-4 py-2 rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
          >
            이름 붙이기
          </button>
        </div>
      </div>
    </div>
  );
}
