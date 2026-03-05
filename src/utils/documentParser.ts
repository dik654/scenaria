import type { Scene, SceneBlock, ActionBlock, CharacterBlock, DialogueBlock, ParentheticalBlock, TransitionBlock } from '../types/scene';

/**
 * Converts a Scene JSON into a human-readable plain text screenplay format.
 */
export function sceneToPlainText(scene: Scene, characterNames?: Record<string, string>): string {
  const lines: string[] = [];

  // Header
  const { interior, location, locationDetail, timeOfDay, timeLabel } = scene.header;
  const loc = locationDetail ? `${location} / ${locationDetail}` : location;
  const intExt = interior ?? '';
  lines.push(`S#${scene.id}. ${intExt ? `${intExt}. ` : ''}${loc} - ${timeOfDay}${timeLabel ? ` (${timeLabel})` : ''}`);
  lines.push('');

  for (const block of scene.blocks) {
    switch (block.type) {
      case 'action':
        lines.push(block.text);
        lines.push('');
        break;
      case 'character': {
        const name = characterNames?.[block.characterId] ?? block.characterId;
        const voice = block.voiceType !== 'normal' ? ` (${block.voiceType})` : '';
        lines.push(`                    ${name}${voice}`);
        break;
      }
      case 'parenthetical':
        lines.push(`               (${block.text})`);
        break;
      case 'dialogue':
        lines.push(`          ${block.text}`);
        lines.push('');
        break;
      case 'transition':
        lines.push(`                                        ${block.transitionType}`);
        lines.push('');
        break;
    }
  }

  return lines.join('\n');
}

/**
 * Parses a minimal plain-text screenplay (Korean format) into a Scene.
 * This is a best-effort parser — not guaranteed to handle all edge cases.
 */
export function parsePlainTextToScene(text: string, sceneId: string): Partial<Scene> {
  const lines = text.split('\n');
  const blocks: SceneBlock[] = [];

  let i = 0;

  // Skip empty lines
  while (i < lines.length && !lines[i].trim()) i++;

  // Try to parse header
  const headerLine = lines[i] ?? '';
  const headerMatch = headerLine.match(/^(?:S#\d+\.\s+)?(?:(INT|EXT|INT\/EXT)\.\s+)?(.+?)\s+-\s+(DAY|NIGHT|DAWN|DUSK|CONTINUOUS)/i);

  const header = {
    interior: (headerMatch?.[1] as Scene['header']['interior']) ?? null,
    location: headerMatch?.[2] ?? headerLine,
    timeOfDay: (headerMatch?.[3]?.toUpperCase() as Scene['header']['timeOfDay']) ?? 'DAY',
  };

  i++;

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();
    i++;

    if (!trimmed) continue;

    // Transition (right-aligned keywords)
    if (/^(CUT TO|FADE|DISSOLVE|SMASH CUT|MATCH CUT)/i.test(trimmed)) {
      const block: TransitionBlock = { type: 'transition', transitionType: trimmed.toUpperCase() };
      blocks.push(block);
      continue;
    }

    // Parenthetical
    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      const block: ParentheticalBlock = { type: 'parenthetical', text: trimmed.slice(1, -1) };
      blocks.push(block);
      continue;
    }

    // Character name (centered — lots of leading spaces, all caps or Korean)
    if (raw.startsWith('    ') && /^[A-Z가-힣\s()./]+$/.test(trimmed) && trimmed.length < 40) {
      const [name, voice] = trimmed.split(/\s*\((.+)\)\s*$/);
      const block: CharacterBlock = {
        type: 'character',
        characterId: name.trim().toLowerCase().replace(/\s+/g, '-'),
        voiceType: (voice as CharacterBlock['voiceType']) ?? 'normal',
      };
      blocks.push(block);
      continue;
    }

    // Dialogue (indented)
    if (raw.startsWith('     ') && blocks.length > 0 && blocks[blocks.length - 1].type === 'character') {
      const block: DialogueBlock = { type: 'dialogue', text: trimmed };
      blocks.push(block);
      continue;
    }

    // Action (default)
    const last = blocks[blocks.length - 1];
    if (last?.type === 'action') {
      (last as ActionBlock).text += ' ' + trimmed;
    } else {
      const block: ActionBlock = { type: 'action', text: trimmed };
      blocks.push(block);
    }
  }

  return {
    id: sceneId,
    version: 1,
    header: {
      ...header,
      timeOfDay: header.timeOfDay,
    },
    meta: {
      summary: '',
      emotionalTone: [],
      tensionLevel: 5,
      estimatedMinutes: blocks.length * 0.05,
      tags: [],
    },
    blocks,
    characters: [...new Set(
      blocks
        .filter((b): b is CharacterBlock => b.type === 'character')
        .map((b) => b.characterId)
    )],
  };
}

/**
 * Estimates scene runtime in minutes based on block count.
 */
export function estimateRuntime(scene: Scene): number {
  let minutes = 0;
  for (const block of scene.blocks) {
    switch (block.type) {
      case 'dialogue':
        minutes += block.text.length * 0.004;
        break;
      case 'action':
        minutes += block.text.length * 0.003;
        break;
      default:
        minutes += 0.05;
    }
  }
  return Math.round(minutes * 10) / 10;
}
