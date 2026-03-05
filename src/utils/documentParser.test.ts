import { describe, it, expect } from 'vitest';
import { parseFountainToScenes, estimateRuntime } from './documentParser';
import type { Scene, CharacterBlock, DialogueBlock, ActionBlock } from '../types/scene';

describe('parseFountainToScenes', () => {
  it('returns empty array for blank input', () => {
    expect(parseFountainToScenes('')).toEqual([]);
    expect(parseFountainToScenes('   \n\n  ')).toEqual([]);
  });

  it('parses a single INT scene heading', () => {
    const text = 'INT. 거실 - DAY\n\n주인공이 앉아있다.';
    const scenes = parseFountainToScenes(text);
    expect(scenes).toHaveLength(1);
    expect(scenes[0].header?.interior).toBe('INT');
    expect(scenes[0].header?.location).toBe('거실');
    expect(scenes[0].header?.timeOfDay).toBe('DAY');
  });

  it('parses EXT heading', () => {
    const text = 'EXT. 공원 - NIGHT';
    const [scene] = parseFountainToScenes(text);
    expect(scene.header?.interior).toBe('EXT');
    expect(scene.header?.timeOfDay).toBe('NIGHT');
  });

  it('parses multiple scenes', () => {
    const text = [
      'INT. 사무실 - DAY',
      '',
      '업무 중이다.',
      '',
      'EXT. 주차장 - NIGHT',
      '',
      '차가 달려온다.',
    ].join('\n');
    const scenes = parseFountainToScenes(text);
    expect(scenes).toHaveLength(2);
    expect(scenes[0].header?.location).toBe('사무실');
    expect(scenes[1].header?.location).toBe('주차장');
  });

  it('creates action blocks from plain paragraphs', () => {
    const text = 'INT. 방 - DAY\n\n문이 열린다.\n\n바람이 불어온다.';
    const [scene] = parseFountainToScenes(text);
    const actions = scene.blocks?.filter(b => b.type === 'action') ?? [];
    expect(actions.length).toBeGreaterThanOrEqual(1);
    expect((actions[0] as ActionBlock).text).toContain('문이 열린다.');
  });

  it('parses character + dialogue pair', () => {
    const text = [
      'INT. 거실 - DAY',
      '',
      'HERO',
      '',
      '안녕하세요.',
    ].join('\n');
    const [scene] = parseFountainToScenes(text);
    const char = scene.blocks?.find(b => b.type === 'character') as CharacterBlock | undefined;
    const dial = scene.blocks?.find(b => b.type === 'dialogue') as DialogueBlock | undefined;
    expect(char).toBeDefined();
    expect(char?.characterId).toBe('hero');
    expect(dial?.text).toContain('안녕하세요.');
  });

  it('parses parenthetical block', () => {
    const text = [
      'INT. 거실 - DAY',
      '',
      'HERO',
      '',
      '(분노하며)',
      '',
      '당신이 틀렸어!',
    ].join('\n');
    const [scene] = parseFountainToScenes(text);
    expect(scene.blocks?.some(b => b.type === 'parenthetical')).toBe(true);
  });

  it('parses transition block', () => {
    const text = 'INT. 거실 - DAY\n\n액션.\n\nCUT TO:\n\nINT. 부엌 - DAY\n\n다른 액션.';
    const scenes = parseFountainToScenes(text);
    const allBlocks = scenes.flatMap(s => s.blocks ?? []);
    expect(allBlocks.some(b => b.type === 'transition')).toBe(true);
  });

  it('strips fountain boneyards (/* ... */)', () => {
    const text = 'INT. 거실 - DAY\n\n/* 이 부분은 제거됩니다 */\n\n액션.';
    const [scene] = parseFountainToScenes(text);
    const actionText = (scene.blocks?.find(b => b.type === 'action') as ActionBlock | undefined)?.text ?? '';
    expect(actionText).not.toContain('제거됩니다');
  });

  it('assigns sequential scene IDs', () => {
    const text = 'INT. A - DAY\n\naction.\n\nINT. B - DAY\n\naction.';
    const scenes = parseFountainToScenes(text);
    expect(scenes[0].id).toBe('s001');
    expect(scenes[1].id).toBe('s002');
  });

  it('adds characters to scene.characters list', () => {
    const text = 'INT. 거실 - DAY\n\nHERO\n\n대사.\n\nVILLAIN\n\n다른 대사.';
    const [scene] = parseFountainToScenes(text);
    expect(scene.characters).toContain('hero');
    expect(scene.characters).toContain('villain');
  });
});

describe('estimateRuntime', () => {
  it('returns 0 for empty blocks', () => {
    const scene = {
      id: 's001', version: 1,
      header: { interior: 'INT' as const, location: '', timeOfDay: 'DAY' as const },
      meta: { summary: '', emotionalTone: [], tensionLevel: 5, estimatedMinutes: 0, tags: [] },
      blocks: [],
      characters: [],
    } satisfies Scene;
    expect(estimateRuntime(scene)).toBe(0);
  });

  it('dialogue contributes more per character than action', () => {
    const withDialogue = {
      id: 's001', version: 1,
      header: { interior: 'INT' as const, location: '', timeOfDay: 'DAY' as const },
      meta: { summary: '', emotionalTone: [], tensionLevel: 5, estimatedMinutes: 0, tags: [] },
      blocks: [{ type: 'dialogue' as const, text: 'x'.repeat(100) }],
      characters: [],
    } satisfies Scene;
    const withAction = {
      ...withDialogue,
      blocks: [{ type: 'action' as const, text: 'x'.repeat(100) }],
    };
    expect(estimateRuntime(withDialogue)).toBeGreaterThan(estimateRuntime(withAction));
  });
});
