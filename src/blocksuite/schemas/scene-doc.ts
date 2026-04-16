import { defineBlockSchema } from '@blocksuite/store';

export const SceneDocSchema = defineBlockSchema({
  flavour: 'scenaria:scene-doc',
  metadata: {
    version: 1,
    role: 'root',
    children: [
      'scenaria:scene-header',
      'scenaria:action',
      'scenaria:character',
      'scenaria:dialogue',
      'scenaria:parenthetical',
      'scenaria:transition',
    ],
  },
  props: () => ({
    sceneId: '',
    version: 1,
    summary: '',
    emotionalTone: [] as string[],
    tensionLevel: 5,
    estimatedMinutes: 1,
    tags: [] as string[],
    notes: '',
    cardColor: '',
    status: 'draft' as string,
    characters: [] as string[],
  }),
});
