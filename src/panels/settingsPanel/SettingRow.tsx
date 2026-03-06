export function SettingRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1.5">
        {label}
        {hint && <span className="text-gray-600 ml-1">({hint})</span>}
      </label>
      {children}
    </div>
  );
}
