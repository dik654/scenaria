import type { Doc } from '@blocksuite/store';

import type {
  Scene,
  SceneHeader,
  SceneMeta,
  SceneBlock,
  SceneStatus,
  ActionBlock,
  DialogueBlock,
  TransitionBlock,
  Interior,
  TimeOfDay,
  VoiceType,
  Marker,
} from '../../types/scene';

/** Shorthand: cast a BlockModel to a loose property bag. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyModel = Record<string, any>;

/**
 * Convert a BlockSuite Doc back into a plain Scene JSON object.
 *
 * Reads the root `scenaria:scene-doc` block for metadata, extracts the
 * `scenaria:scene-header` child for the header, and maps every remaining
 * child block to the corresponding SceneBlock union member.
 */
export function docToScene(doc: Doc): Scene {
  const root = doc.root;
  if (!root) {
    throw new Error('Doc has no root block');
  }

  if (root.flavour !== 'scenaria:scene-doc') {
    throw new Error(
      `Expected root flavour "scenaria:scene-doc", got "${root.flavour}"`
    );
  }

  // ── Read root props (scene metadata + top-level fields) ────────
  const r = root as unknown as AnyModel;

  const meta: SceneMeta = {
    summary: (r.summary as string) ?? '',
    emotionalTone: (r.emotionalTone as string[]) ?? [],
    tensionLevel: (r.tensionLevel as number) ?? 5,
    estimatedMinutes: (r.estimatedMinutes as number) ?? 1,
    tags: (r.tags as string[]) ?? [],
    notes: (r.notes as string) || undefined,
    cardColor: (r.cardColor as string) || undefined,
    status: ((r.status as string) || undefined) as SceneStatus | undefined,
  };

  const characters: string[] = (r.characters as string[]) ?? [];

  // ── Parse children ─────────────────────────────────────────────
  const children = root.children ?? [];

  let header: SceneHeader | undefined;
  const blocks: SceneBlock[] = [];

  for (const child of children) {
    if (child.flavour === 'scenaria:scene-header') {
      header = readHeader(child as unknown as AnyModel);
    } else {
      const block = readBlock(child as unknown as AnyModel);
      if (block) {
        blocks.push(block);
      }
    }
  }

  if (!header) {
    throw new Error('Doc is missing a scenaria:scene-header block');
  }

  return {
    id: (r.sceneId as string) ?? doc.id,
    version: (r.version as number) ?? 1,
    header,
    meta,
    blocks,
    characters,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────

function readHeader(model: AnyModel): SceneHeader {
  const header: SceneHeader = {
    interior: (model.interior as Interior) ?? null,
    location: (model.location as string) ?? '',
    timeOfDay: (model.timeOfDay as TimeOfDay) ?? 'DAY',
  };

  const locationDetail = model.locationDetail as string | undefined;
  if (locationDetail) header.locationDetail = locationDetail;

  const timeLabel = model.timeLabel as string | undefined;
  if (timeLabel) header.timeLabel = timeLabel;

  const weather = model.weather as string | undefined;
  if (weather) header.weather = weather;

  return header;
}

function readBlock(model: AnyModel): SceneBlock | null {
  const flavour = model.flavour as string;

  switch (flavour) {
    case 'scenaria:action':
      return readActionBlock(model);
    case 'scenaria:character':
      return readCharacterBlock(model);
    case 'scenaria:dialogue':
      return readDialogueBlock(model);
    case 'scenaria:parenthetical':
      return readParentheticalBlock(model);
    case 'scenaria:transition':
      return readTransitionBlock(model);
    default:
      // Unknown block flavour -- skip gracefully
      return null;
  }
}

function readActionBlock(model: AnyModel): ActionBlock {
  const text = model.text;
  const result: ActionBlock = {
    type: 'action',
    text: text != null ? String(text) : '',
  };

  if (model.isInsert) {
    result.isInsert = true;
    if (model.insertLabel) {
      result.insertLabel = model.insertLabel as string;
    }
  }

  const markers = model.markers as Marker[] | undefined;
  if (markers && markers.length > 0) {
    result.markers = markers;
  }

  return result;
}

function readCharacterBlock(model: AnyModel): SceneBlock {
  return {
    type: 'character',
    characterId: (model.characterId as string) ?? '',
    voiceType: (model.voiceType as VoiceType) ?? 'normal',
  };
}

function readDialogueBlock(model: AnyModel): DialogueBlock {
  const text = model.text;
  const result: DialogueBlock = {
    type: 'dialogue',
    text: text != null ? String(text) : '',
  };

  const markers = model.markers as Marker[] | undefined;
  if (markers && markers.length > 0) {
    result.markers = markers;
  }

  return result;
}

function readParentheticalBlock(model: AnyModel): SceneBlock {
  const text = model.text;
  return {
    type: 'parenthetical',
    text: text != null ? String(text) : '',
  };
}

function readTransitionBlock(model: AnyModel): TransitionBlock {
  const result: TransitionBlock = {
    type: 'transition',
    transitionType: (model.transitionType as string) ?? '컷',
  };

  const customText = model.customText as string | undefined;
  if (customText) {
    result.customText = customText;
  }

  return result;
}
