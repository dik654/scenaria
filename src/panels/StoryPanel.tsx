import { useState } from 'react';
import { TensionFlow } from '../visualizations/TensionFlow';
import { SceneCardBoard } from '../visualizations/SceneCardBoard';
import { CharacterPresence } from '../visualizations/CharacterPresence';
import { CharacterNetwork } from '../visualizations/CharacterNetwork';
import { StoryClock } from '../visualizations/StoryClock';
import { ForeshadowingManager } from '../visualizations/ForeshadowingManager';
import { SceneDashboard } from '../visualizations/SceneDashboard';
import { BeatBoard } from '../visualizations/BeatBoard';
import { PlotThreadTimeline } from '../visualizations/PlotThreadTimeline';
import { CausalGraph } from '../visualizations/CausalGraph';
import { DualTimeline } from '../visualizations/DualTimeline';
import { CharacterCoOccurrence } from '../visualizations/CharacterCoOccurrence';
import { useSceneStore } from '../store/sceneStore';
import { fileIO } from '../io';
import { useProjectStore } from '../store/projectStore';
import type { Scene } from '../types/scene';

type PlotView = 'dashboard' | 'tension' | 'clock' | 'cards' | 'presence' | 'network' | 'foreshadowing' | 'beats' | 'threads' | 'causal' | 'dual-timeline' | 'co-occurrence';

const VIEW_CONFIG: { id: PlotView; label: string; icon: string }[] = [
  { id: 'dashboard',      label: '대시보드',       icon: '📊' },
  { id: 'tension',        label: '긴장도',         icon: '📈' },
  { id: 'clock',          label: '스토리클록',     icon: '🕐' },
  { id: 'beats',          label: '비트 보드',      icon: '🎯' },
  { id: 'threads',        label: '플롯 스레드',    icon: '🧵' },
  { id: 'causal',         label: '인과 그래프',    icon: '⚡' },
  { id: 'dual-timeline',  label: '이중 타임라인',  icon: '⏳' },
  { id: 'cards',          label: '씬 카드',        icon: '🃏' },
  { id: 'presence',       label: '캐릭터 등장',    icon: '👥' },
  { id: 'network',        label: '관계 네트워크',  icon: '🕸️' },
  { id: 'co-occurrence',  label: '코드 다이어그램', icon: '🎶' },
  { id: 'foreshadowing',  label: '복선',           icon: '🔗' },
];

export function StoryPanel() {
  const [activeView, setActiveView] = useState<PlotView>('dashboard');
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
      {/* View tabs - scrollable */}
      <div className="flex overflow-x-auto border-b border-gray-800 flex-shrink-0 scrollbar-none">
        {VIEW_CONFIG.map(v => (
          <button
            key={v.id}
            onClick={() => setActiveView(v.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs whitespace-nowrap transition-colors flex-shrink-0 ${
              activeView === v.id
                ? 'text-white border-b-2 border-red-500 bg-gray-900/30'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <span>{v.icon}</span>
            <span>{v.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeView === 'dashboard'      && <SceneDashboard />}
        {activeView === 'tension'        && <TensionFlow onSceneClick={handleSceneSelect} />}
        {activeView === 'clock'          && <StoryClock />}
        {activeView === 'beats'          && <BeatBoard onSceneSelect={handleSceneSelect} />}
        {activeView === 'threads'        && <PlotThreadTimeline onSceneSelect={handleSceneSelect} />}
        {activeView === 'causal'         && <CausalGraph onSceneClick={handleSceneSelect} />}
        {activeView === 'dual-timeline'  && <DualTimeline onSceneClick={handleSceneSelect} />}
        {activeView === 'cards'          && <SceneCardBoard onSceneSelect={handleSceneSelect} />}
        {activeView === 'presence'       && <CharacterPresence />}
        {activeView === 'network'        && <CharacterNetwork onCharacterClick={() => {}} />}
        {activeView === 'co-occurrence'  && <CharacterCoOccurrence />}
        {activeView === 'foreshadowing'  && <ForeshadowingManager />}
      </div>
    </div>
  );
}
