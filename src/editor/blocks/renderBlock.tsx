import type { SceneBlock } from '../../types/scene';
import type { BlockProps } from './BlockProps';
import { ActionBlockView } from './ActionBlockView';
import { CharacterBlockView } from './CharacterBlockView';
import { DialogueBlockView } from './DialogueBlockView';
import { ParentheticalBlockView } from './ParentheticalBlockView';
import { TransitionBlockView } from './TransitionBlockView';

export function renderBlock(props: BlockProps) {
  switch (props.block.type) {
    case 'action':       return <ActionBlockView       key={props.index} {...props} />;
    case 'character':    return <CharacterBlockView    key={props.index} {...props} />;
    case 'dialogue':     return <DialogueBlockView     key={props.index} {...props} />;
    case 'parenthetical':return <ParentheticalBlockView key={props.index} {...props} />;
    case 'transition':   return <TransitionBlockView   key={props.index} {...props} />;
  }
}

export function getNextBlockType(currentBlock: SceneBlock, allBlocks: SceneBlock[], index: number): SceneBlock['type'] {
  switch (currentBlock.type) {
    case 'character':     return 'dialogue';
    case 'dialogue':      return allBlocks.slice(0, index).reverse().find(b => b.type === 'character') ? 'action' : 'action';
    case 'parenthetical': return 'dialogue';
    case 'action':        return 'character';
    case 'transition':    return 'action';
    default:              return 'action';
  }
}

export function createEmptyBlock(type: SceneBlock['type']): SceneBlock {
  switch (type) {
    case 'action':        return { type: 'action', text: '' };
    case 'character':     return { type: 'character', characterId: '', voiceType: 'normal' };
    case 'dialogue':      return { type: 'dialogue', text: '' };
    case 'parenthetical': return { type: 'parenthetical', text: '' };
    case 'transition':    return { type: 'transition', transitionType: 'CUT TO:' };
  }
}

export function isBlockEmpty(block: SceneBlock): boolean {
  if ('text' in block) return block.text.trim() === '';
  if (block.type === 'character') return block.characterId === '';
  return false;
}
