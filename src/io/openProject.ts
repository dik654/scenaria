import { fileIO } from './index';
import { loadProject } from './projectInit';
import { HistoryManager } from './history/historyManager';
import { AutoSave } from './history/autoSave';
import { saveRecentProject, type RecentProject } from './recentProjects';
import type { ProjectMeta, AppSettings } from '../types/project';

type SetProject = (d: FileSystemDirectoryHandle, m: ProjectMeta) => void;
type SetHistoryManager = (hm: HistoryManager) => void;
type SetAutoSave = (as: AutoSave) => void;
type SetSettings = (s: Partial<AppSettings>) => void;

export async function openProjectFromHandle(
  dirHandle: FileSystemDirectoryHandle,
  setProject: SetProject,
  setHistoryManager: SetHistoryManager,
  setAutoSave: SetAutoSave,
  setSettings: SetSettings,
): Promise<ProjectMeta> {
  const meta = await loadProject(fileIO, dirHandle);
  setProject(dirHandle, meta);

  const savedSettings = await fileIO.readJSON<AppSettings>(dirHandle, 'settings.json').catch(() => null);
  if (savedSettings) setSettings(savedSettings);

  const lsKey = localStorage.getItem('scenaria_api_key');
  if (lsKey) setSettings({ ai: { ...(savedSettings?.ai ?? { provider: 'claude' }), apiKey: lsKey } });

  const hm = new HistoryManager(dirHandle);
  await hm.init();
  setHistoryManager(hm);

  const as = new AutoSave(hm);
  setAutoSave(as);

  return meta;
}

export async function openProjectWithPicker(
  setProject: SetProject,
  setHistoryManager: SetHistoryManager,
  setAutoSave: SetAutoSave,
  setSettings: SetSettings,
): Promise<void> {
  const handle = await fileIO.openProject();
  const meta = await openProjectFromHandle(handle.dirHandle, setProject, setHistoryManager, setAutoSave, setSettings);
  await saveRecentProject({
    id: meta.id,
    name: meta.title,
    dirHandle: handle.dirHandle,
    lastOpened: new Date().toISOString(),
  } as RecentProject);
}
