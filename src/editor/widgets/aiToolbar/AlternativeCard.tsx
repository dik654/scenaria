export function AlternativeCard({ label, tone, content, isCurrent, isLoading, onApply }: {
  label: string;
  tone: string;
  content: string;
  isCurrent?: boolean;
  isLoading?: boolean;
  onApply?: () => void;
}) {
  return (
    <div className={`w-52 bg-gray-900 border rounded-xl p-3 shadow-xl flex flex-col gap-2 ${isCurrent ? 'border-gray-600' : 'border-gray-700'}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-400">{label}</span>
        <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded-full">{tone}</span>
      </div>
      <div className="flex-1 min-h-16">
        {isLoading ? (
          <div className="animate-pulse space-y-1">
            <div className="h-2 bg-gray-700 rounded w-full" />
            <div className="h-2 bg-gray-700 rounded w-4/5" />
            <div className="h-2 bg-gray-700 rounded w-3/5" />
          </div>
        ) : (
          <p className="text-xs text-gray-200 leading-relaxed whitespace-pre-wrap break-words">{content}</p>
        )}
      </div>
      {!isCurrent && !isLoading && onApply && (
        <button
          onClick={onApply}
          className="w-full text-xs py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-lg transition-colors"
        >
          적용
        </button>
      )}
      {isCurrent && <div className="text-center text-xs text-gray-600">✓ 현재</div>}
    </div>
  );
}
