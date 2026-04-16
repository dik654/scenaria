import type { Scene } from '../types/scene';
import type { Character } from '../types/character';
import type { ProjectMeta } from '../types/project';
import type { ForeshadowingItem } from '../types/story';

export interface AIContext {
  project: { title: string; logline: string; genre: string[] };
  currentScene: Scene;
  prevScene?: Partial<Scene>;
  nextScene?: Partial<Scene>;
  characters: Character[];
  foreshadowing?: ForeshadowingItem[];
  plotThreads?: { name: string; description: string }[];
  totalTokens: number;
}

/**
 * Builds the LLM context for a given scene modification request.
 * Assembles: current scene + adjacent scenes (summary only) + relevant characters + foreshadowing.
 * Respects a token budget (approximate: 1 token ≈ 2 Korean chars / 4 English chars).
 */
export function buildContextMarkdown(ctx: AIContext): string {
  const lines: string[] = [];

  // Project meta
  lines.push(`# 프로젝트: ${ctx.project.title}`);
  if (ctx.project.logline) lines.push(`**로그라인**: ${ctx.project.logline}`);
  if (ctx.project.genre.length) lines.push(`**장르**: ${ctx.project.genre.join(', ')}`);
  lines.push('');

  // Characters
  if (ctx.characters.length > 0) {
    lines.push('## 등장인물');
    for (const char of ctx.characters) {
      lines.push(`### ${char.name}${char.alias ? ` (${char.alias})` : ''} ${char.ageDescription ?? ''}`);
      lines.push(char.description);
      if (char.personality.speechStyle) {
        lines.push(`**말투**: ${char.personality.speechStyle}`);
      }
      if (char.personality.speechTaboos) {
        lines.push(`**금지 표현**: ${char.personality.speechTaboos}`);
      }
      if (char.drama.goal) lines.push(`**목표**: ${char.drama.goal}`);
      if (char.drama.flaw) lines.push(`**결점**: ${char.drama.flaw}`);
      lines.push('');
    }
  }

  // Previous scene (summary)
  if (ctx.prevScene) {
    lines.push('## 직전 씬 (요약)');
    lines.push(ctx.prevScene.meta?.summary ?? '(요약 없음)');
    lines.push('');
  }

  // Current scene (full)
  lines.push(`## 현재 씬: S#${ctx.currentScene.id}`);
  const h = ctx.currentScene.header;
  lines.push(`**장소**: ${h.interior ? h.interior + '. ' : ''}${h.location}${h.locationDetail ? ' / ' + h.locationDetail : ''}`);
  lines.push(`**시간**: ${h.timeOfDay}${h.timeLabel ? ' (' + h.timeLabel + ')' : ''}`);
  lines.push('');

  for (const block of ctx.currentScene.blocks) {
    switch (block.type) {
      case 'action':
        lines.push(block.text);
        break;
      case 'character':
        lines.push(`\n**${block.characterId.toUpperCase()}${block.voiceType !== 'normal' ? ' (' + block.voiceType + ')' : ''}**`);
        break;
      case 'parenthetical':
        lines.push(`*(${block.text})*`);
        break;
      case 'dialogue':
        lines.push(`> ${block.text}`);
        break;
      case 'transition':
        lines.push(`\n---\n*${block.transitionType}*\n`);
        break;
    }
  }
  lines.push('');

  // Next scene (summary)
  if (ctx.nextScene) {
    lines.push('## 다음 씬 (요약)');
    lines.push(ctx.nextScene.meta?.summary ?? '(요약 없음)');
    lines.push('');
  }

  // Plot threads
  if (ctx.plotThreads && ctx.plotThreads.length > 0) {
    lines.push('## 활성 플롯 스레드');
    for (const t of ctx.plotThreads) {
      lines.push(`- **${t.name}**: ${t.description}`);
    }
    lines.push('');
  }

  // Foreshadowing
  if (ctx.foreshadowing && ctx.foreshadowing.length > 0) {
    lines.push('## 관련 복선');
    for (const fs of ctx.foreshadowing) {
      const status = fs.status === 'planted' ? '⬜ 미회수' : fs.status === 'resolved' ? '✅ 회수됨' : '❌ 포기';
      lines.push(`- ${status} [${fs.id}]: ${fs.plantedIn.description}`);
      if (fs.payoff) lines.push(`  → 회수: ${fs.payoff.description} (강도: ${fs.payoff.strength})`);
    }
  }

  return lines.join('\n');
}

/**
 * Rough token count estimate (Korean: 1 token ≈ 1.5 chars, English: 1 token ≈ 4 chars)
 */
export function estimateTokens(text: string): number {
  const korean = (text.match(/[\uAC00-\uD7AF]/g) ?? []).length;
  const other = text.length - korean;
  return Math.ceil(korean / 1.5 + other / 4);
}
