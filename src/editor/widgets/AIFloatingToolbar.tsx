import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Shuffle, MessageSquare, Zap } from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import { useAIHistoryStore } from '../../store/aiHistoryStore';
import { nanoid } from 'nanoid';
import type { SceneBlock } from '../../types/scene';
import { callAI, callAIStream } from '../../ai/aiClient';
import { useAIActivityStore } from '../../store/aiActivityStore';
import { buildEditingSystemPrompt, buildInlineAlternativesSystemPrompt } from '../../ai/prompts/editing';
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
  /** 설정 시 마운트 즉시 해당 프롬프트로 대안 생성 시작 */
  initialPrompt?: string;
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
  selectedText, anchorRect, sceneId, blockIndex, originalBlock, contextMarkdown, onApply, onClose, initialPrompt,
}: AIFloatingToolbarProps) {
  const { settings } = useProjectStore();
  const { addEntry, markApplied } = useAIHistoryStore();
  const aiActivity = useAIActivityStore();
  const [mode, setMode] = useState<ToolbarMode>('idle');
  const [instruction, setInstruction] = useState('');
  const [modifiedText, setModifiedText] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);

  const originalText = getBlockText(originalBlock);

  const buildSystemPrompt = (extra?: string) => buildEditingSystemPrompt(contextMarkdown, extra);

  const handleGenerateAlternatives = async (promptOverride?: string) => {
    setIsLoading(true);
    setError(null);
    aiActivity.start();
    const alts: Alternative[] = [
      { id: nanoid(), content: '', tone: '세련되게', isLoading: true },
      { id: nanoid(), content: '', tone: '다른 접근', isLoading: true },
      { id: nanoid(), content: '', tone: '최소 변경', isLoading: true },
    ];
    setAlternatives(alts);
    setMode('alternatives');
    try {
      const taskPrompt = promptOverride ?? '비슷하지만 더 세련되게 / 완전히 다른 접근 / 최소한의 변경';
      const systemPrompt = buildInlineAlternativesSystemPrompt(contextMarkdown);
      const userPrompt = `[원본]\n${selectedText || originalText}\n[끝]\n\n방향: ${taskPrompt}\n\n위 원본의 대안 3개를 --- 구분자로 출력:`;
      const results = await callAI(settings.ai, systemPrompt, userPrompt, 3);
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
      aiActivity.stop();
    }
  };

  // initialPrompt가 있으면 마운트 시 즉시 대안 생성
  const didAutoRun = useRef(false);
  useEffect(() => {
    if (initialPrompt && !didAutoRun.current) {
      didAutoRun.current = true;
      handleGenerateAlternatives(initialPrompt);
    }
  }, [initialPrompt]);

  const handleModify = async () => {
    if (!instruction.trim()) return;
    setIsLoading(true);
    setError(null);
    setModifiedText(null);
    aiActivity.start();
    try {
      const systemPrompt = buildSystemPrompt('요청한 수정 사항을 적용합니다.');
      const userPrompt = `원본:\n${selectedText || originalText}\n\n지시:\n${instruction}\n\n수정된 텍스트만 출력:`;
      let accumulated = '';
      for await (const chunk of callAIStream(settings.ai, systemPrompt, userPrompt, 512)) {
        accumulated += chunk;
        setModifiedText(accumulated);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 호출 실패');
    } finally {
      setIsLoading(false);
      aiActivity.stop();
    }
  };

  const handleApplyAlternative = (alt: Alternative) => {
    console.log('[AIToolbar] handleApplyAlternative called', { content: alt.content?.slice(0, 50), id: alt.id });
    try {
      onApply(alt.content);
      console.log('[AIToolbar] onApply completed');
      if (currentEntryId) markApplied(currentEntryId, alt.id);
    } catch (e) {
      console.error('[AIToolbar] apply failed:', e);
    } finally {
      onClose();
      console.log('[AIToolbar] onClose completed');
    }
  };

  if (!anchorRect) return null;

  const top = anchorRect.top - 48;
  const left = Math.max(8, Math.min(anchorRect.left, window.innerWidth - 420));
  const quickActions = settings.quickActions?.length ? settings.quickActions : DEFAULT_QUICK_ACTIONS;

  const hasResults = mode === 'alternatives' && alternatives.length > 0;

  return (
    <>
      {createPortal(
        <div className="fixed inset-0" style={{ zIndex: 9990 }} onClick={(e) => { e.stopPropagation(); if (!hasResults) onClose(); }} />,
        document.body,
      )}

      {createPortal(
        <div style={{ position: 'fixed', top, left, zIndex: 9995 }}
          className="bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
        {mode === 'idle' && (
          <div className="flex items-center gap-0.5 p-1">
            <ToolbarButton icon={<Pencil className="w-3.5 h-3.5" />} label="수정" onClick={() => setMode('modify')} />
            <ToolbarButton icon={<Shuffle className="w-3.5 h-3.5" />} label="대안 3개" onClick={() => handleGenerateAlternatives()} />
            <ToolbarButton icon={<MessageSquare className="w-3.5 h-3.5" />} label="자유 지시" onClick={() => setMode('freeform')} />
            <div className="w-px h-6 bg-gray-200 mx-0.5" />
            <ToolbarButton icon={<Zap className="w-3.5 h-3.5" />} label="빠른" onClick={() => setMode('quickactions')} hasArrow />
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

        {mode === 'alternatives' && (
          <div className="p-2 min-w-[200px] flex items-center gap-2">
            {isLoading ? (
              <span className="flex items-center gap-1.5 text-xs text-blue-500">
                <span className="flex gap-0.5">
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        animation: 'pulse-dot 1.4s ease-in-out infinite',
                        animationDelay: `${delay}ms`,
                        background: 'linear-gradient(135deg, #60a5fa, #818cf8)',
                      }}
                    />
                  ))}
                </span>
                <style>{`@keyframes pulse-dot { 0%,80%,100% { opacity:.3; transform:scale(.8) } 40% { opacity:1; transform:scale(1.2) } }`}</style>
                AI 생성 중...
              </span>
            ) : error ? (
              <span className="text-xs text-red-500">{error}</span>
            ) : (
              <span className="text-xs text-gray-400">아래에서 선택하세요</span>
            )}
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => { setMode('idle'); setError(null); setAlternatives([]); }}
                className="text-xs text-gray-400 hover:text-gray-600 whitespace-nowrap"
              >
                ← 뒤로
              </button>
              <button
                onClick={onClose}
                className="text-xs text-gray-400 hover:text-gray-600 px-1"
                title="닫기"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>,
        document.body,
      )}

      {mode === 'alternatives' && alternatives.length > 0 && createPortal(
        <div
          style={{ position: 'fixed', top: anchorRect.bottom + 8, zIndex: 9999 }}
          className="left-1/2 -translate-x-1/2 flex gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          <AlternativeCard label="현재" tone="원본" content={originalText} isCurrent onApply={() => onClose()} />
          {alternatives.map((alt, i) => (
            <AlternativeCard
              key={alt.id}
              label={`대안 ${String.fromCharCode(65 + i)}`}
              tone={alt.tone}
              content={alt.content}
              isLoading={alt.isLoading}
              onApply={() => handleApplyAlternative(alt)}
            />
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
