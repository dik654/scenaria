import { SceneDocSchema } from './scene-doc';
import { SceneHeaderBlockSchema } from './scene-header-block';
import { ActionBlockSchema } from './action-block';
import { CharacterBlockSchema } from './character-block';
import { DialogueBlockSchema } from './dialogue-block';
import { ParentheticalBlockSchema } from './parenthetical-block';
import { TransitionBlockSchema } from './transition-block';

export {
  SceneDocSchema,
  SceneHeaderBlockSchema,
  ActionBlockSchema,
  CharacterBlockSchema,
  DialogueBlockSchema,
  ParentheticalBlockSchema,
  TransitionBlockSchema,
};

export const scenariaSchemas = [
  SceneDocSchema,
  SceneHeaderBlockSchema,
  ActionBlockSchema,
  CharacterBlockSchema,
  DialogueBlockSchema,
  ParentheticalBlockSchema,
  TransitionBlockSchema,
];
