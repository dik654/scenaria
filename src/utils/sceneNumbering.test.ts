import { describe, it, expect } from 'vitest';
import { nextSceneId, renumberScenes } from './sceneNumbering';
import type { SceneIndexEntry } from '../types/scene';

const makeEntry = (id: string, number: number): SceneIndexEntry => ({
  id,
  filename: `${id}.json`,
  number,
  location: 'TEST',
  timeOfDay: 'DAY',
  interior: 'INT',
});

describe('nextSceneId', () => {
  it('returns s001 for empty index', () => {
    expect(nextSceneId([])).toBe('s001');
  });

  it('increments past highest scene number', () => {
    // nextSceneId uses the .number field, not the id string
    const index = [makeEntry('s001', 1), makeEntry('s003', 3)];
    expect(nextSceneId(index)).toBe('s004');
  });

  it('pads to 3 digits', () => {
    const index = Array.from({ length: 9 }, (_, i) => makeEntry(`s00${i + 1}`, i + 1));
    expect(nextSceneId(index)).toBe('s010');
  });
});

describe('renumberScenes', () => {
  it('assigns sequential 1-based numbers', () => {
    const index = [makeEntry('s003', 99), makeEntry('s001', 42), makeEntry('s002', 7)];
    const result = renumberScenes(index);
    expect(result.map(e => e.number)).toEqual([1, 2, 3]);
  });

  it('preserves all other fields', () => {
    const index = [makeEntry('s001', 5)];
    const result = renumberScenes(index);
    expect(result[0].id).toBe('s001');
    expect(result[0].location).toBe('TEST');
  });

  it('returns empty array for empty input', () => {
    expect(renumberScenes([])).toEqual([]);
  });
});
