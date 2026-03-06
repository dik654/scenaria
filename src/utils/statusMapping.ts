import type { SceneStatus } from '../types/scene';

export const STATUS_LABELS: Record<SceneStatus, string> = {
  outline: '아웃라인',
  draft: '초고',
  revision: '수정',
  done: '완료',
};

/** Tailwind bg class for active state (full-intensity) */
export const STATUS_BG_ACTIVE: Record<SceneStatus, string> = {
  outline: 'bg-gray-500',
  draft: 'bg-blue-500',
  revision: 'bg-yellow-500',
  done: 'bg-green-500',
};

/** Tailwind bg class for dark button (600-level) */
export const STATUS_BG_BUTTON: Record<SceneStatus, string> = {
  outline: 'bg-gray-600',
  draft: 'bg-blue-600',
  revision: 'bg-yellow-600',
  done: 'bg-green-600',
};

/** Hex color (for SVG / canvas contexts) */
export const STATUS_HEX: Record<SceneStatus, string> = {
  outline: '#6B7280',
  draft: '#3B82F6',
  revision: '#EAB308',
  done: '#22C55E',
};

export function statusBgActive(status: SceneStatus): string {
  return STATUS_BG_ACTIVE[status];
}

export function statusBgButton(status: SceneStatus): string {
  return STATUS_BG_BUTTON[status];
}

export function statusLabel(status: SceneStatus): string {
  return STATUS_LABELS[status];
}

export function statusHex(status: SceneStatus): string {
  return STATUS_HEX[status];
}
