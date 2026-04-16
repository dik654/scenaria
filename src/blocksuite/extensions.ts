import {
  BlockViewExtension,
  FlavourExtension,
  type ExtensionType,
} from '@blocksuite/block-std';
import { literal } from 'lit/static-html.js';

// Side-effect: register all view custom elements
import './views/index';

// Re-export schemas so consumers can import from one place
import { scenariaSchemas } from './schemas/index';
export { scenariaSchemas };

export const scenariaExtensions: ExtensionType[] = [
  // Scene Document (root)
  FlavourExtension('scenaria:scene-doc'),
  BlockViewExtension('scenaria:scene-doc' as any, literal`scenaria-scene-doc`),

  // Scene Header
  FlavourExtension('scenaria:scene-header'),
  BlockViewExtension('scenaria:scene-header' as any, literal`scenaria-scene-header`),

  // Action
  FlavourExtension('scenaria:action'),
  BlockViewExtension('scenaria:action' as any, literal`scenaria-action-block`),

  // Character
  FlavourExtension('scenaria:character'),
  BlockViewExtension('scenaria:character' as any, literal`scenaria-character-block`),

  // Dialogue
  FlavourExtension('scenaria:dialogue'),
  BlockViewExtension('scenaria:dialogue' as any, literal`scenaria-dialogue-block`),

  // Parenthetical
  FlavourExtension('scenaria:parenthetical'),
  BlockViewExtension(
    'scenaria:parenthetical' as any,
    literal`scenaria-parenthetical-block`
  ),

  // Transition
  FlavourExtension('scenaria:transition'),
  BlockViewExtension(
    'scenaria:transition' as any,
    literal`scenaria-transition-block`
  ),
];
