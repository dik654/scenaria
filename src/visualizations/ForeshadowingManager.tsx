import { useState } from 'react';
import type { ReactNode } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useStoryStore } from '../store/storyStore';
import { useConfirm } from '../components/ConfirmDialog';
import { fileIO } from '../io';
import type { ForeshadowingIndex, ForeshadowingItem } from '../types/story';
import { nanoid } from 'nanoid';
import { Link, CheckCircle, XCircle, Sparkles, Loader2 } from 'lucide-react';
import { useVisualizationAI } from './hooks/useVisualizationAI';
import {
  SYSTEM_FORESHADOWING_GENERATION,
  buildForeshadowingGenPrompt,
  type ForeshadowingGenResult,
} from '../ai/prompts/visualizationGen';

const STATUS_ICON: Record<string, ReactNode> = {
  planted: <Link className="w-4 h-4 text-yellow-400" />,
  resolved: <CheckCircle className="w-4 h-4 text-green-400" />,
  abandoned: <XCircle className="w-4 h-4 text-red-400" />,
};

const STATUS_LABEL: Record<string, string> = {
  planted: '미회수',
  resolved: '회수됨',
  abandoned: '포기',
};

const IMPORTANCE_COLOR: Record<string, string> = {
  critical: 'text-red-400',
  major: 'text-yellow-400',
  minor: 'text-gray-400',
};

const STRENGTH_BADGE: Record<string, string> = {
  weak: 'bg-yellow-50 text-yellow-600',
  medium: 'bg-blue-50 text-blue-500',
  strong: 'bg-green-50 text-green-500',
};

export function ForeshadowingManager() {
  const { projectRef } = useProjectStore();
  const confirm = useConfirm();
  const { foreshadowing, setForeshadowing } = useStoryStore();
  const data = foreshadowing;
  const [filter, setFilter] = useState<'all' | 'planted' | 'resolved'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newForm, setNewForm] = useState({ scene: '', description: '', importance: 'major' as ForeshadowingItem['importance'] });
  const [aiRequirements, setAiRequirements] = useState('');
  const [showRequirements, setShowRequirements] = useState(false);

  const { generate, generating, streamText, error, stop } = useVisualizationAI<ForeshadowingGenResult>({
    systemPrompt: SYSTEM_FORESHADOWING_GENERATION,
    buildUserPrompt: buildForeshadowingGenPrompt,
    maxTokens: 4096,
  });

  const save = async (updated: ForeshadowingIndex) => {
    setForeshadowing(updated);
    if (!projectRef) return;
    await fileIO.writeJSON(projectRef, 'story/foreshadowing.json', updated);
  };

  const handleAddItem = async () => {
    if (!newForm.scene || !newForm.description) return;
    const item: ForeshadowingItem = {
      id: `fs-${nanoid(8)}`,
      type: 'foreshadowing',
      plantedIn: { scene: newForm.scene, blockIndex: 0, description: newForm.description },
      payoff: null,
      status: 'planted',
      importance: newForm.importance,
    };
    const updated = { items: [...(data?.items ?? []), item] };
    await save(updated);
    setIsAdding(false);
    setNewForm({ scene: '', description: '', importance: 'major' });
  };

  const handleMarkResolved = async (id: string, payoffScene: string, payoffDesc: string) => {
    if (!data) return;
    const updated: ForeshadowingIndex = {
      items: data.items.map(item =>
        item.id === id
          ? { ...item, status: 'resolved', payoff: { scene: payoffScene, blockIndex: 0, description: payoffDesc, strength: 'medium' } }
          : item
      ),
    };
    await save(updated);
  };

  const handleDelete = async (id: string) => {
    if (!data || !await confirm('이 복선을 삭제하시겠습니까?')) return;
    await save({ items: data.items.filter(i => i.id !== id) });
  };

  const handleAIGenerate = async (requirements?: string) => {
    if (data?.items?.length) {
      const ok = await confirm('기존 복선을 AI 생성 결과로 대체합니다. 계속하시겠습니까?');
      if (!ok) return;
    }
    const result = await generate(requirements);
    if (!result?.items?.length) return;

    const items: ForeshadowingItem[] = result.items.map(item => ({
      id: `fs-${nanoid(8)}`,
      type: 'foreshadowing' as const,
      plantedIn: { scene: '미정', blockIndex: 0, description: item.plantDescription },
      payoff: item.payoffDescription
        ? { scene: '미정', blockIndex: 0, description: item.payoffDescription, strength: item.strength ?? 'medium' }
        : null,
      status: 'planted' as const,
      importance: item.importance ?? 'major',
      notes: item.notes,
    }));
    await save({ items });
    setShowRequirements(false);
    setAiRequirements('');
  };

  const filteredItems = (data?.items ?? []).filter(item =>
    filter === 'all' || item.status === filter
  );

  const plantedCount = data?.items.filter(i => i.status === 'planted').length ?? 0;
  const resolvedCount = data?.items.filter(i => i.status === 'resolved').length ?? 0;

  // Generating state
  if (generating) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b border-gray-200 flex items-center gap-3">
          <span className="text-xs text-gray-500">복선 관리</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
          <span className="text-xs text-gray-500">AI가 복선-회수 계획을 생성하고 있습니다...</span>
          {streamText && (
            <pre className="text-xs text-gray-400 whitespace-pre-wrap max-h-40 overflow-y-auto font-mono leading-relaxed w-full max-w-lg">
              {streamText.slice(-400)}
            </pre>
          )}
          <button onClick={stop} className="text-xs text-red-500 hover:text-red-400 border border-red-200 rounded px-3 py-1">중단</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Summary */}
      <div className="px-3 py-2 border-b border-gray-200 flex items-center gap-3">
        <div className="flex gap-3 text-xs">
          <span className="text-yellow-400 flex items-center gap-1"><Link className="w-3.5 h-3.5 inline" /> {plantedCount} 미회수</span>
          <span className="text-green-400 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 inline" /> {resolvedCount} 회수됨</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => handleAIGenerate()}
            className="text-xs text-violet-500 hover:text-violet-700 border border-violet-200 rounded px-2 py-0.5 transition-colors flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3" />
            AI 생성
          </button>
          <button onClick={() => setIsAdding(true)} className="text-xs text-blue-500 hover:text-blue-600">+ 복선 추가</button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex px-3 py-1.5 gap-1 border-b border-gray-200">
        {(['all', 'planted', 'resolved'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-2 py-0.5 rounded transition-colors ${filter === f ? 'bg-gray-100 text-gray-800' : 'text-gray-600 hover:text-gray-600'}`}>
            {f === 'all' ? '전체' : f === 'planted' ? '미회수' : '회수됨'}
          </button>
        ))}
      </div>

      {error && (
        <div className="px-3 py-2 bg-red-50 border-b border-red-100 text-xs text-red-500">
          {error}
        </div>
      )}

      {/* Add form */}
      {isAdding && (
        <div className="px-3 py-3 border-b border-gray-200 bg-gray-50 space-y-2">
          <p className="text-xs font-medium text-gray-400">새 복선 추가</p>
          <input value={newForm.scene} onChange={e => setNewForm(f => ({ ...f, scene: e.target.value }))}
            placeholder="씬 ID (예: s001)" className="form-input text-xs" />
          <textarea value={newForm.description} onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))}
            placeholder="복선 내용 설명" rows={2} className="form-input text-xs" />
          <div className="flex gap-2">
            <select value={newForm.importance} onChange={e => setNewForm(f => ({ ...f, importance: e.target.value as ForeshadowingItem['importance'] }))}
              className="form-input text-xs flex-1">
              <option value="critical">핵심</option>
              <option value="major">중요</option>
              <option value="minor">일반</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setIsAdding(false)} className="flex-1 py-1 text-xs border border-gray-200 rounded text-gray-500 hover:bg-gray-100">취소</button>
            <button onClick={handleAddItem} disabled={!newForm.scene || !newForm.description}
              className="flex-1 py-1 text-xs bg-blue-500 hover:bg-blue-600 rounded text-white disabled:opacity-50">추가</button>
          </div>
        </div>
      )}

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {filteredItems.length === 0 ? (
          filter === 'all' ? (
            // Empty state with AI generation
            <div className="flex flex-col items-center justify-center h-full px-8 gap-3">
              <Sparkles className="w-8 h-8 text-violet-300" />
              <p className="text-sm text-gray-500 text-center">AI가 프로젝트 정보를 바탕으로 복선-회수 계획을 생성합니다</p>
              <p className="text-xs text-gray-400 text-center">캐릭터, 스토리 구조, 플롯 스레드를 자동으로 참고합니다</p>
              {!showRequirements ? (
                <div className="flex flex-col gap-2 w-full max-w-sm mt-2">
                  <button
                    onClick={() => handleAIGenerate()}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium bg-violet-500 hover:bg-violet-600 text-white rounded transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    AI로 자동 생성
                  </button>
                  <button
                    onClick={() => setShowRequirements(true)}
                    className="w-full py-2 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded transition-colors"
                  >
                    요구사항 직접 입력
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 w-full max-w-sm mt-2">
                  <textarea
                    value={aiRequirements}
                    onChange={e => setAiRequirements(e.target.value)}
                    placeholder="원하는 방향을 설명해주세요 (예: 주인공의 과거와 관련된 복선, 소품을 활용한 복선)"
                    rows={3}
                    className="w-full bg-gray-50 text-gray-800 text-xs px-3 py-2 rounded border border-gray-200 focus:outline-none focus:border-violet-400 resize-none"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => setShowRequirements(false)} className="flex-1 py-2 text-xs border border-gray-200 rounded text-gray-500 hover:bg-gray-50">취소</button>
                    <button
                      onClick={() => handleAIGenerate(aiRequirements)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium bg-violet-500 hover:bg-violet-600 text-white rounded"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      생성
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-xs text-gray-600">
              {`${STATUS_LABEL[filter]} 복선 없음`}
            </div>
          )
        ) : (
          filteredItems.map(item => (
            <div key={item.id} className="border-b border-gray-100">
              {/* Item header */}
              <div
                className="flex items-start gap-2 px-3 py-2.5 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
              >
                <span className="flex-shrink-0">{STATUS_ICON[item.status]}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono text-gray-500`}>{item.plantedIn.scene}</span>
                    <span className={`text-xs ${IMPORTANCE_COLOR[item.importance]}`}>
                      {item.importance === 'critical' ? '핵심' : item.importance === 'major' ? '중요' : '일반'}
                    </span>
                    {item.payoff && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${STRENGTH_BADGE[item.payoff.strength]}`}>
                        {item.payoff.strength === 'weak' ? '약' : item.payoff.strength === 'medium' ? '중' : '강'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5 truncate">{item.plantedIn.description}</p>
                  {item.payoff && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">↳ {item.payoff.scene}: {item.payoff.description}</p>
                  )}
                </div>
                <span className="text-gray-700 text-xs">{expandedId === item.id ? '▲' : '▼'}</span>
              </div>

              {/* Expanded */}
              {expandedId === item.id && (
                <div className="px-3 pb-3 space-y-2">
                  {item.notes && (
                    <p className="text-xs text-gray-500 bg-gray-50 rounded p-2">{item.notes}</p>
                  )}
                  {item.status === 'planted' && (
                    <ResolveForm onResolve={(scene, desc) => handleMarkResolved(item.id, scene, desc)} />
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => handleDelete(item.id)}
                      className="text-xs text-red-600 hover:text-red-400 transition-colors">삭제</button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ResolveForm({ onResolve }: { onResolve: (scene: string, description: string) => void }) {
  const [scene, setScene] = useState('');
  const [desc, setDesc] = useState('');
  const [show, setShow] = useState(false);

  if (!show) {
    return (
      <button onClick={() => setShow(true)} className="text-xs text-green-500 hover:text-green-400">+ 회수 장면 연결</button>
    );
  }

  return (
    <div className="space-y-1.5">
      <input value={scene} onChange={e => setScene(e.target.value)} placeholder="회수 씬 ID" className="form-input text-xs" />
      <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="회수 방식 설명" rows={2} className="form-input text-xs" />
      <div className="flex gap-2">
        <button onClick={() => setShow(false)} className="flex-1 py-1 text-xs border border-gray-200 rounded text-gray-500">취소</button>
        <button onClick={() => scene && desc && onResolve(scene, desc)} disabled={!scene || !desc}
          className="flex-1 py-1 text-xs bg-green-700 hover:bg-green-600 rounded text-white disabled:opacity-50">회수로 표시</button>
      </div>
    </div>
  );
}
