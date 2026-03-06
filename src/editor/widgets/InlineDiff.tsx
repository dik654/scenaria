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
    <div className={`font-mono text-xs leading-relaxed p-2 bg-gray-800 rounded-lg border border-gray-700 ${className ?? ''}`}>
      {diffs.map(([op, text], i) => {
        if (op === -1) {
          return (
            <span
              key={i}
              className="bg-red-900/60 text-red-300 line-through"
            >
              {text}
            </span>
          );
        }
        if (op === 1) {
          return (
            <span
              key={i}
              className="bg-green-900/60 text-green-300 underline"
            >
              {text}
            </span>
          );
        }
        return <span key={i} className="text-gray-300">{text}</span>;
      })}
    </div>
  );
}
