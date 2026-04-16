import { useState, useRef, useCallback } from 'react';
import type { SceneBlock } from '../../types/scene';

function getBlockText(block: SceneBlock): string | null {
  if (block.type === 'action' || block.type === 'dialogue' || block.type === 'parenthetical') {
    return block.text;
  }
  return null;
}

function withTruncatedText(block: SceneBlock, len: number): SceneBlock {
  const text = getBlockText(block);
  if (text === null) return block;
  return { ...block, text: text.slice(0, len) } as SceneBlock;
}

const CHAR_INTERVAL = 20;        // ms per character
const BLOCK_PAUSE = 50;          // ms pause between blocks
const INSTANT_BLOCK_PAUSE = 100; // ms pause after non-text blocks

export function useTypewriterAnimation(
  onComplete: (blocks: SceneBlock[]) => void,
) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [displayBlocks, setDisplayBlocks] = useState<SceneBlock[]>([]);

  const targetRef = useRef<SceneBlock[]>([]);
  const blockIdxRef = useRef(0);
  const charIdxRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const finish = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const final = targetRef.current;
    setDisplayBlocks(final);
    setIsAnimating(false);
    onCompleteRef.current(final);
  }, []);

  const tick = useCallback(() => {
    const target = targetRef.current;
    const bi = blockIdxRef.current;

    if (bi >= target.length) {
      finish();
      return;
    }

    const block = target[bi];
    const text = getBlockText(block);

    if (text === null) {
      // Non-text block (character, transition) — show instantly
      const completed = target.slice(0, bi + 1);
      setDisplayBlocks(completed);
      blockIdxRef.current = bi + 1;
      charIdxRef.current = 0;
      timerRef.current = setTimeout(tick, INSTANT_BLOCK_PAUSE);
      return;
    }

    const ci = charIdxRef.current;

    if (ci >= text.length) {
      // Current text block done — move to next
      blockIdxRef.current = bi + 1;
      charIdxRef.current = 0;
      timerRef.current = setTimeout(tick, BLOCK_PAUSE);
      return;
    }

    // Type one character
    charIdxRef.current = ci + 1;
    const completedBlocks = target.slice(0, bi);
    const partial = withTruncatedText(block, ci + 1);
    setDisplayBlocks([...completedBlocks, partial]);

    timerRef.current = setTimeout(tick, CHAR_INTERVAL);
  }, [finish]);

  const start = useCallback((blocks: SceneBlock[]) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    targetRef.current = blocks;
    blockIdxRef.current = 0;
    charIdxRef.current = 0;
    setDisplayBlocks([]);
    setIsAnimating(true);
    timerRef.current = setTimeout(tick, BLOCK_PAUSE);
  }, [tick]);

  const skip = useCallback(() => {
    finish();
  }, [finish]);

  return { isAnimating, displayBlocks, start, skip };
}
