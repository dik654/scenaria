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

// ── HTML for PDF print ────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderScreenplayHTML(
  scenes: { scene: Scene; number: number }[],
  title: string,
  characters: Record<string, Character>
): string {
  const timeMap: Record<string, string> = {
    DAY: '낮', NIGHT: '밤', DAWN: '새벽', DUSK: '황혼', CONTINUOUS: '연속',
  };

  const sceneHtml = scenes.map(({ scene, number }) => {
    const { interior, location, locationDetail, timeOfDay, timeLabel } = scene.header;
    const intExt = interior ?? '';
    const loc = locationDetail ? `${location} / ${locationDetail}` : location;

    const headerHtml = `<div class="scene-header">S#${number}. ${intExt ? `[${escapeHtml(intExt)}] ` : ''}${escapeHtml(loc)} - ${timeMap[timeOfDay] ?? timeOfDay}${timeLabel ? ` (${escapeHtml(timeLabel)})` : ''}</div>`;

    const blocksHtml = scene.blocks.map(block => {
      switch (block.type) {
        case 'action':
          return `<div class="action">${escapeHtml(block.text)}</div>`;
        case 'character': {
          const char = characters[block.characterId];
          const name = char ? char.name : block.characterId;
          const voice = block.voiceType !== 'normal' ? ` (${block.voiceType})` : '';
          return `<div class="character">${escapeHtml(name)}${voice}</div>`;
        }
        case 'parenthetical':
          return `<div class="parenthetical">(${escapeHtml(block.text)})</div>`;
        case 'dialogue':
          return `<div class="dialogue">${escapeHtml(block.text)}</div>`;
        case 'transition':
          return `<div class="transition">${escapeHtml(block.transitionType)}</div>`;
        default:
          return '';
      }
    }).join('\n');

    return `<div class="scene">${headerHtml}\n${blocksHtml}</div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4; margin: 2.5cm 2cm; }
body { font-family: 'Nanum Myeongjo', 'Batang', serif; font-size: 12pt; line-height: 1.6; color: #000; }
.title-page { text-align: center; page-break-after: always; padding-top: 40%; }
.title-page h1 { font-size: 24pt; margin-bottom: 1em; }
.scene { page-break-inside: avoid; margin-bottom: 1.5em; }
.scene-header { font-weight: bold; margin-bottom: 0.5em; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 0.3em; }
.action { margin: 0.5em 0; margin-left: 1.5em; }
.character { text-align: center; margin-top: 0.8em; font-weight: bold; }
.parenthetical { text-align: center; font-style: italic; color: #555; }
.dialogue { text-align: center; margin: 0.3em 4em 0.8em; }
.transition { text-align: right; margin: 0.5em 0; font-weight: bold; }
@media print { body { -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="title-page"><h1>${escapeHtml(title)}</h1><p>Scenaria</p></div>
${sceneHtml}
</body>
</html>`;
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
