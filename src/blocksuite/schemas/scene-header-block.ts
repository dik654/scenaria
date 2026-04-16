import { defineBlockSchema } from '@blocksuite/store';

export const SceneHeaderBlockSchema = defineBlockSchema({
  flavour: 'scenaria:scene-header',
  metadata: {
    version: 1,
    role: 'hub',
    parent: ['scenaria:scene-doc'],
  },
  props: () => ({
    interior: null as string | null,
    location: '',
    locationDetail: '',
    timeOfDay: 'DAY',
    timeLabel: '',
    weather: '',
  }),
});
