import type { SceneBlock } from '../../types/scene';
import type { CharacterIndexEntry } from '../../types/character';

export interface BlockProps {
  block: SceneBlock;
  index: number;
  isSelected: boolean;
  readOnly: boolean;
  characterNames: Record<string, string>;
  characterColors: Record<string, string>;
  charEntries: CharacterIndexEntry[];
  dialogueAlignment: 'center' | 'left';
  onSelect: (index: number) => void;
  onChange: (index: number, block: SceneBlock) => void;
  onKeyDown: (e: React.KeyboardEvent, index: number) => void;
}
