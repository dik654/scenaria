import { create } from 'zustand';
import type { ProjectMeta, AppSettings } from '../types/project';
import type { HistoryManager } from '../io/history/historyManager';
import type { AutoSave } from '../io/history/autoSave';

interface ProjectState {
  dirHandle: FileSystemDirectoryHandle | null;
  meta: ProjectMeta | null;
  settings: AppSettings;
  historyManager: HistoryManager | null;
  autoSave: AutoSave | null;
  isLoading: boolean;
  error: string | null;

  setProject: (dirHandle: FileSystemDirectoryHandle, meta: ProjectMeta) => void;
  setSettings: (settings: Partial<AppSettings>) => void;
  setHistoryManager: (hm: HistoryManager) => void;
  setAutoSave: (as: AutoSave) => void;
  clearProject: () => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  editorFont: 'monospace',
  editorFontSize: 14,
  lineHeight: 1.8,
  sceneHeaderFormat: 'korean',
  dialogueAlignment: 'center',
  showLineNumbers: false,
  autosaveInterval: 2000,
  ai: {
    provider: 'claude',
  },
  shortcuts: {},
  quickActions: [
    { id: 'qa-honorific', label: '존댓말 ↔ 반말', prompt: '이 대사를 반말/존댓말로 바꿔주세요.' },
    { id: 'qa-shorten', label: '대사 줄이기', prompt: '이 대사를 절반 길이로 줄여주세요.' },
    { id: 'qa-emotional', label: '더 감정적으로', prompt: '이 대사나 지문을 더 감정적으로 만들어주세요.' },
    { id: 'qa-dry', label: '더 건조하게', prompt: '이 대사나 지문을 더 건조하고 사무적으로 만들어주세요.' },
    { id: 'qa-show', label: '대사→지문', prompt: '이 대사를 보여주는(show) 지문으로 변환해주세요.' },
    { id: 'qa-subtext', label: '서브텍스트 추가', prompt: '이 대사에 서브텍스트를 추가해주세요.' },
    { id: 'qa-visual', label: '시각적으로 묘사', prompt: '이 내용을 더 시각적으로 묘사해주세요.' },
  ],
};

export const useProjectStore = create<ProjectState>((set) => ({
  dirHandle: null,
  meta: null,
  settings: DEFAULT_SETTINGS,
  historyManager: null,
  autoSave: null,
  isLoading: false,
  error: null,

  setProject: (dirHandle, meta) => set({ dirHandle, meta, error: null }),
  setSettings: (settings) =>
    set((state) => ({ settings: { ...state.settings, ...settings } })),
  setHistoryManager: (hm) => set({ historyManager: hm }),
  setAutoSave: (as) => set({ autoSave: as }),
  clearProject: () =>
    set({ dirHandle: null, meta: null, historyManager: null, autoSave: null }),
  setError: (error) => set({ error }),
  setLoading: (isLoading) => set({ isLoading }),
}));
