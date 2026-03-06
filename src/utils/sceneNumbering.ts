import type { SceneIndexEntry } from '../types/scene';

export function formatSceneNumber(n: number): string {
  return `S#${n}`;
}

export function sceneId(number: number): string {
  return `s${String(number).padStart(3, '0')}`;
}

export function renumberScenes(scenes: SceneIndexEntry[]): SceneIndexEntry[] {
  return scenes.map((s, i) => ({ ...s, number: i + 1 }));
}

export function nextSceneId(scenes: SceneIndexEntry[]): string {
  const maxNum = scenes.reduce((max, s) => Math.max(max, s.number), 0);
  return sceneId(maxNum + 1);
}
