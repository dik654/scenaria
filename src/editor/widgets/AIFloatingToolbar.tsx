import { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useAIHistoryStore } from '../../store/aiHistoryStore';
import { nanoid } from 'nanoid';
import type { SceneBlock } from '../../types/scene';
import { callAI } from '../../ai/aiClient';
import { ToolbarButton } from './aiToolbar/ToolbarButton';
import { AlternativeCard } from './aiToolbar/AlternativeCard';
import { ModifyMode, FreeformMode, QuickActionsMode } from './aiToolbar/ModeViews';

interface AIFloatingToolbarProps {
  selectedText: string;
  anchorRect: DOMRect | null;
  sceneId: string;
  blockIndex: number;
  originalBlock: SceneBlock;
  /** Full scene context markdown built by contextBuilder — enriches AI responses */
  contextMarkdown?: string;
  onApply: (newText: string) => void;
  onClose: () => void;
}

interface Alternative {
  id: string;
  content: string;
  tone: string;
  isLoading: boolean;
}

type ToolbarMode = 'idle' | 'modify' | 'alternatives' | 'freeform' | 'quickactions';

const DEFAULT_QUICK_ACTIONS = [
  { id: 'honorific', label: '존댓말 ↔ 반말', prompt: '이 대사를 반말로 바꿔주세요. (이미 반말이면 존댓말로)' },
  { id: 'shorten',   label: '대사 줄이기 (50%)', prompt: '이 내용을 절반 길이로 줄여주세요.' },
  { id: 'emotional', label: '더 감정적으로', prompt: '이 내용을 더 감정적으로 만들어주세요.' },
  { id: 'dry',       label: '더 건조하게', prompt: '이 내용을 더 건조하고 사무적으로 만들어주세요.' },
  { id: 'show',      label: '대사→지문', prompt: '이 대사를 "보여주기(show)"로 지문으로 변환해주세요.' },
  { id: 'subtext',   label: '서브텍스트 추가', prompt: '이 대사에 서브텍스트를 추가해주세요.' },
  { id: 'visual',    label: '시각적으로 묘사', prompt: '이 내용을 더 시각적으로 묘사해주세요.' },
];

function getBlockText(block: SceneBlock): string {
  if ('text' in block) return block.text;
  if (block.type === 'character') return block.characterId;
  if (block.type === 'transition') return block.transitionType;
  return '';
}

export function AIFloatingToolbar({
  selectedText, anchorRect, sceneId, blockIndex, originalBlock, contextMarkdown, onApply, onClose,
}: AIFloatingToolbarProps) {
  const { settings } = useProjectStore();
  const { addEntry, markApplied } = useAIHistoryStore();
  const [mode, setMode] = useState<ToolbarMode>('idle');
  const [instruction, setInstruction] = useState('');
  const [modifiedText, setModifiedText] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);

  const originalText = getBlockText(originalBlock);

  const invokeAI = async (prompt: string): Promise<string[]> => {
    const systemPrompt = [
      '당신은 한국 영화 시나리오 전문 편집자입니다.',
      '요청한 수정 사항을 적용하고, 원본과 다른 3가지 버전을 제공합니다.',
      '각 버전은 JSON 배열로 반환하세요: ["버전1", "버전2", "버전3"]',
      '원본 텍스트의 언어와 형식을 유지하세요.',
      ...(contextMarkdown ? ['\n## 씬 컨텍스트 (참고용)\n', contextMarkdown] : []),
    ].join('\n');
    return callAI(settings.ai, systemPrompt, `원본:\n${selectedText || originalText}\n\n지시:\n${prompt}\n\n3가지 버전을 JSON 배열로:`, 3);
  };

  const handleGenerateAlternatives = async (promptOverride?: string) => {
    setIsLoading(true);
    setError(null);
    const alts: Alternative[] = [
      { id: nanoid(), content: '', tone: '세련되게', isLoading: true },
      { id: nanoid(), content: '', tone: '다른 접근', isLoading: true },
      { id: nanoid(), content: '', tone: '최소 변경', isLoading: true },
    ];
    setAlternatives(alts);
    setMode('alternatives');
    try {
      const prompt = promptOverride ?? `아래 텍스트의 대안 3가지를 작성하세요:\nA: 비슷하지만 더 세련되게\nB: 완전히 다른 접근\nC: 최소한의 변경`;
      const results = await invokeAI(prompt);
      const tones = ['세련되게', '다른 접근', '최소 변경'];
      const filled = alts.map((a, i) => ({ ...a, content: results[i] ?? results[0] ?? originalText, isLoading: false, tone: tones[i] }));
      setAlternatives(filled);
      const entryId = nanoid();
      setCurrentEntryId(entryId);
      addEntry({ sceneId, blockIndex, original: originalText, alternatives: filled.map((a) => ({ id: a.id, content: a.content, tone: a.tone, applied: false })), appliedId: null, instruction: prompt });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 호출 실패');
      setAlternatives([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModify = async () => {
    if (!instruction.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const results = await invokeAI(instruction);
      setModifiedText(results[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 호출 실패');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyAlternative = (alt: Alternative) => {
    onApply(alt.content);
    if (currentEntryId) markApplied(currentEntryId, alt.id);
    onClose();
  };

  if (!anchorRect) return null;

  const top = anchorRect.top - 48;
  const left = Math.max(8, Math.min(anchorRect.left, window.innerWidth - 420));
  const quickActions = settings.quickActions?.length ? settings.quickActions : DEFAULT_QUICK_ACTIONS;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div style={{ position: 'fixed', top, left, zIndex: 50 }}
        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden"
      >
        {mode === 'idle' && (
          <div className="flex items-center gap-0.5 p-1">
            <ToolbarButton icon="✏️" label="수정" onClick={() => setMode('modify')} />
            <ToolbarButton icon="🔀" label="대안 3개" onClick={() => handleGenerateAlternatives()} />
            <ToolbarButton icon="💬" label="자유 지시" onClick={() => setMode('freeform')} />
            <div className="w-px h-6 bg-gray-700 mx-0.5" />
            <ToolbarButton icon="⚡" label="빠른" onClick={() => setMode('quickactions')} hasArrow />
          </div>
        )}

        {mode === 'modify' && (
          <ModifyMode
            instruction={instruction}
            onInstruction={setInstruction}
            modifiedText={modifiedText}
            originalText={originalText}
            isLoading={isLoading}
            error={error}
            onModify={handleModify}
            onApply={() => { if (modifiedText) { onApply(modifiedText); onClose(); } }}
            onCancel={() => setModifiedText(null)}
            onClose={() => setMode('idle')}
          />
        )}

        {mode === 'freeform' && (
          <FreeformMode
            instruction={instruction}
            onInstruction={setInstruction}
            isLoading={isLoading}
            error={error}
            onGenerate={() => handleGenerateAlternatives(instruction)}
            onClose={() => setMode('idle')}
          />
        )}

        {mode === 'quickactions' && (
          <QuickActionsMode
            actions={quickActions}
            onSelect={(prompt) => handleGenerateAlternatives(prompt)}
            onClose={() => setMode('idle')}
          />
        )}
      </div>

      {mode === 'alternatives' && (alternatives.length > 0 || isLoading) && (
        <div style={{
          position: 'fixed',
          top: anchorRect.bottom + 8,
          left: Math.max(8, Math.min(anchorRect.left - 16, window.innerWidth - 900)),
          zIndex: 50,
        }} className="flex gap-3">
          <AlternativeCard label="현재" tone="원본" content={originalText} isCurrent onApply={() => onClose()} />
          {isLoading && alternatives.length === 0
            ? [0, 1, 2].map((i) => <AlternativeCard key={i} label={`대안 ${String.fromCharCode(65 + i)}`} tone="..." content="" isLoading />)
            : alternatives.map((alt, i) => (
                <AlternativeCard
                  key={alt.id}
                  label={`대안 ${String.fromCharCode(65 + i)}`}
                  tone={alt.tone}
                  content={alt.content}
                  isLoading={alt.isLoading}
                  onApply={() => handleApplyAlternative(alt)}
                />
              ))
          }
        </div>
      )}
    </>
  );
}
