import { useRef, useCallback, useMemo } from 'react';
import type { Scene } from '../../types/scene';

const MAX_HISTORY = 80;

export function useSceneHistory() {
  const undoStack = useRef<Scene[]>([]);
  const redoStack = useRef<Scene[]>([]);

  const push = useCallback((scene: Scene) => {
    undoStack.current.push(scene);
    if (undoStack.current.length > MAX_HISTORY) {
      undoStack.current.shift();
    }
    // 새 변경이 있으면 redo 스택 클리어
    redoStack.current = [];
  }, []);

  const undo = useCallback((currentScene: Scene): Scene | null => {
    if (undoStack.current.length === 0) return null;
    const prev = undoStack.current.pop()!;
    redoStack.current.push(currentScene);
    return prev;
  }, []);

  const redo = useCallback((currentScene: Scene): Scene | null => {
    if (redoStack.current.length === 0) return null;
    const next = redoStack.current.pop()!;
    undoStack.current.push(currentScene);
    return next;
  }, []);

  const clear = useCallback(() => {
    undoStack.current = [];
    redoStack.current = [];
  }, []);

  const canUndo = useCallback(() => undoStack.current.length > 0, []);
  const canRedo = useCallback(() => redoStack.current.length > 0, []);

  return useMemo(() => ({ push, undo, redo, clear, canUndo, canRedo }), [push, undo, redo, clear, canUndo, canRedo]);
}
