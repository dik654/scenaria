import { useEffect, useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { fileIO } from '../io';
import type { ForeshadowingIndex, ForeshadowingItem } from '../types/story';
import { nanoid } from 'nanoid';
import { useConfirm } from '../components/ConfirmDialog';

const STATUS_ICON: Record<string, string> = {
  planted: '🔗',
  resolved: '✅',
  abandoned: '❌',
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
  weak: 'bg-yellow-900/40 text-yellow-500',
  medium: 'bg-blue-900/40 text-blue-400',
  strong: 'bg-green-900/40 text-green-400',
};

export function ForeshadowingManager() {
  const { dirHandle } = useProjectStore();
  const confirm = useConfirm();
  const [data, setData] = useState<ForeshadowingIndex | null>(null);
  const [filter, setFilter] = useState<'all' | 'planted' | 'resolved'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newForm, setNewForm] = useState({ scene: '', description: '', importance: 'major' as ForeshadowingItem['importance'] });

  useEffect(() => {
    if (!dirHandle) return;
    fileIO.readJSON<ForeshadowingIndex>(dirHandle, 'story/foreshadowing.json')
      .then(setData)
      .catch(() => setData({ items: [] }));
  }, [dirHandle]);

  const save = async (updated: ForeshadowingIndex) => {
    if (!dirHandle) return;
    await fileIO.writeJSON(dirHandle, 'story/foreshadowing.json', updated);
    setData(updated);
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

  const filteredItems = (data?.items ?? []).filter(item =>
    filter === 'all' || item.status === filter
  );

  const plantedCount = data?.items.filter(i => i.status === 'planted').length ?? 0;
  const resolvedCount = data?.items.filter(i => i.status === 'resolved').length ?? 0;

  return (
    <div className="flex flex-col h-full">
      {/* Summary */}
      <div className="px-3 py-2 border-b border-gray-800 flex items-center gap-3">
        <div className="flex gap-3 text-xs">
          <span className="text-yellow-400">🔗 {plantedCount} 미회수</span>
          <span className="text-green-400">✅ {resolvedCount} 회수됨</span>
        </div>
        <button onClick={() => setIsAdding(true)} className="ml-auto text-xs text-red-500 hover:text-red-400">+ 복선 추가</button>
      </div>

      {/* Filter */}
      <div className="flex px-3 py-1.5 gap-1 border-b border-gray-800">
        {(['all', 'planted', 'resolved'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-2 py-0.5 rounded transition-colors ${filter === f ? 'bg-gray-700 text-white' : 'text-gray-600 hover:text-gray-400'}`}>
            {f === 'all' ? '전체' : f === 'planted' ? '미회수' : '회수됨'}
          </button>
        ))}
      </div>

      {/* Add form */}
      {isAdding && (
        <div className="px-3 py-3 border-b border-gray-800 bg-gray-900/50 space-y-2">
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
            <button onClick={() => setIsAdding(false)} className="flex-1 py-1 text-xs border border-gray-700 rounded text-gray-500 hover:bg-gray-800">취소</button>
            <button onClick={handleAddItem} disabled={!newForm.scene || !newForm.description}
              className="flex-1 py-1 text-xs bg-red-600 hover:bg-red-700 rounded text-white disabled:opacity-50">추가</button>
          </div>
        </div>
      )}

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {filteredItems.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-600">
            {filter === 'all' ? '복선이 없습니다' : `${STATUS_LABEL[filter]} 복선 없음`}
          </div>
        ) : (
          filteredItems.map(item => (
            <div key={item.id} className="border-b border-gray-800/50">
              {/* Item header */}
              <div
                className="flex items-start gap-2 px-3 py-2.5 cursor-pointer hover:bg-gray-900/30"
                onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
              >
                <span className="text-base flex-shrink-0">{STATUS_ICON[item.status]}</span>
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
                  <p className="text-xs text-gray-300 mt-0.5 truncate">{item.plantedIn.description}</p>
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
                    <p className="text-xs text-gray-500 bg-gray-800/50 rounded p-2">{item.notes}</p>
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
        <button onClick={() => setShow(false)} className="flex-1 py-1 text-xs border border-gray-700 rounded text-gray-500">취소</button>
        <button onClick={() => scene && desc && onResolve(scene, desc)} disabled={!scene || !desc}
          className="flex-1 py-1 text-xs bg-green-700 hover:bg-green-600 rounded text-white disabled:opacity-50">회수로 표시</button>
      </div>
    </div>
  );
}
