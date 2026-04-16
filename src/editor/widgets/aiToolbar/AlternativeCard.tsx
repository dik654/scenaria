const shimmerStyle = `
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`;

function ShimmerBar({ width, delay }: { width: string; delay: string }) {
  return (
    <div
      className="h-2 rounded"
      style={{
        width,
        background: 'linear-gradient(90deg, #e5e7eb 25%, #bfdbfe 50%, #e5e7eb 75%)',
        backgroundSize: '200% 100%',
        animation: `shimmer 1.5s ease-in-out infinite`,
        animationDelay: delay,
      }}
    />
  );
}

export function AlternativeCard({ label, tone, content, isCurrent, isLoading, onApply }: {
  label: string;
  tone: string;
  content: string;
  isCurrent?: boolean;
  isLoading?: boolean;
  onApply?: () => void;
}) {
  return (
    <div className={`w-52 bg-white border rounded-xl p-3 shadow-lg flex flex-col gap-2 ${isCurrent ? 'border-blue-200' : 'border-gray-200'}`}>
      {isLoading && <style>{shimmerStyle}</style>}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${isLoading ? 'text-blue-500 bg-blue-50' : 'text-gray-500 bg-gray-100'}`}>{tone}</span>
      </div>
      <div className="flex-1 min-h-16">
        {isLoading && !content ? (
          <div className="space-y-2">
            <ShimmerBar width="100%" delay="0ms" />
            <ShimmerBar width="85%" delay="100ms" />
            <ShimmerBar width="65%" delay="200ms" />
          </div>
        ) : (
          <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
            {content}
            {isLoading && <span className="animate-pulse text-blue-400 ml-0.5">▊</span>}
          </p>
        )}
      </div>
      {!isCurrent && !isLoading && onApply && (
        <button
          onClick={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); onApply(); }}
          className="w-full text-xs py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
        >
          적용
        </button>
      )}
      {isCurrent && <div className="text-center text-xs text-blue-500">✓ 현재</div>}
    </div>
  );
}
