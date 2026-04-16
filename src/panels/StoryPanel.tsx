import { useState, type ReactNode } from 'react';
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
import { StoryWizard } from './storyPanel/StoryWizard';
import { useSceneStore } from '../store/sceneStore';
import { fileIO } from '../io';
import { useProjectStore } from '../store/projectStore';
import type { Scene } from '../types/scene';
import {
  LayoutDashboard, TrendingUp, Clock, Target, Cable, Zap,
  Hourglass, LayoutGrid, Users, Network, BarChart3, Link, Sparkles,
} from 'lucide-react';

type PlotView = 'dashboard' | 'wizard' | 'tension' | 'clock' | 'cards' | 'presence' | 'network' | 'foreshadowing' | 'beats' | 'threads' | 'causal' | 'dual-timeline' | 'co-occurrence';

const VIEW_CONFIG: { id: PlotView; label: string; icon: ReactNode }[] = [
  { id: 'wizard',         label: 'AI 마법사',      icon: <Sparkles className="w-3.5 h-3.5" /> },
  { id: 'dashboard',      label: '대시보드',       icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
  { id: 'tension',        label: '몰입도',         icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { id: 'clock',          label: '스토리클록',     icon: <Clock className="w-3.5 h-3.5" /> },
  { id: 'beats',          label: '비트 보드',      icon: <Target className="w-3.5 h-3.5" /> },
  { id: 'threads',        label: '플롯 스레드',    icon: <Cable className="w-3.5 h-3.5" /> },
  { id: 'causal',         label: '인과 그래프',    icon: <Zap className="w-3.5 h-3.5" /> },
  { id: 'dual-timeline',  label: '이중 타임라인',  icon: <Hourglass className="w-3.5 h-3.5" /> },
  { id: 'cards',          label: '씬 카드',        icon: <LayoutGrid className="w-3.5 h-3.5" /> },
  { id: 'presence',       label: '캐릭터 등장',    icon: <Users className="w-3.5 h-3.5" /> },
  { id: 'network',        label: '관계 네트워크',  icon: <Network className="w-3.5 h-3.5" /> },
  { id: 'co-occurrence',  label: '코드 다이어그램', icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { id: 'foreshadowing',  label: '복선',           icon: <Link className="w-3.5 h-3.5" /> },
];

export function StoryPanel() {
  const [activeView, setActiveView] = useState<PlotView>('dashboard');
  const { setCurrentScene, index } = useSceneStore();
  const { projectRef } = useProjectStore();

  const handleSceneSelect = async (sceneId: string) => {
    if (!projectRef) return;
    const entry = index.find(s => s.id === sceneId);
    if (!entry) return;
    try {
      const scene = await fileIO.readJSON<Scene>(projectRef, `screenplay/${entry.filename}`);
      setCurrentScene(sceneId, scene);
    } catch (err) {
      console.error('씬 로드 실패:', err);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* View tabs - scrollable */}
      <div className="flex overflow-x-auto border-b border-gray-100 flex-shrink-0 scrollbar-none">
        {VIEW_CONFIG.map(v => (
          <button
            key={v.id}
            onClick={() => setActiveView(v.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs whitespace-nowrap transition-colors flex-shrink-0 ${
              activeView === v.id
                ? 'text-gray-800 border-b-2 border-blue-500 font-medium'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <span>{v.icon}</span>
            <span>{v.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeView === 'wizard'         && <StoryWizard />}
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
