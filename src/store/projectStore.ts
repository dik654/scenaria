import { create } from 'zustand';
import type { ProjectMeta, AppSettings } from '../types/project';
import type { HistoryManager } from '../io/history/historyManager';
import type { AutoSave } from '../io/history/autoSave';
import type { ProjectRef } from '../io/types';
import { fileIO } from '../io';

interface ProjectState {
  projectRef: ProjectRef | null;
  meta: ProjectMeta | null;
  settings: AppSettings;
  historyManager: HistoryManager | null;
  autoSave: AutoSave | null;
  isLoading: boolean;
  error: string | null;

  setProject: (ref: ProjectRef, meta: ProjectMeta) => void;
  setSettings: (settings: Partial<AppSettings>) => void;
  persistSettings: () => Promise<void>;
  setHistoryManager: (hm: HistoryManager) => void;
  setAutoSave: (as: AutoSave) => void;
  clearProject: () => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  editorFont: 'monospace',
  editorFontSize: 14,
  lineHeight: 1.8,
  sceneHeaderFormat: 'korean',
  dialogueAlignment: 'center',
  showLineNumbers: false,
  autosaveInterval: 2000,
  ai: {
    provider: 'claude',
    autoAnalysis: true,
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

export const useProjectStore = create<ProjectState>((set, get) => ({
  projectRef: null,
  meta: null,
  settings: DEFAULT_SETTINGS,
  historyManager: null,
  autoSave: null,
  isLoading: false,
  error: null,

  setProject: (ref, meta) => set({ projectRef: ref, meta, error: null }),
  setSettings: (settings) =>
    set((state) => ({ settings: { ...state.settings, ...settings } })),
  persistSettings: async () => {
    const { projectRef, settings } = get();
    if (!projectRef) return;
    const { ai, ...rest } = settings;
    const safeAi = { ...ai };
    delete (safeAi as Record<string, unknown>).apiKey;
    try {
      await fileIO.writeJSON(projectRef, 'settings.json', { ...rest, ai: safeAi });
    } catch (err) {
      console.error('설정 저장 실패:', err);
    }
  },
  setHistoryManager: (hm) => set({ historyManager: hm }),
  setAutoSave: (as) => set({ autoSave: as }),
  clearProject: () =>
    set({ projectRef: null, meta: null, historyManager: null, autoSave: null }),
  setError: (error) => set({ error }),
  setLoading: (isLoading) => set({ isLoading }),
}));
