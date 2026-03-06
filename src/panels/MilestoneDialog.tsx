import { useState } from 'react';

interface MilestoneDialogProps {
  onClose: () => void;
  onCreated: (name: string) => void;
}

export function MilestoneDialog({ onClose, onCreated }: MilestoneDialogProps) {
  const [name, setName] = useState('');

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-80 shadow-2xl">
        <h2 className="text-lg font-bold text-white mb-4">★ 이름 붙이기</h2>
        <p className="text-xs text-gray-500 mb-3">현재 상태에 이름을 붙입니다.</p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && onCreated(name.trim())}
          placeholder="예: 초고, 감독 피드백 반영, 최종본"
          autoFocus
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 mb-4"
        />
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-600 text-gray-400 hover:bg-gray-800 transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => name.trim() && onCreated(name.trim())}
            disabled={!name.trim()}
            className="flex-1 px-4 py-2 rounded-lg bg-yellow-600 text-white font-medium hover:bg-yellow-700 disabled:opacity-50 transition-colors"
          >
            이름 붙이기
          </button>
        </div>
      </div>
    </div>
  );
}
