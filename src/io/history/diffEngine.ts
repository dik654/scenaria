import type { DiffResult, DiffHunk } from './types';

/**
 * Compares two JSON-serializable objects and returns a list of changed paths.
 * Simple recursive diffing — for screenplay blocks we compare block arrays.
 */
export function diffObjects(
  a: unknown,
  b: unknown,
  path = ''
): string[] {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];

  if (
    typeof a !== 'object' || typeof b !== 'object' ||
    a === null || b === null ||
    Array.isArray(a) !== Array.isArray(b)
  ) {
    return [path || 'root'];
  }

  const changed: string[] = [];

  if (Array.isArray(a) && Array.isArray(b)) {
    const maxLen = Math.max(a.length, b.length);
    for (let i = 0; i < maxLen; i++) {
      changed.push(...diffObjects(a[i], b[i], `${path}[${i}]`));
    }
    return changed;
  }

  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(objA), ...Object.keys(objB)]);
  for (const key of keys) {
    const sub = diffObjects(objA[key], objB[key], path ? `${path}.${key}` : key);
    changed.push(...sub);
  }
  return changed;
}

export function buildDiffResult(
  saveIdA: string,
  saveIdB: string,
  snapshotA: Record<string, string>,
  snapshotB: Record<string, string>
): DiffResult {
  const allPaths = new Set([...Object.keys(snapshotA), ...Object.keys(snapshotB)]);
  const hunks: DiffHunk[] = [];

  for (const path of allPaths) {
    const oldContent = snapshotA[path] ?? null;
    const newContent = snapshotB[path] ?? null;
    if (oldContent !== newContent) {
      hunks.push({ path, oldContent, newContent });
    }
  }

  return { saveIdA, saveIdB, hunks };
}
