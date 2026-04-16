import { defineBlockSchema } from '@blocksuite/store';

export const ParentheticalBlockSchema = defineBlockSchema({
  flavour: 'scenaria:parenthetical',
  metadata: {
    version: 1,
    role: 'content',
    parent: ['scenaria:scene-doc'],
  },
  props: (internal) => ({
    text: internal.Text(),
  }),
});
