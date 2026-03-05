import { useRef, useState } from 'react';
import { useSceneStore } from '../store/sceneStore';
import { useProjectStore } from '../store/projectStore';
import { useCharacterStore } from '../store/characterStore';
import { fileIO } from '../io';
import type { Scene, SceneIndexEntry } from '../types/scene';
import type { Character } from '../types/character';
import { renderFullScreenplayTXT, buildLLMContextText, sceneToFountain } from '../utils/formatRenderer';
import { parseFountainToScenes } from '../utils/documentParser';
import { nanoid } from 'nanoid';
import { nextSceneId, renumberScenes } from '../utils/sceneNumbering';
import { sceneFilename } from '../utils/fileNaming';

type ExportFormat = 'txt' | 'fountain' | 'llm-context';
type PanelMode = 'export' | 'import';

export function ExportPanel() {
  const { index: sceneIndex, currentScene, addSceneToIndex, setIndex, setCurrentScene } = useSceneStore();
  const { meta, dirHandle } = useProjectStore();
  const { index: charIndex, characters } = useCharacterStore();
  const [panelMode, setPanelMode] = useState<PanelMode>('export');
  const [format, setFormat] = useState<ExportFormat>('txt');
  const [scope, setScope] = useState<'all' | 'current'>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<{ count: number; titles: string[] } | null>(null);
  const [importData, setImportData] = useState<Partial<Scene>[] | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleExport = async () => {
    if (!dirHandle || !meta) return;
    setIsExporting(true);
    setError(null);

    try {
      // Load all scenes if needed
      let scenes: { scene: Scene; number: number }[] = [];

      if (scope === 'current' && currentScene) {
        const entry = sceneIndex.find(s => s.id === currentScene.id);
        scenes = [{ scene: currentScene, number: entry?.number ?? 1 }];
      } else {
        // Load all scenes from disk
        for (const entry of sceneIndex) {
          try {
            const scene = await fileIO.readJSON<Scene>(dirHandle, `screenplay/${entry.filename}`);
            scenes.push({ scene, number: entry.number });
          } catch {
            console.warn(`씬 ${entry.id} 로드 실패`);
          }
        }
      }

      const charMap: Record<string, Character> = {};
      for (const entry of charIndex) {
        if (characters[entry.id]) {
          charMap[entry.id] = characters[entry.id];
        } else {
          try {
            const char = await fileIO.readJSON<Character>(dirHandle, `characters/${entry.filename}`);
            charMap[entry.id] = char;
          } catch {/* skip */}
        }
      }

      let content = '';
      let filename = '';

      switch (format) {
        case 'txt':
          content = renderFullScreenplayTXT(scenes, meta.title, charMap);
          filename = `${meta.title}.txt`;
          break;
        case 'fountain':
          content = scenes.map(({ scene }) => sceneToFountain(scene, charMap)).join('\n\n');
          filename = `${meta.title}.fountain`;
          break;
        case 'llm-context':
          content = buildLLMContextText(
            scenes.map(s => s.scene),
            Object.values(charMap),
            meta.title,
            meta.logline
          );
          filename = `${meta.title}-context.md`;
          break;
      }

      // Download
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '내보내기 실패');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyToClipboard = async () => {
    if (!dirHandle || !meta || format !== 'llm-context') return;
    setIsExporting(true);
    try {
      const charMap: Record<string, Character> = {};
      for (const entry of charIndex) {
        if (characters[entry.id]) charMap[entry.id] = characters[entry.id];
      }

      const scenesToUse: Scene[] = [];
      if (scope === 'current' && currentScene) {
        scenesToUse.push(currentScene);
      } else {
        for (const entry of sceneIndex) {
          try {
            scenesToUse.push(await fileIO.readJSON<Scene>(dirHandle, `screenplay/${entry.filename}`));
          } catch {/* skip */}
        }
      }

      const text = buildLLMContextText(scenesToUse, Object.values(charMap), meta.title, meta.logline);
      await navigator.clipboard.writeText(text);
      alert('클립보드에 복사됐습니다!');
    } catch (err) {
      setError(err instanceof Error ? err.message : '복사 실패');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const scenes = parseFountainToScenes(text);
      if (scenes.length === 0) { setError('씬을 찾지 못했습니다. Fountain 형식(.fountain)인지 확인하세요.'); return; }
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

  const handleImport = async () => {
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
          id,
          filename,
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
      // Navigate to first imported scene
      if (newEntries[0]) {
        const first = await fileIO.readJSON<Scene>(dirHandle, `screenplay/${newEntries[0].filename}`);
        setCurrentScene(newEntries[0].id, first);
      }
      setImportData(null);
      setImportPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setPanelMode('export');
      alert(`${newEntries.length}개 씬을 가져왔습니다.`);
    } catch (err) {
      setError('가져오기 실패: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Mode tabs */}
      <div className="flex border-b border-gray-800 flex-shrink-0">
        {(['export', 'import'] as PanelMode[]).map(m => (
          <button key={m} onClick={() => { setPanelMode(m); setError(null); setImportPreview(null); setImportData(null); }}
            className={`flex-1 py-2 text-xs transition-colors ${panelMode === m ? 'text-white border-b-2 border-red-500' : 'text-gray-500 hover:text-gray-300'}`}>
            {m === 'export' ? '내보내기' : '가져오기'}
          </button>
        ))}
      </div>

    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {panelMode === 'import' ? (
        <>
          <p className="text-xs text-gray-500">Fountain(.fountain) 또는 텍스트 파일에서 씬을 가져옵니다.</p>
          <input ref={fileInputRef} type="file" accept=".fountain,.txt,.text" onChange={handleFileSelect}
            className="hidden" />
          <button onClick={() => fileInputRef.current?.click()}
            className="w-full py-2 border border-dashed border-gray-600 rounded-lg text-xs text-gray-400 hover:border-gray-400 hover:text-white transition-colors">
            파일 선택...
          </button>

          {importPreview && (
            <div className="bg-gray-800 rounded-lg p-3 space-y-2">
              <p className="text-xs text-green-400 font-medium">✓ {importPreview.count}개 씬 발견</p>
              <ul className="space-y-0.5">
                {importPreview.titles.map((t, i) => (
                  <li key={i} className="text-xs text-gray-400">S#{sceneIndex.length + 1 + i}. {t}</li>
                ))}
                {importPreview.count > 5 && (
                  <li className="text-xs text-gray-600">... 외 {importPreview.count - 5}개</li>
                )}
              </ul>
              <p className="text-xs text-gray-600">현재 {sceneIndex.length}개 씬 뒤에 추가됩니다.</p>
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          {importData && (
            <button onClick={handleImport} disabled={isImporting}
              className="w-full py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg disabled:opacity-50 font-medium">
              {isImporting ? '가져오는 중...' : `${importData.length}개 씬 가져오기`}
            </button>
          )}
        </>
      ) : (
        <>

      {/* Format */}
      <div>
        <label className="text-xs text-gray-500 block mb-2">포맷</label>
        <div className="space-y-1.5">
          {([
            ['txt', '한국 시나리오 TXT', '표준 한국 시나리오 텍스트 형식'],
            ['fountain', 'Fountain', '국제 호환 시나리오 포맷'],
            ['llm-context', 'LLM 컨텍스트', 'AI에게 붙여넣기용 마크다운'],
          ] as [ExportFormat, string, string][]).map(([f, label, desc]) => (
            <label key={f} className="flex items-start gap-2 cursor-pointer group">
              <input
                type="radio"
                name="format"
                value={f}
                checked={format === f}
                onChange={() => setFormat(f)}
                className="mt-0.5 accent-red-500"
              />
              <div>
                <p className="text-sm text-gray-300 group-hover:text-white">{label}</p>
                <p className="text-xs text-gray-600">{desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Scope */}
      <div>
        <label className="text-xs text-gray-500 block mb-2">범위</label>
        <div className="flex gap-2">
          <button
            onClick={() => setScope('all')}
            className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${
              scope === 'all' ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-700 text-gray-500 hover:text-gray-300'
            }`}
          >
            전체 ({sceneIndex.length}씬)
          </button>
          <button
            onClick={() => setScope('current')}
            disabled={!currentScene}
            className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors disabled:opacity-30 ${
              scope === 'current' ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-700 text-gray-500 hover:text-gray-300'
            }`}
          >
            현재 씬
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Buttons */}
      <div className="space-y-2">
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="w-full py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg disabled:opacity-50 font-medium"
        >
          {isExporting ? '내보내는 중...' : '파일로 내보내기 ↓'}
        </button>
        {format === 'llm-context' && (
          <button
            onClick={handleCopyToClipboard}
            disabled={isExporting}
            className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg disabled:opacity-50"
          >
            클립보드에 복사
          </button>
        )}
      </div>
      </>
      )}
    </div>
    </div>
  );
}
