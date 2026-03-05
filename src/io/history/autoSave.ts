import type { HistoryManager } from './historyManager';

export class AutoSave {
  private historyManager: HistoryManager;
  private debounceTimer: number | null = null;
  private idleTimer: number | null = null;
  private readonly debounceMs: number;
  private readonly idleMs: number;
  private isDirty = false;

  constructor(
    historyManager: HistoryManager,
    debounceMs = 2000,
    idleMs = 10 * 60 * 1000
  ) {
    this.historyManager = historyManager;
    this.debounceMs = debounceMs;
    this.idleMs = idleMs;
  }

  /**
   * Call this whenever the document changes (file save).
   * Does NOT create a save point — only a file-level save.
   */
  markDirty() {
    this.isDirty = true;
    this.resetIdleTimer();
  }

  /**
   * Schedule an auto save point after debounceMs idle.
   * Used after Ctrl+S (file save).
   */
  scheduleAutoSavePoint() {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = window.setTimeout(async () => {
      if (this.isDirty) {
        await this.triggerAutoSave();
      }
    }, this.debounceMs);
  }

  private resetIdleTimer() {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
    }
    this.idleTimer = window.setTimeout(async () => {
      if (this.isDirty) {
        await this.triggerAutoSave('10분 유휴 자동 저장');
      }
    }, this.idleMs);
  }

  private async triggerAutoSave(memo?: string) {
    try {
      await this.historyManager.createSavePoint(memo, true);
      this.isDirty = false;
    } catch (err) {
      console.error('[AutoSave] 자동 저장 실패:', err);
    }
  }

  /** Call on scene navigation to create auto save point */
  async onSceneChange(prevSceneId: string) {
    if (this.isDirty) {
      await this.historyManager.createSavePoint(`씬 ${prevSceneId} 편집 후 자동 저장`, true);
      this.isDirty = false;
    }
  }

  dispose() {
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
    if (this.idleTimer !== null) clearTimeout(this.idleTimer);
  }
}
