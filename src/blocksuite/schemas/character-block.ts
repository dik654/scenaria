import { defineBlockSchema } from '@blocksuite/store';

export const CharacterBlockSchema = defineBlockSchema({
  flavour: 'scenaria:character',
  metadata: {
    version: 1,
    role: 'content',
    parent: ['scenaria:scene-doc'],
  },
  props: () => ({
    characterId: '',
    voiceType: 'normal' as string,
  }),
});
