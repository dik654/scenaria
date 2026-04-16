import { useMemo } from 'react';
import DiffMatchPatch from 'diff-match-patch';

interface InlineDiffProps {
  original: string;
  modified: string;
  className?: string;
}

const dmp = new DiffMatchPatch();

export function InlineDiff({ original, modified, className }: InlineDiffProps) {
  const diffs = useMemo(() => {
    const rawDiffs = dmp.diff_main(original, modified);
    dmp.diff_cleanupSemantic(rawDiffs);
    return rawDiffs as [number, string][];
  }, [original, modified]);

  return (
    <div className={`font-mono text-xs leading-relaxed p-2 bg-gray-50 rounded-lg border border-gray-200 ${className ?? ''}`}>
      {diffs.map(([op, text], i) => {
        if (op === -1) {
          return (
            <span
              key={i}
              className="bg-red-100 text-red-600 line-through"
            >
              {text}
            </span>
          );
        }
        if (op === 1) {
          return (
            <span
              key={i}
              className="bg-green-100 text-green-600 underline"
            >
              {text}
            </span>
          );
        }
        return <span key={i} className="text-gray-600">{text}</span>;
      })}
    </div>
  );
}
