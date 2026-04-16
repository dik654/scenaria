export function isElectron(): boolean {
  return typeof window !== 'undefined'
    && typeof (window as unknown as Record<string, unknown>).__ELECTRON_IPC__ !== 'undefined';
}
