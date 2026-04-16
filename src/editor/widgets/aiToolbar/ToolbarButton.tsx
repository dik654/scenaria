import type { ReactNode } from 'react';

export function ToolbarButton({ icon, label, onClick, hasArrow }: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  hasArrow?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
    >
      <span>{icon}</span>
      <span>{label}</span>
      {hasArrow && <span className="text-gray-600">▾</span>}
    </button>
  );
}
