import { defineBlockSchema } from '@blocksuite/store';

export const DialogueBlockSchema = defineBlockSchema({
  flavour: 'scenaria:dialogue',
  metadata: {
    version: 1,
    role: 'content',
    parent: ['scenaria:scene-doc'],
  },
  props: (internal) => ({
    text: internal.Text(),
    markers: [] as Array<{
      type: string;
      id: string;
      label: string;
      linkedTo?: string;
      severity?: string;
    }>,
  }),
});
