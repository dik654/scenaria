import type { Scene, SceneBlock, ActionBlock, CharacterBlock, DialogueBlock, ParentheticalBlock, TransitionBlock, Interior } from '../types/scene';

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
 * Parses a Fountain screenplay file into an array of partial Scenes.
 * Supports: scene headings, action, character (ALL CAPS), dialogue, parentheticals, transitions.
 */
export function parseFountainToScenes(text: string): Partial<Scene>[] {
  // Normalize line endings and strip BOM
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/^\uFEFF/, '');
  // Remove boneyards (/* ... */)
  const cleaned = normalized.replace(/\/\*[\s\S]*?\*\//g, '');

  // Split into paragraphs (double newline separates elements)
  const paragraphs = cleaned.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);

  const sceneHeadingRE = /^(INT|EXT|INT\.?\/EXT|I\/E)[\s.]/i;
  const forceHeadingRE = /^\./;
  const transitionRE = /^(FADE OUT\.?|FADE IN:|FADE TO|CUT TO:|SMASH CUT|MATCH CUT|DISSOLVE TO:?|THE END)$/i;
  // Latin names: all-caps word(s). Korean names: pure Hangul syllables only (no dots/particles).
  const charNameRE = /^[A-Z가-힣][A-Z가-힣\s\-'']*(\s+\(.*\))?$/;
  const koreanNameRE = /^[가-힣]+(\s+[가-힣]+)?$/;

  const scenes: Partial<Scene>[] = [];
  let currentScene: Partial<Scene> | null = null;
  let lastBlockType: SceneBlock['type'] | null = null;

  const pushBlock = (block: SceneBlock) => {
    if (!currentScene) return;
    currentScene.blocks = [...(currentScene.blocks ?? []), block];
    lastBlockType = block.type;
  };

  for (const para of paragraphs) {
    const lines = para.split('\n');
    const firstLine = lines[0].trim();

    // Scene heading
    if (sceneHeadingRE.test(firstLine) || forceHeadingRE.test(firstLine)) {
      // Finalize previous scene
      if (currentScene) scenes.push(finalizeScene(currentScene, scenes.length));

      const line = forceHeadingRE.test(firstLine) ? firstLine.slice(1).trim() : firstLine;
      const parts = line.split(/\s+-\s+/);
      const locPart = parts[0] ?? line;
      const timePart = (parts[1] ?? 'DAY').toUpperCase();

      const intMatch = locPart.match(/^(INT\.?\/EXT\.?|I\/E\.?|INT\.?|EXT\.?)\s*/i);
      const interior = intMatch ? (intMatch[1].startsWith('INT') ? (intMatch[1].includes('EXT') ? null : 'INT') : 'EXT') as Interior : null;
      const location = locPart.replace(/^(INT\.?\/EXT\.?|I\/E\.?|INT\.?|EXT\.?)\s*/i, '').trim();
      const timeOfDay = (['DAY','NIGHT','DAWN','DUSK','CONTINUOUS'].find(t => timePart.includes(t)) ?? 'DAY') as Scene['header']['timeOfDay'];

      currentScene = {
        id: '',
        version: 1,
        header: { interior, location, timeOfDay },
        meta: { summary: '', emotionalTone: [], tensionLevel: 5, estimatedMinutes: 0, tags: [] },
        blocks: [],
        characters: [],
      };
      lastBlockType = null;
      continue;
    }

    if (!currentScene) continue;

    // Transition
    if (lines.length === 1 && transitionRE.test(firstLine)) {
      pushBlock({ type: 'transition', transitionType: firstLine.toUpperCase() } as TransitionBlock);
      continue;
    }

    // Parenthetical
    if (lines.length === 1 && firstLine.startsWith('(') && firstLine.endsWith(')')) {
      pushBlock({ type: 'parenthetical', text: firstLine.slice(1, -1).trim() } as ParentheticalBlock);
      continue;
    }

    // Character name: single line, all caps (Latin) or pure Hangul word(s) (Korean)
    const hasLatinChars = /[A-Za-z]/.test(firstLine);
    const isCharName = lines.length === 1 &&
      firstLine.length < 50 &&
      lastBlockType !== 'character' &&
      (hasLatinChars
        ? charNameRE.test(firstLine) && firstLine === firstLine.toUpperCase()
        : koreanNameRE.test(firstLine));
    if (isCharName) {
      const voiceMatch = firstLine.match(/\(([^)]+)\)\s*$/);
      const name = firstLine.replace(/\s*\([^)]+\)\s*$/, '').trim();
      const voiceRaw = voiceMatch?.[1]?.trim() ?? 'normal';
      const voiceType = (['V.O.','O.S.','E','N'].includes(voiceRaw) ? voiceRaw : 'normal') as CharacterBlock['voiceType'];
      const charId = name.toLowerCase().replace(/\s+/g, '-');
      pushBlock({ type: 'character', characterId: charId, voiceType } as CharacterBlock);
      if (!currentScene.characters?.includes(charId)) {
        currentScene.characters = [...(currentScene.characters ?? []), charId];
      }
      continue;
    }

    // Dialogue (immediately after character or parenthetical)
    if (lastBlockType === 'character' || lastBlockType === 'parenthetical') {
      pushBlock({ type: 'dialogue', text: para } as DialogueBlock);
      continue;
    }

    // Action (default)
    const lastBlock = currentScene.blocks?.[currentScene.blocks.length - 1];
    if (lastBlock?.type === 'action') {
      (lastBlock as ActionBlock).text += '\n' + para;
    } else {
      pushBlock({ type: 'action', text: para } as ActionBlock);
    }
  }

  // Finalize last scene
  if (currentScene) scenes.push(finalizeScene(currentScene, scenes.length));

  return scenes;
}

function finalizeScene(scene: Partial<Scene>, idx: number): Partial<Scene> {
  const blocks = scene.blocks ?? [];
  let minutes = 0;
  for (const b of blocks) {
    if (b.type === 'dialogue') minutes += b.text.length * 0.004;
    else if (b.type === 'action') minutes += b.text.length * 0.003;
    else minutes += 0.05;
  }
  return {
    ...scene,
    id: `s${String(idx + 1).padStart(3, '0')}`,
    meta: { ...scene.meta!, estimatedMinutes: Math.round(minutes * 10) / 10 },
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
