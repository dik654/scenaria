import { defineBlockSchema } from '@blocksuite/store';

export const ActionBlockSchema = defineBlockSchema({
  flavour: 'scenaria:action',
  metadata: {
    version: 1,
    role: 'content',
    parent: ['scenaria:scene-doc'],
  },
  props: (internal) => ({
    text: internal.Text(),
    isInsert: false,
    insertLabel: '',
    markers: [] as Array<{
      type: string;
      id: string;
      label: string;
      linkedTo?: string;
      severity?: string;
    }>,
  }),
});
