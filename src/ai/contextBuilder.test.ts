import { describe, it, expect } from 'vitest';
import { buildContextMarkdown, estimateTokens } from './contextBuilder';
import type { AIContext } from './contextBuilder';
import type { Scene } from '../types/scene';
import type { Character } from '../types/character';

function makeScene(id: string, location: string, summary?: string): Scene {
  return {
    id,
    version: 1,
    header: { interior: 'INT', location, timeOfDay: 'DAY' },
    meta: { summary: summary ?? '', emotionalTone: [], tensionLevel: 5, estimatedMinutes: 2, tags: [] },
    blocks: [
      { type: 'action', text: '문이 열린다.' },
      { type: 'character', characterId: '주인공', voiceType: 'normal' },
      { type: 'dialogue', text: '여기가 어디야?' },
    ],
    characters: ['주인공'],
  };
}

function makeCharacter(id: string, name: string, overrides?: Partial<Character>): Character {
  return {
    id,
    version: 1,
    name,
    description: `${name} 설명`,
    personality: { traits: ['용감함'], speechStyle: '직설적', speechTaboos: '비속어' },
    drama: { goal: '목표', need: '필요', flaw: '결점', lie: '믿음', ghost: '트라우마', arc: '아크', stakes: '위험' },
    relationships: [],
    color: '#6B7280',
    ...overrides,
  };
}

const baseCtx: AIContext = {
  project: { title: '테스트 영화', logline: '테스트 로그라인', genre: ['드라마'] },
  currentScene: makeScene('s001', '서울 강남'),
  characters: [],
  totalTokens: 0,
};

describe('buildContextMarkdown', () => {
  it('includes project title and logline', () => {
    const md = buildContextMarkdown(baseCtx);
    expect(md).toContain('# 프로젝트: 테스트 영화');
    expect(md).toContain('테스트 로그라인');
  });

  it('includes genre', () => {
    const md = buildContextMarkdown(baseCtx);
    expect(md).toContain('드라마');
  });

  it('includes current scene header', () => {
    const md = buildContextMarkdown(baseCtx);
    expect(md).toContain('서울 강남');
    expect(md).toContain('DAY');
  });

  it('includes scene blocks as formatted text', () => {
    const md = buildContextMarkdown(baseCtx);
    expect(md).toContain('문이 열린다.');
    expect(md).toContain('여기가 어디야?');
  });

  it('includes character block in bold', () => {
    const md = buildContextMarkdown(baseCtx);
    expect(md).toContain('**주인공**');
  });

  it('includes character info when provided', () => {
    const char = makeCharacter('c1', '김민준');
    const md = buildContextMarkdown({ ...baseCtx, characters: [char] });
    expect(md).toContain('## 등장인물');
    expect(md).toContain('김민준');
    expect(md).toContain('직설적');
    expect(md).toContain('비속어');
  });

  it('includes drama fields for characters', () => {
    const char = makeCharacter('c1', '이수지', { drama: { goal: '생존', need: '사랑', flaw: '두려움', lie: '강하다', ghost: '부모', arc: '성장', stakes: '죽음' } });
    const md = buildContextMarkdown({ ...baseCtx, characters: [char] });
    expect(md).toContain('생존');
    expect(md).toContain('두려움');
  });

  it('includes prevScene summary', () => {
    const prev = makeScene('s000', '부산', '주인공이 도착하는 씬');
    const md = buildContextMarkdown({ ...baseCtx, prevScene: prev });
    expect(md).toContain('## 직전 씬 (요약)');
    expect(md).toContain('주인공이 도착하는 씬');
  });

  it('includes nextScene summary', () => {
    const next = makeScene('s002', '인천', '탈출 씬');
    const md = buildContextMarkdown({ ...baseCtx, nextScene: next });
    expect(md).toContain('## 다음 씬 (요약)');
    expect(md).toContain('탈출 씬');
  });

  it('omits prevScene section when not provided', () => {
    const md = buildContextMarkdown(baseCtx);
    expect(md).not.toContain('## 직전 씬');
  });

  it('omits nextScene section when not provided', () => {
    const md = buildContextMarkdown(baseCtx);
    expect(md).not.toContain('## 다음 씬');
  });

  it('includes foreshadowing items', () => {
    const md = buildContextMarkdown({
      ...baseCtx,
      foreshadowing: [{
        id: 'fs1',
        type: 'foreshadowing',
        importance: 'major',
        status: 'planted',
        plantedIn: { scene: 's001', blockIndex: 0, description: '빨간 열쇠' },
        payoff: null,
      }],
    });
    expect(md).toContain('## 관련 복선');
    expect(md).toContain('빨간 열쇠');
    expect(md).toContain('⬜ 미회수');
  });

  it('marks resolved foreshadowing correctly', () => {
    const md = buildContextMarkdown({
      ...baseCtx,
      foreshadowing: [{
        id: 'fs2',
        type: 'foreshadowing',
        importance: 'minor',
        status: 'resolved',
        plantedIn: { scene: 's001', blockIndex: 0, description: '신비한 편지' },
        payoff: { scene: 's010', blockIndex: 0, description: '편지 회수', strength: 'strong' },
      }],
    });
    expect(md).toContain('✅ 회수됨');
    expect(md).toContain('편지 회수');
  });
});

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('estimates Korean text at ~1 token per 1.5 chars', () => {
    const text = '안녕하세요'; // 5 Korean chars → ceil(5/1.5) = 4
    expect(estimateTokens(text)).toBe(4);
  });

  it('estimates English text at ~1 token per 4 chars', () => {
    const text = 'Hello'; // 5 ascii → ceil(5/4) = 2
    expect(estimateTokens(text)).toBe(2);
  });

  it('handles mixed Korean and English', () => {
    // '안녕 Hello': 2 Korean + 6 other → ceil(2/1.5 + 6/4) = ceil(1.33 + 1.5) = ceil(2.83) = 3
    const text = '안녕 Hello';
    expect(estimateTokens(text)).toBe(3);
  });
});
