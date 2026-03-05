import { useState } from 'react';
import { useSceneStore } from '../store/sceneStore';
import { useProjectStore } from '../store/projectStore';
import { useCharacterStore } from '../store/characterStore';
import { fileIO } from '../io';
import type { Scene } from '../types/scene';
import type { Character } from '../types/character';
import { renderFullScreenplayTXT, buildLLMContextText, sceneToFountain } from '../utils/formatRenderer';

type ExportFormat = 'txt' | 'fountain' | 'llm-context';

export function ExportPanel() {
  const { index: sceneIndex, currentScene } = useSceneStore();
  const { meta, dirHandle } = useProjectStore();
  const { index: charIndex, characters } = useCharacterStore();
  const [format, setFormat] = useState<ExportFormat>('txt');
  const [scope, setScope] = useState<'all' | 'current'>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-sm font-medium text-white">내보내기</h3>

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
    </div>
  );
}
