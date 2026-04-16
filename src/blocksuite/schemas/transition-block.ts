import { defineBlockSchema } from '@blocksuite/store';

export const TransitionBlockSchema = defineBlockSchema({
  flavour: 'scenaria:transition',
  metadata: {
    version: 1,
    role: 'content',
    parent: ['scenaria:scene-doc'],
  },
  props: () => ({
    transitionType: '컷' as string,
    customText: '',
  }),
});
