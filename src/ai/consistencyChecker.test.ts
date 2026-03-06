import { describe, it, expect } from 'vitest';
import {
  checkSceneTimeContradictions,
  checkCharacterLocationContradictions,
  checkUnresolvedForeshadowing,
} from './consistencyChecker';
import type { Scene } from '../types/scene';
import type { ForeshadowingIndex } from '../types/story';

function makeScene(id: string, overrides: Partial<Scene> = {}): Scene {
  return {
    id,
    version: 1,
    header: { interior: 'INT', location: '거실', timeOfDay: 'DAY' },
    meta: { summary: '', emotionalTone: [], tensionLevel: 5, estimatedMinutes: 2, tags: [] },
    blocks: [],
    characters: [],
    ...overrides,
  };
}

describe('checkSceneTimeContradictions', () => {
  it('returns no issues for normal scenes', () => {
    const scenes = [
      makeScene('s001', { meta: { summary: '', emotionalTone: [], tensionLevel: 5, estimatedMinutes: 3, tags: [] } }),
      makeScene('s002', { meta: { summary: '', emotionalTone: [], tensionLevel: 5, estimatedMinutes: 5, tags: [] } }),
    ];
    expect(checkSceneTimeContradictions(scenes)).toHaveLength(0);
  });

  it('flags scenes with estimatedMinutes > 15', () => {
    const scenes = [
      makeScene('s001', { meta: { summary: '', emotionalTone: [], tensionLevel: 5, estimatedMinutes: 20, tags: [] } }),
    ];
    const issues = checkSceneTimeContradictions(scenes);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('time_contradiction');
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].scenes).toContain('s001');
  });

  it('returns empty array for empty scene list', () => {
    expect(checkSceneTimeContradictions([])).toEqual([]);
  });

  it('only flags the offending scenes, not normal ones', () => {
    const scenes = [
      makeScene('s001', { meta: { summary: '', emotionalTone: [], tensionLevel: 5, estimatedMinutes: 5, tags: [] } }),
      makeScene('s002', { meta: { summary: '', emotionalTone: [], tensionLevel: 5, estimatedMinutes: 30, tags: [] } }),
      makeScene('s003', { meta: { summary: '', emotionalTone: [], tensionLevel: 5, estimatedMinutes: 2, tags: [] } }),
    ];
    const issues = checkSceneTimeContradictions(scenes);
    expect(issues).toHaveLength(1);
    expect(issues[0].scenes).toContain('s002');
  });
});

describe('checkCharacterLocationContradictions', () => {
  it('returns no issues for scenes without CONTINUOUS', () => {
    const scenes = [
      makeScene('s001', { header: { interior: 'INT', location: '거실', timeOfDay: 'DAY' }, characters: ['hero'] }),
      makeScene('s002', { header: { interior: 'EXT', location: '공원', timeOfDay: 'DAY' }, characters: ['hero'] }),
    ];
    expect(checkCharacterLocationContradictions(scenes)).toHaveLength(0);
  });

  it('flags shared character across CONTINUOUS scenes with different locations', () => {
    const scenes = [
      makeScene('s001', { header: { interior: 'INT', location: '거실', timeOfDay: 'DAY' }, characters: ['hero'] }),
      makeScene('s002', { header: { interior: 'EXT', location: '공원', timeOfDay: 'CONTINUOUS' }, characters: ['hero'] }),
    ];
    const issues = checkCharacterLocationContradictions(scenes);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('location_contradiction');
    expect(issues[0].severity).toBe('info');
    expect(issues[0].characters).toContain('hero');
  });

  it('does not flag CONTINUOUS scenes with the same location', () => {
    const scenes = [
      makeScene('s001', { header: { interior: 'INT', location: '거실', timeOfDay: 'DAY' }, characters: ['hero'] }),
      makeScene('s002', { header: { interior: 'INT', location: '거실', timeOfDay: 'CONTINUOUS' }, characters: ['hero'] }),
    ];
    expect(checkCharacterLocationContradictions(scenes)).toHaveLength(0);
  });

  it('does not flag CONTINUOUS scenes with no shared characters', () => {
    const scenes = [
      makeScene('s001', { header: { interior: 'INT', location: '거실', timeOfDay: 'DAY' }, characters: ['hero'] }),
      makeScene('s002', { header: { interior: 'EXT', location: '공원', timeOfDay: 'CONTINUOUS' }, characters: ['villain'] }),
    ];
    expect(checkCharacterLocationContradictions(scenes)).toHaveLength(0);
  });

  it('returns empty for empty or single-scene list', () => {
    expect(checkCharacterLocationContradictions([])).toEqual([]);
    expect(checkCharacterLocationContradictions([makeScene('s001')])).toEqual([]);
  });
});

describe('checkUnresolvedForeshadowing', () => {
  const foreshadowing: ForeshadowingIndex = {
    items: [
      {
        id: 'fs001',
        type: 'foreshadowing',
        status: 'planted',
        importance: 'major',
        plantedIn: { scene: 's001', blockIndex: 0, description: '빨간 신발' },
        payoff: null,
      },
      {
        id: 'fs002',
        type: 'foreshadowing',
        status: 'resolved',
        importance: 'minor',
        plantedIn: { scene: 's002', blockIndex: 0, description: '열쇠' },
        payoff: { scene: 's010', blockIndex: 0, description: '열쇠 사용', strength: 'strong' },
      },
    ],
  };

  it('flags planted-but-unresolved items', () => {
    const issues = checkUnresolvedForeshadowing(foreshadowing, []);
    expect(issues).toHaveLength(1);
    expect(issues[0].linkedForeshadowing).toBe('fs001');
    expect(issues[0].type).toBe('unresolved_foreshadowing');
  });

  it('does not flag resolved items', () => {
    const issues = checkUnresolvedForeshadowing(foreshadowing, []);
    expect(issues.every(i => i.linkedForeshadowing !== 'fs002')).toBe(true);
  });

  it('major importance → error severity', () => {
    const issues = checkUnresolvedForeshadowing(foreshadowing, []);
    expect(issues[0].severity).toBe('error');
  });

  it('minor importance → warning severity', () => {
    const minor: ForeshadowingIndex = {
      items: [{
        id: 'fs003',
        type: 'foreshadowing',
        status: 'planted',
        importance: 'minor',
        plantedIn: { scene: 's001', blockIndex: 0, description: '사소한 힌트' },
        payoff: null,
      }],
    };
    const issues = checkUnresolvedForeshadowing(minor, []);
    expect(issues[0].severity).toBe('warning');
  });

  it('skips items already in existingIssues', () => {
    const existing = [{ linkedForeshadowing: 'fs001', id: 'x', type: 'unresolved_foreshadowing' as const, severity: 'error' as const, description: '', status: 'open' as const }];
    const issues = checkUnresolvedForeshadowing(foreshadowing, existing);
    expect(issues).toHaveLength(0);
  });

  it('returns empty for empty foreshadowing index', () => {
    expect(checkUnresolvedForeshadowing({ items: [] }, [])).toEqual([]);
  });
});
