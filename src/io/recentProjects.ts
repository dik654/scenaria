import { openDB } from 'idb';
import type { ProjectRef } from './types';

const DB_NAME = 'scenaria-recent';
const STORE = 'projects';
const VERSION = 1;

export interface RecentProject {
  id: string;
  name: string;
  ref: ProjectRef;
  lastOpened: string;
}

async function getDB() {
  return openDB(DB_NAME, VERSION, {
    upgrade(db) {
      db.createObjectStore(STORE, { keyPath: 'id' });
    },
  });
}

export async function saveRecentProject(project: RecentProject) {
  const db = await getDB();
  await db.put(STORE, project);
}

export async function getRecentProjects(): Promise<RecentProject[]> {
  const db = await getDB();
  const all = await db.getAll(STORE);
  return all.sort((a, b) => b.lastOpened.localeCompare(a.lastOpened)).slice(0, 10);
}

export async function removeRecentProject(id: string) {
  const db = await getDB();
  await db.delete(STORE, id);
}

export async function verifyHandlePermission(
  handle: ProjectRef
): Promise<boolean> {
  // Electron paths (strings) don't need browser permission checks
  if (typeof handle === 'string') return true;
  try {
    const perm = await handle.queryPermission({ mode: 'readwrite' });
    if (perm === 'granted') return true;
    const req = await handle.requestPermission({ mode: 'readwrite' });
    return req === 'granted';
  } catch {
    return false;
  }
}
