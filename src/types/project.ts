export type ProjectGenre =
  | '스릴러'
  | '드라마'
  | '코미디'
  | '액션'
  | '로맨스'
  | '공포'
  | 'SF'
  | '판타지'
  | '역사'
  | '다큐멘터리'
  | string;

export interface ProjectMeta {
  id: string;
  title: string;
  logline: string;
  genre: ProjectGenre[];
  format: 'feature' | 'short' | 'series' | 'web';
  targetRuntime: number;
  language: string;
  createdAt: string;
  updatedAt: string;
  version: string;
  author?: string;
  description?: string;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'sepia';
  editorFont: string;
  editorFontSize: number;
  lineHeight: number;
  sceneHeaderFormat: 'korean' | 'standard' | 'compact';
  dialogueAlignment: 'center' | 'left';
  showLineNumbers: boolean;
  autosaveInterval: number;
  ai: {
    provider: 'claude' | 'local-vllm' | 'openai';
    apiKey?: string;
    endpoint?: string;
    model?: string;
  };
  shortcuts: Record<string, string>;
  quickActions: {
    id: string;
    label: string;
    prompt: string;
  }[];
}
