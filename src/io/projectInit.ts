import type { FileIO, ProjectRef } from './types';
import type { ProjectMeta, AppSettings } from '../types/project';
import type { SceneIndex } from '../types/scene';
import type { CharacterIndex } from '../types/character';
import type { EventIndex, ThreadIndex, StoryStructure, ForeshadowingIndex } from '../types/story';
import type { ConsistencyData } from '../types/consistency';
import { nanoid } from 'nanoid';

const DEFAULT_STRUCTURE: StoryStructure = {
  templateName: '3막 구조',
  acts: [
    { name: '1막', label: '설정', startPercent: 0, endPercent: 25 },
    { name: '2막 전반', label: '대립', startPercent: 25, endPercent: 50 },
    { name: '2막 후반', label: '위기', startPercent: 50, endPercent: 75 },
    { name: '3막', label: '해결', startPercent: 75, endPercent: 100 },
  ],
  beats: [
    {
      id: 'beat-inciting',
      name: '사건 발생',
      description: '주인공의 일상을 깨뜨리는 사건',
      relativePosition: 0.10,
      act: 1,
      isRequired: true,
      linkedEventId: null,
    },
    {
      id: 'beat-pp1',
      name: '1막 전환점',
      description: '이야기 방향이 바뀌는 첫 번째 전환점',
      relativePosition: 0.25,
      act: 1,
      isRequired: true,
      linkedEventId: null,
    },
    {
      id: 'beat-midpoint',
      name: '중간 전환점',
      description: '새로운 정보로 방향이 바뀌는 지점',
      relativePosition: 0.50,
      act: 2,
      isRequired: true,
      linkedEventId: null,
    },
    {
      id: 'beat-crisis',
      name: '위기',
      description: '주인공이 최저점에 달하는 순간',
      relativePosition: 0.75,
      act: 3,
      isRequired: true,
      linkedEventId: null,
    },
    {
      id: 'beat-climax',
      name: '클라이맥스',
      description: '최고조의 갈등 해소',
      relativePosition: 0.90,
      act: 3,
      isRequired: true,
      linkedEventId: null,
    },
  ],
  availableTemplates: ['3막 구조', 'Save The Cat', '영웅의 여정', '5막 구조'],
};

const DEFAULT_CONSISTENCY: ConsistencyData = {
  lastChecked: new Date().toISOString(),
  issues: [],
  rules: [
    { id: 'rule-time', name: '시간 모순 검사', enabled: true, requiresAI: false },
    { id: 'rule-location', name: '캐릭터 위치 모순', enabled: true, requiresAI: false },
    { id: 'rule-foreshadowing', name: '미회수 떡밥', enabled: true, requiresAI: false },
    { id: 'rule-arc', name: '캐릭터 행동 일관성', enabled: true, requiresAI: true },
    { id: 'rule-speech', name: '말투 일관성', enabled: true, requiresAI: true },
  ],
};

const DEFAULT_FORESHADOWING: ForeshadowingIndex = { items: [] };

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  editorFont: 'monospace',
  editorFontSize: 14,
  lineHeight: 1.8,
  sceneHeaderFormat: 'korean',
  dialogueAlignment: 'center',
  showLineNumbers: false,
  autosaveInterval: 2000,
  ai: { provider: 'claude' },
  shortcuts: {},
  quickActions: [],
};

export async function initializeProject(
  fileIO: FileIO,
  projectRef: ProjectRef,
  projectName: string
): Promise<ProjectMeta> {
  const meta: ProjectMeta = {
    id: nanoid(),
    title: projectName.replace('.scenaria', ''),
    logline: '',
    genre: [],
    format: 'feature',
    targetRuntime: 100,
    language: 'ko',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: '1',
  };

  const sceneIndex: SceneIndex = { scenes: [] };
  const charIndex: CharacterIndex = { characters: [] };
  const eventIndex: EventIndex = { events: [] };
  const threadIndex: ThreadIndex = { threads: [] };

  await Promise.all([
    fileIO.writeJSON(projectRef, 'project.json', meta),
    fileIO.writeJSON(projectRef, 'settings.json', DEFAULT_SETTINGS),
    fileIO.writeJSON(projectRef, 'screenplay/_index.json', sceneIndex),
    fileIO.writeJSON(projectRef, 'characters/_index.json', charIndex),
    fileIO.writeJSON(projectRef, 'story/structure.json', DEFAULT_STRUCTURE),
    fileIO.writeJSON(projectRef, 'story/events/_index.json', eventIndex),
    fileIO.writeJSON(projectRef, 'story/threads/_index.json', threadIndex),
    fileIO.writeJSON(projectRef, 'story/foreshadowing.json', DEFAULT_FORESHADOWING),
    fileIO.writeJSON(projectRef, 'story/consistency.json', DEFAULT_CONSISTENCY),
    fileIO.writeJSON(projectRef, 'ai-history.json', { entries: [] }),
  ]);

  // Write version marker
  await fileIO.writeJSON(projectRef, '.scenaria-version', '1');

  return meta;
}

export async function loadProject(
  fileIO: FileIO,
  projectRef: ProjectRef
): Promise<ProjectMeta> {
  return fileIO.readJSON<ProjectMeta>(projectRef, 'project.json');
}
