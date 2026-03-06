import { describe, it, expect } from 'vitest';
import { getNextBlockType, createEmptyBlock, isBlockEmpty } from './renderBlock';
import type { SceneBlock } from '../../types/scene';

describe('createEmptyBlock', () => {
  it('creates action block', () => {
    const b = createEmptyBlock('action');
    expect(b.type).toBe('action');
    expect((b as Extract<SceneBlock, { type: 'action' }>).text).toBe('');
  });

  it('creates character block with empty characterId', () => {
    const b = createEmptyBlock('character');
    expect(b.type).toBe('character');
    expect((b as Extract<SceneBlock, { type: 'character' }>).characterId).toBe('');
    expect((b as Extract<SceneBlock, { type: 'character' }>).voiceType).toBe('normal');
  });

  it('creates dialogue block', () => {
    const b = createEmptyBlock('dialogue');
    expect(b.type).toBe('dialogue');
    expect((b as Extract<SceneBlock, { type: 'dialogue' }>).text).toBe('');
  });

  it('creates parenthetical block', () => {
    const b = createEmptyBlock('parenthetical');
    expect(b.type).toBe('parenthetical');
  });

  it('creates transition block with default CUT TO:', () => {
    const b = createEmptyBlock('transition');
    expect(b.type).toBe('transition');
    expect((b as Extract<SceneBlock, { type: 'transition' }>).transitionType).toBe('CUT TO:');
  });
});

describe('isBlockEmpty', () => {
  it('action with empty text is empty', () => {
    expect(isBlockEmpty({ type: 'action', text: '' })).toBe(true);
    expect(isBlockEmpty({ type: 'action', text: '  ' })).toBe(true);
  });

  it('action with text is not empty', () => {
    expect(isBlockEmpty({ type: 'action', text: 'Hello' })).toBe(false);
  });

  it('dialogue with empty text is empty', () => {
    expect(isBlockEmpty({ type: 'dialogue', text: '' })).toBe(true);
  });

  it('character with empty characterId is empty', () => {
    expect(isBlockEmpty({ type: 'character', characterId: '', voiceType: 'normal' })).toBe(true);
  });

  it('character with characterId is not empty', () => {
    expect(isBlockEmpty({ type: 'character', characterId: 'hero', voiceType: 'normal' })).toBe(false);
  });

  it('transition is never empty', () => {
    expect(isBlockEmpty({ type: 'transition', transitionType: 'CUT TO:' })).toBe(false);
  });
});

describe('getNextBlockType', () => {
  const blocks: SceneBlock[] = [
    { type: 'action', text: 'action' },
    { type: 'character', characterId: 'hero', voiceType: 'normal' },
    { type: 'dialogue', text: 'line' },
  ];

  it('character → dialogue', () => {
    expect(getNextBlockType({ type: 'character', characterId: 'x', voiceType: 'normal' }, blocks, 1)).toBe('dialogue');
  });

  it('dialogue → action', () => {
    expect(getNextBlockType({ type: 'dialogue', text: '' }, blocks, 2)).toBe('action');
  });

  it('parenthetical → dialogue', () => {
    expect(getNextBlockType({ type: 'parenthetical', text: '' }, blocks, 0)).toBe('dialogue');
  });

  it('action → character', () => {
    expect(getNextBlockType({ type: 'action', text: '' }, blocks, 0)).toBe('character');
  });

  it('transition → action', () => {
    expect(getNextBlockType({ type: 'transition', transitionType: 'CUT TO:' }, blocks, 0)).toBe('action');
  });
});
