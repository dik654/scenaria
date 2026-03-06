import { useState } from 'react';
import { useSceneStore } from '../../store/sceneStore';
import { useProjectStore } from '../../store/projectStore';
import { fileIO } from '../../io';
import type { Scene, SceneIndexEntry } from '../../types/scene';
import { parseFountainToScenes } from '../../utils/documentParser';
import { nextSceneId, renumberScenes } from '../../utils/sceneNumbering';
import { sceneFilename } from '../../utils/fileNaming';

export function useImportOps(onDone: () => void) {
  const { index: sceneIndex, addSceneToIndex, setIndex, setCurrentScene } = useSceneStore();
  const { dirHandle, meta } = useProjectStore();
  const [importPreview, setImportPreview] = useState<{ count: number; titles: string[] } | null>(null);
  const [importData, setImportData] = useState<Partial<Scene>[] | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const scenes = parseFountainToScenes(text);
      if (scenes.length === 0) {
        setError('씬을 찾지 못했습니다. Fountain 형식(.fountain)인지 확인하세요.');
        return;
      }
      setImportData(scenes);
      setImportPreview({
        count: scenes.length,
        titles: scenes.slice(0, 5).map(s => `${s.header?.location ?? '?'} (${s.header?.timeOfDay ?? '?'})`),
      });
      setError(null);
    } catch (err) {
      setError('파일 읽기 실패: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleImport = async (resetFileInput: () => void) => {
    if (!dirHandle || !importData || !meta) return;
    setIsImporting(true);
    setError(null);
    try {
      const startNumber = sceneIndex.length + 1;
      const newEntries: SceneIndexEntry[] = [];
      for (let i = 0; i < importData.length; i++) {
        const partial = importData[i];
        const id = nextSceneId([...sceneIndex, ...newEntries]);
        const scene: Scene = {
          id,
          version: 1,
          header: partial.header ?? { interior: null, location: '장소', timeOfDay: 'DAY' },
          meta: partial.meta ?? { summary: '', emotionalTone: [], tensionLevel: 5, estimatedMinutes: 0, tags: [] },
          blocks: partial.blocks ?? [],
          characters: partial.characters ?? [],
        };
        const filename = sceneFilename(id, scene.header.location);
        await fileIO.writeJSON(dirHandle, `screenplay/${filename}`, scene);
        newEntries.push({
          id, filename,
          number: startNumber + i,
          location: scene.header.location,
          timeOfDay: scene.header.timeOfDay,
          interior: scene.header.interior,
          summary: scene.meta.summary,
          characterCount: scene.characters.length,
        });
      }
      const newIndex = [...sceneIndex, ...newEntries];
      await fileIO.writeJSON(dirHandle, 'screenplay/_index.json', { scenes: newIndex });
      setIndex(newIndex);
      if (newEntries[0]) {
        const first = await fileIO.readJSON<Scene>(dirHandle, `screenplay/${newEntries[0].filename}`);
        setCurrentScene(newEntries[0].id, first);
      }
      setImportData(null);
      setImportPreview(null);
      resetFileInput();
      onDone();
      alert(`${newEntries.length}개 씬을 가져왔습니다.`);
    } catch (err) {
      setError('가져오기 실패: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsImporting(false);
    }
  };

  const reset = () => {
    setImportData(null);
    setImportPreview(null);
    setError(null);
  };

  return {
    importPreview,
    importData,
    isImporting,
    error,
    setError,
    handleFileSelect,
    handleImport,
    reset,
    sceneIndexLength: sceneIndex.length,
  };
}
