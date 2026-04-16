import type { Doc, DocCollection } from '@blocksuite/store';

import type {
  Scene,
  SceneBlock,
  ActionBlock,
  CharacterBlock,
  DialogueBlock,
  ParentheticalBlock,
  TransitionBlock,
} from '../../types/scene';

/**
 * Convert a Scene JSON object into a BlockSuite Doc.
 *
 * Creates a new document in the given collection, populates the root
 * `scenaria:scene-doc` block with scene metadata, adds the
 * `scenaria:scene-header` block, and then appends every SceneBlock
 * as the appropriate custom block flavour.
 */
export function sceneToDoc(scene: Scene, collection: DocCollection): Doc {
  const doc = collection.createDoc({ id: scene.id });
  doc.load();

  // ── Root block (scenaria:scene-doc) ────────────────────────────
  const rootId = doc.addBlock('scenaria:scene-doc' as never, {
    sceneId: scene.id,
    version: scene.version,
    summary: scene.meta.summary,
    emotionalTone: scene.meta.emotionalTone,
    tensionLevel: scene.meta.tensionLevel,
    estimatedMinutes: scene.meta.estimatedMinutes,
    tags: scene.meta.tags,
    notes: scene.meta.notes ?? '',
    cardColor: scene.meta.cardColor ?? '',
    status: scene.meta.status ?? 'draft',
    characters: scene.characters,
  });

  // ── Scene header ───────────────────────────────────────────────
  doc.addBlock('scenaria:scene-header' as never, {
    interior: scene.header.interior,
    location: scene.header.location,
    locationDetail: scene.header.locationDetail ?? '',
    timeOfDay: scene.header.timeOfDay,
    timeLabel: scene.header.timeLabel ?? '',
    weather: scene.header.weather ?? '',
  }, rootId);

  // ── Content blocks ─────────────────────────────────────────────
  for (const block of scene.blocks) {
    addSceneBlock(doc, block, rootId);
  }

  return doc;
}

// ─── Helpers ──────────────────────────────────────────────────────

function addSceneBlock(doc: Doc, block: SceneBlock, parentId: string): void {
  switch (block.type) {
    case 'action':
      addActionBlock(doc, block, parentId);
      break;
    case 'character':
      addCharacterBlock(doc, block, parentId);
      break;
    case 'dialogue':
      addDialogueBlock(doc, block, parentId);
      break;
    case 'parenthetical':
      addParentheticalBlock(doc, block, parentId);
      break;
    case 'transition':
      addTransitionBlock(doc, block, parentId);
      break;
  }
}

function addActionBlock(doc: Doc, block: ActionBlock, parentId: string): void {
  doc.addBlock('scenaria:action' as never, {
    text: new doc.Text(block.text),
    isInsert: block.isInsert ?? false,
    insertLabel: block.insertLabel ?? '',
    markers: block.markers ?? [],
  }, parentId);
}

function addCharacterBlock(doc: Doc, block: CharacterBlock, parentId: string): void {
  doc.addBlock('scenaria:character' as never, {
    characterId: block.characterId,
    voiceType: block.voiceType,
  }, parentId);
}

function addDialogueBlock(doc: Doc, block: DialogueBlock, parentId: string): void {
  doc.addBlock('scenaria:dialogue' as never, {
    text: new doc.Text(block.text),
    markers: block.markers ?? [],
  }, parentId);
}

function addParentheticalBlock(doc: Doc, block: ParentheticalBlock, parentId: string): void {
  doc.addBlock('scenaria:parenthetical' as never, {
    text: new doc.Text(block.text),
  }, parentId);
}

function addTransitionBlock(doc: Doc, block: TransitionBlock, parentId: string): void {
  doc.addBlock('scenaria:transition' as never, {
    transitionType: block.transitionType,
    customText: block.customText ?? '',
  }, parentId);
}
