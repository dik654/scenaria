import type { Scene, SceneBlock } from '../types/scene';
import type { Character } from '../types/character';

/**
 * Renders scenes to various output formats.
 */

// ── Fountain (international plain text format) ─────────────────────────────

export function sceneToFountain(scene: Scene, characters: Record<string, Character>): string {
  const lines: string[] = [];
  const { interior, location, locationDetail, timeOfDay, timeLabel } = scene.header;

  const intExt = interior ?? '';
  const loc = locationDetail ? `${location} - ${locationDetail}` : location;
  const time = timeOfDay;
  lines.push(`${intExt}. ${loc} - ${time}${timeLabel ? ` (${timeLabel})` : ''}`);
  lines.push('');

  for (const block of scene.blocks) {
    switch (block.type) {
      case 'action':
        lines.push(block.text);
        lines.push('');
        break;
      case 'character': {
        const char = characters[block.characterId];
        const name = char ? char.name.toUpperCase() : block.characterId.toUpperCase();
        const voice = block.voiceType !== 'normal' ? ` (${block.voiceType})` : '';
        lines.push(name + voice);
        break;
      }
      case 'parenthetical':
        lines.push(`(${block.text})`);
        break;
      case 'dialogue':
        lines.push(block.text);
        lines.push('');
        break;
      case 'transition':
        lines.push(`> ${block.transitionType}`);
        lines.push('');
        break;
    }
  }

  return lines.join('\n');
}

// ── Korean plain text ──────────────────────────────────────────────────────

export function sceneToKoreanText(
  scene: Scene,
  sceneNumber: number,
  characters: Record<string, Character>
): string {
  const lines: string[] = [];
  const { interior, location, locationDetail, timeOfDay, timeLabel } = scene.header;

  const intExt = interior ?? '';
  const loc = locationDetail ? `${location} / ${locationDetail}` : location;
  const timeMap: Record<string, string> = {
    DAY: '낮', NIGHT: '밤', DAWN: '새벽', DUSK: '황혼', CONTINUOUS: '연속',
  };

  lines.push(`S#${sceneNumber}. ${intExt ? `[${intExt}] ` : ''}${loc} - ${timeMap[timeOfDay] ?? timeOfDay}${timeLabel ? ` (${timeLabel})` : ''}`);
  lines.push('');

  let lastCharName = '';
  for (const block of scene.blocks) {
    switch (block.type) {
      case 'action':
        lines.push(`    ${block.text}`);
        lines.push('');
        break;
      case 'character': {
        const char = characters[block.characterId];
        lastCharName = char ? char.name : block.characterId;
        const voice = block.voiceType !== 'normal' ? ` (${block.voiceType})` : '';
        lines.push(`                    ${lastCharName}${voice}`);
        break;
      }
      case 'parenthetical':
        lines.push(`               (${block.text})`);
        break;
      case 'dialogue':
        lines.push(`        ${block.text}`);
        lines.push('');
        break;
      case 'transition':
        lines.push(`                                    ${block.transitionType}`);
        lines.push('');
        break;
    }
  }

  return lines.join('\n');
}

// ── Full screenplay TXT ────────────────────────────────────────────────────

export function renderFullScreenplayTXT(
  scenes: { scene: Scene; number: number }[],
  title: string,
  characters: Record<string, Character>
): string {
  const header = [
    title.toUpperCase(),
    '',
    'Written with Scenaria',
    '',
    '='.repeat(60),
    '',
    '',
  ];

  const body = scenes.flatMap(({ scene, number }) => [
    sceneToKoreanText(scene, number, characters),
    '',
    '',
  ]);

  return [...header, ...body].join('\n');
}

// ── LLM context clipboard ──────────────────────────────────────────────────

export function buildLLMContextText(
  scenes: Scene[],
  characters: Character[],
  projectTitle: string,
  logline: string
): string {
  const lines = [
    `# ${projectTitle}`,
    logline ? `로그라인: ${logline}` : '',
    '',
    '## 캐릭터',
    ...characters.map(c =>
      `- **${c.name}**: ${c.description}${c.personality.speechStyle ? ` / 말투: ${c.personality.speechStyle}` : ''}`
    ),
    '',
    '## 씬',
    ...scenes.flatMap(s => {
      const charMap = Object.fromEntries(characters.map(c => [c.id, c]));
      return [sceneToFountain(s, charMap), ''];
    }),
  ];

  return lines.filter(Boolean).join('\n');
}
