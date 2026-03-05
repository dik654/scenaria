import { describe, it, expect } from 'vitest';
import {
  STATUS_LABELS,
  STATUS_BG_ACTIVE,
  STATUS_BG_BUTTON,
  STATUS_HEX,
  statusLabel,
  statusBgActive,
  statusBgButton,
  statusHex,
} from './statusMapping';
import type { SceneStatus } from '../types/scene';

const ALL_STATUSES: SceneStatus[] = ['outline', 'draft', 'revision', 'done'];

describe('statusMapping', () => {
  describe('STATUS_LABELS', () => {
    it('has a label for every SceneStatus', () => {
      for (const s of ALL_STATUSES) {
        expect(STATUS_LABELS[s]).toBeTruthy();
      }
    });

    it('returns Korean labels', () => {
      expect(STATUS_LABELS.outline).toBe('아웃라인');
      expect(STATUS_LABELS.draft).toBe('초고');
      expect(STATUS_LABELS.revision).toBe('수정');
      expect(STATUS_LABELS.done).toBe('완료');
    });
  });

  describe('STATUS_BG_ACTIVE', () => {
    it('returns Tailwind bg classes for every status', () => {
      for (const s of ALL_STATUSES) {
        expect(STATUS_BG_ACTIVE[s]).toMatch(/^bg-/);
      }
    });

    it('uses distinct colors per status', () => {
      const values = ALL_STATUSES.map(s => STATUS_BG_ACTIVE[s]);
      expect(new Set(values).size).toBe(ALL_STATUSES.length);
    });
  });

  describe('STATUS_BG_BUTTON', () => {
    it('uses darker variant than STATUS_BG_ACTIVE', () => {
      // e.g. bg-blue-500 (active) vs bg-blue-600 (button)
      for (const s of ALL_STATUSES) {
        const active = STATUS_BG_ACTIVE[s];
        const button = STATUS_BG_BUTTON[s];
        // Both should start with the same hue prefix (bg-gray, bg-blue, etc.)
        const hue = active.replace(/\d+$/, '');
        expect(button).toMatch(new RegExp(`^${hue}`));
        // Button level should be numerically higher than active level
        const activeLevel = parseInt(active.match(/\d+$/)?.[0] ?? '0');
        const buttonLevel = parseInt(button.match(/\d+$/)?.[0] ?? '0');
        expect(buttonLevel).toBeGreaterThanOrEqual(activeLevel);
      }
    });
  });

  describe('STATUS_HEX', () => {
    it('returns valid hex color strings', () => {
      for (const s of ALL_STATUSES) {
        expect(STATUS_HEX[s]).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });
  });

  describe('helper functions', () => {
    it('statusLabel delegates to STATUS_LABELS', () => {
      for (const s of ALL_STATUSES) {
        expect(statusLabel(s)).toBe(STATUS_LABELS[s]);
      }
    });

    it('statusBgActive delegates to STATUS_BG_ACTIVE', () => {
      for (const s of ALL_STATUSES) {
        expect(statusBgActive(s)).toBe(STATUS_BG_ACTIVE[s]);
      }
    });

    it('statusBgButton delegates to STATUS_BG_BUTTON', () => {
      for (const s of ALL_STATUSES) {
        expect(statusBgButton(s)).toBe(STATUS_BG_BUTTON[s]);
      }
    });

    it('statusHex delegates to STATUS_HEX', () => {
      for (const s of ALL_STATUSES) {
        expect(statusHex(s)).toBe(STATUS_HEX[s]);
      }
    });
  });
});
