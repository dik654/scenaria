import { describe, it, expect } from 'vitest';
import { sceneToFountain, sceneToKoreanText } from './formatRenderer';
import type { Scene } from '../types/scene';
import type { Character } from '../types/character';

function makeScene(overrides: Partial<Scene> = {}): Scene {
  return {
    id: 's001',
    version: 1,
    header: {
      interior: 'INT',
      location: '사무실',
      timeOfDay: 'DAY',
    },
    meta: {
      summary: '',
      emotionalTone: [],
      tensionLevel: 5,
      estimatedMinutes: 2,
      tags: [],
    },
    blocks: [],
    characters: [],
    ...overrides,
  };
}

function makeCharacter(id: string, name: string): Character {
  return {
    id,
    version: 1,
    name,
    alias: '',
    description: '',
    occupation: '',
    personality: { traits: [], speechStyle: '' },
    drama: { goal: '', need: '', flaw: '', lie: '', ghost: '', arc: '', stakes: '' },
    relationships: [],
    color: '#6B7280',
  };
}

const charMap: Record<string, Character> = {
  hero: makeCharacter('hero', '영웅'),
};

describe('sceneToFountain', () => {
  it('writes the scene heading correctly', () => {
    const scene = makeScene();
    const out = sceneToFountain(scene, charMap);
    expect(out).toContain('INT. 사무실 - DAY');
  });

  it('writes EXT heading', () => {
    const scene = makeScene({ header: { interior: 'EXT', location: '공원', timeOfDay: 'NIGHT' } });
    const out = sceneToFountain(scene, charMap);
    expect(out).toContain('EXT. 공원 - NIGHT');
  });

  it('writes action blocks as plain text', () => {
    const scene = makeScene({ blocks: [{ type: 'action', text: '비가 내린다.' }] });
    expect(sceneToFountain(scene, charMap)).toContain('비가 내린다.');
  });

  it('writes character name in UPPERCASE using character map', () => {
    const scene = makeScene({ blocks: [{ type: 'character', characterId: 'hero', voiceType: 'normal' }] });
    expect(sceneToFountain(scene, charMap)).toContain('영웅');
  });

  it('writes character with voiceType suffix', () => {
    const scene = makeScene({ blocks: [{ type: 'character', characterId: 'hero', voiceType: 'V.O.' }] });
    expect(sceneToFountain(scene, charMap)).toContain('(V.O.)');
  });

  it('wraps parenthetical in parens', () => {
    const scene = makeScene({ blocks: [{ type: 'parenthetical', text: '분노하며' }] });
    expect(sceneToFountain(scene, charMap)).toContain('(분노하며)');
  });

  it('writes transition with > prefix', () => {
    const scene = makeScene({ blocks: [{ type: 'transition', transitionType: 'CUT TO:' }] });
    expect(sceneToFountain(scene, charMap)).toContain('> CUT TO:');
  });

  it('falls back to characterId when character not in map', () => {
    const scene = makeScene({ blocks: [{ type: 'character', characterId: 'unknown', voiceType: 'normal' }] });
    expect(sceneToFountain(scene, charMap)).toContain('UNKNOWN');
  });

  it('includes locationDetail when present', () => {
    const scene = makeScene({ header: { interior: 'INT', location: '학교', locationDetail: '교실', timeOfDay: 'DAY' } });
    expect(sceneToFountain(scene, charMap)).toContain('학교 - 교실');
  });
});

describe('sceneToKoreanText', () => {
  it('includes scene number in header', () => {
    const scene = makeScene();
    const out = sceneToKoreanText(scene, 3, charMap);
    expect(out).toContain('S#3.');
  });

  it('translates DAY to 낮', () => {
    const scene = makeScene();
    expect(sceneToKoreanText(scene, 1, charMap)).toContain('낮');
  });

  it('translates NIGHT to 밤', () => {
    const scene = makeScene({ header: { interior: 'EXT', location: '거리', timeOfDay: 'NIGHT' } });
    expect(sceneToKoreanText(scene, 1, charMap)).toContain('밤');
  });

  it('indents dialogue blocks', () => {
    const scene = makeScene({ blocks: [{ type: 'dialogue', text: '안녕하세요.' }] });
    const out = sceneToKoreanText(scene, 1, charMap);
    // Dialogue is indented with spaces
    expect(out).toMatch(/\s{4,}안녕하세요\./);
  });
});
