import { useState } from 'react';
import { useSceneStore } from '../../store/sceneStore';
import { useProjectStore } from '../../store/projectStore';
import { useCharacterStore } from '../../store/characterStore';
import { fileIO } from '../../io';
import type { ProjectRef } from '../../io/types';
import type { Scene } from '../../types/scene';
import type { Character } from '../../types/character';
import { renderFullScreenplayTXT, buildLLMContextText, sceneToFountain, renderScreenplayHTML } from '../../utils/formatRenderer';
import { renderScreenplayDOCX } from '../../utils/docxRenderer';
import { useToast } from '../../components/Toast';

export type ExportFormat = 'txt' | 'fountain' | 'llm-context' | 'docx' | 'pdf';

async function loadCharMap(
  charIndex: { id: string; filename: string }[],
  characters: Record<string, Character>,
  projectRef: ProjectRef,
): Promise<Record<string, Character>> {
  const charMap: Record<string, Character> = {};
  for (const entry of charIndex) {
    if (characters[entry.id]) {
      charMap[entry.id] = characters[entry.id];
    } else {
      try {
        charMap[entry.id] = await fileIO.readJSON<Character>(projectRef, `characters/${entry.filename}`);
      } catch {/* skip */}
    }
  }
  return charMap;
}

export function useExportOps() {
  const { index: sceneIndex, currentScene } = useSceneStore();
  const { meta, projectRef } = useProjectStore();
  const { index: charIndex, characters } = useCharacterStore();
  const toast = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async (format: ExportFormat, scope: 'all' | 'current') => {
    if (!projectRef || !meta) return;
    setIsExporting(true);
    setError(null);
    try {
      let scenes: { scene: Scene; number: number }[] = [];
      if (scope === 'current' && currentScene) {
        const entry = sceneIndex.find(s => s.id === currentScene.id);
        scenes = [{ scene: currentScene, number: entry?.number ?? 1 }];
      } else {
        for (const entry of sceneIndex) {
          try {
            const scene = await fileIO.readJSON<Scene>(projectRef, `screenplay/${entry.filename}`);
            scenes.push({ scene, number: entry.number });
          } catch { console.warn(`씬 ${entry.id} 로드 실패`); }
        }
      }

      const charMap = await loadCharMap(charIndex, characters, projectRef);
      let blob: Blob;
      let filename = '';

      if (format === 'pdf') {
        const html = renderScreenplayHTML(scenes, meta.title, charMap);
        const printWindow = window.open('', '_blank');
        if (!printWindow) { setError('팝업이 차단되었습니다. 팝업을 허용해주세요.'); return; }
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.onload = () => {
          printWindow.print();
          printWindow.onafterprint = () => printWindow.close();
        };
        return;
      } else if (format === 'docx') {
        blob = await renderScreenplayDOCX(scenes, meta.title, charMap);
        filename = `${meta.title}.docx`;
      } else {
        let content = '';
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
            content = buildLLMContextText(scenes.map(s => s.scene), Object.values(charMap), meta.title, meta.logline);
            filename = `${meta.title}-context.md`;
            break;
        }
        blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      }

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

  const handleCopyToClipboard = async (scope: 'all' | 'current') => {
    if (!projectRef || !meta) return;
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
          try { scenesToUse.push(await fileIO.readJSON<Scene>(projectRef, `screenplay/${entry.filename}`)); } catch {/* skip */}
        }
      }
      const text = buildLLMContextText(scenesToUse, Object.values(charMap), meta.title, meta.logline);
      await navigator.clipboard.writeText(text);
      toast('클립보드에 복사됐습니다!', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : '복사 실패');
    } finally {
      setIsExporting(false);
    }
  };

  return { isExporting, error, setError, handleExport, handleCopyToClipboard };
}
