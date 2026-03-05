import { useState } from 'react';
import { TensionFlow } from '../visualizations/TensionFlow';
import { SceneCardBoard } from '../visualizations/SceneCardBoard';
import { CharacterPresence } from '../visualizations/CharacterPresence';
import { useSceneStore } from '../store/sceneStore';
import { fileIO } from '../io';
import { useProjectStore } from '../store/projectStore';
import type { Scene } from '../types/scene';

type PlotView = 'tension' | 'cards' | 'presence';

const VIEW_LABELS: Record<PlotView, string> = {
  tension: '긴장도',
  cards: '씬 카드',
  presence: '캐릭터 등장',
};

export function StoryPanel() {
  const [activeView, setActiveView] = useState<PlotView>('cards');
  const { setCurrentScene, index } = useSceneStore();
  const { dirHandle } = useProjectStore();

  const handleSceneSelect = async (sceneId: string) => {
    if (!dirHandle) return;
    const entry = index.find(s => s.id === sceneId);
    if (!entry) return;
    try {
      const scene = await fileIO.readJSON<Scene>(dirHandle, `screenplay/${entry.filename}`);
      setCurrentScene(sceneId, scene);
    } catch (err) {
      console.error('씬 로드 실패:', err);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* View tabs */}
      <div className="flex border-b border-gray-800 flex-shrink-0">
        {(Object.keys(VIEW_LABELS) as PlotView[]).map(v => (
          <button
            key={v}
            onClick={() => setActiveView(v)}
            className={`px-3 py-2 text-xs transition-colors ${
              activeView === v
                ? 'text-white border-b-2 border-red-500'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {VIEW_LABELS[v]}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeView === 'tension' && (
          <TensionFlow onSceneClick={handleSceneSelect} />
        )}
        {activeView === 'cards' && (
          <SceneCardBoard onSceneSelect={handleSceneSelect} />
        )}
        {activeView === 'presence' && (
          <CharacterPresence />
        )}
      </div>
    </div>
  );
}
