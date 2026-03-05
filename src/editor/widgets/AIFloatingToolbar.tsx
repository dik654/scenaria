import { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useAIHistoryStore } from '../../store/aiHistoryStore';
import { nanoid } from 'nanoid';
import type { SceneBlock } from '../../types/scene';
import { InlineDiff } from './InlineDiff';

interface AIFloatingToolbarProps {
  selectedText: string;
  anchorRect: DOMRect | null;
  sceneId: string;
  blockIndex: number;
  originalBlock: SceneBlock;
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

const QUICK_ACTIONS = [
  { id: 'honorific', label: '존댓말 ↔ 반말', prompt: '이 대사를 반말로 바꿔주세요. (이미 반말이면 존댓말로)' },
  { id: 'shorten', label: '대사 줄이기 (50%)', prompt: '이 내용을 절반 길이로 줄여주세요.' },
  { id: 'emotional', label: '더 감정적으로', prompt: '이 내용을 더 감정적으로 만들어주세요.' },
  { id: 'dry', label: '더 건조하게', prompt: '이 내용을 더 건조하고 사무적으로 만들어주세요.' },
  { id: 'show', label: '대사→지문', prompt: '이 대사를 "보여주기(show)"로 지문으로 변환해주세요.' },
  { id: 'subtext', label: '서브텍스트 추가', prompt: '이 대사에 서브텍스트를 추가해주세요.' },
  { id: 'visual', label: '시각적으로 묘사', prompt: '이 내용을 더 시각적으로 묘사해주세요.' },
];

function getBlockText(block: SceneBlock): string {
  if ('text' in block) return block.text;
  if (block.type === 'character') return block.characterId;
  if (block.type === 'transition') return block.transitionType;
  return '';
}

export function AIFloatingToolbar({
  selectedText,
  anchorRect,
  sceneId,
  blockIndex,
  originalBlock,
  onApply,
  onClose,
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
  const inputRef = useRef<HTMLInputElement>(null);

  const originalText = getBlockText(originalBlock);

  useEffect(() => {
    if (mode === 'modify' || mode === 'freeform') {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [mode]);

  const callAI = async (prompt: string): Promise<string[]> => {
    const { ai } = settings;
    if (!ai.apiKey && ai.provider !== 'local-vllm') {
      throw new Error('AI API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.');
    }

    const systemPrompt = `당신은 한국 영화 시나리오 전문 편집자입니다.
요청한 수정 사항을 적용하고, 원본과 다른 3가지 버전을 제공합니다.
각 버전은 JSON 배열로 반환하세요: ["버전1", "버전2", "버전3"]
원본 텍스트의 언어와 형식을 유지하세요.`;

    const response = await fetch(
      ai.provider === 'claude'
        ? 'https://api.anthropic.com/v1/messages'
        : ai.endpoint ?? 'http://localhost:8000/v1/messages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(ai.provider === 'claude' ? { 'x-api-key': ai.apiKey!, 'anthropic-version': '2023-06-01' } : {}),
          ...(ai.provider === 'openai' ? { Authorization: `Bearer ${ai.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: ai.model ?? 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: 'user', content: `원본:\n${selectedText || originalText}\n\n지시:\n${prompt}\n\n3가지 버전을 JSON 배열로:` }],
        }),
      }
    );

    if (!response.ok) throw new Error(`AI 호출 실패: ${response.status}`);
    const data = await response.json();
    const content = ai.provider === 'openai'
      ? data.choices[0].message.content
      : data.content[0].text;

    const match = content.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]) as string[];
      return parsed.slice(0, 3);
    }
    return [content.trim()];
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

    try {
      const prompt = promptOverride
        ?? `아래 텍스트의 대안 3가지를 작성하세요:\nA: 비슷하지만 더 세련되게\nB: 완전히 다른 접근\nC: 최소한의 변경`;

      const results = await callAI(prompt);
      const tones = ['세련되게', '다른 접근', '최소 변경'];
      const filled = alts.map((a, i) => ({
        ...a,
        content: results[i] ?? results[0] ?? originalText,
        isLoading: false,
        tone: tones[i],
      }));
      setAlternatives(filled);

      const entryId = nanoid();
      setCurrentEntryId(entryId);
      addEntry({
        sceneId,
        blockIndex,
        original: originalText,
        alternatives: filled.map((a) => ({ id: a.id, content: a.content, tone: a.tone, applied: false })),
        appliedId: null,
        instruction: prompt,
      });
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
      const results = await callAI(instruction);
      setModifiedText(results[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 호출 실패');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyModified = () => {
    if (!modifiedText) return;
    onApply(modifiedText);
    onClose();
  };

  const handleApplyAlternative = (alt: Alternative) => {
    onApply(alt.content);
    if (currentEntryId) markApplied(currentEntryId, alt.id);
    onClose();
  };

  if (!anchorRect) return null;

  const top = anchorRect.top - 48;
  const left = Math.max(8, Math.min(anchorRect.left, window.innerWidth - 420));

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Main toolbar */}
      <div
        style={{ position: 'fixed', top, left, zIndex: 50 }}
        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden"
      >
        {mode === 'idle' && (
          <div className="flex items-center gap-0.5 p-1">
            <ToolbarButton icon="✏️" label="수정" onClick={() => setMode('modify')} />
            <ToolbarButton icon="🔀" label="대안 3개" onClick={() => { setMode('alternatives'); handleGenerateAlternatives(); }} />
            <ToolbarButton icon="💬" label="자유 지시" onClick={() => setMode('freeform')} />
            <div className="w-px h-6 bg-gray-700 mx-0.5" />
            <ToolbarButton icon="⚡" label="빠른" onClick={() => setMode('quickactions')} hasArrow />
          </div>
        )}

        {mode === 'modify' && (
          <div className="p-3 w-80">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-400">✏️ 수정 지시</span>
              <button onClick={() => setMode('idle')} className="ml-auto text-gray-600 hover:text-gray-400 text-xs">✕</button>
            </div>
            <input
              ref={inputRef}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleModify()}
              placeholder="예: 더 긴박하게, 말투를 바꿔서..."
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500 mb-2"
            />
            {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
            {modifiedText ? (
              <>
                <InlineDiff original={originalText} modified={modifiedText} />
                <div className="flex gap-2 mt-2">
                  <button onClick={() => setModifiedText(null)} className="flex-1 text-xs py-1.5 border border-gray-600 rounded-lg text-gray-400 hover:bg-gray-800">취소</button>
                  <button onClick={handleApplyModified} className="flex-1 text-xs py-1.5 bg-green-700 rounded-lg text-white hover:bg-green-600">적용</button>
                </div>
              </>
            ) : (
              <button
                onClick={handleModify}
                disabled={!instruction.trim() || isLoading}
                className="w-full text-xs py-2 bg-red-600 rounded-lg text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isLoading ? '생성 중...' : 'AI에게 수정 요청'}
              </button>
            )}
          </div>
        )}

        {mode === 'freeform' && (
          <div className="p-3 w-80">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-400">💬 자유 지시</span>
              <button onClick={() => setMode('idle')} className="ml-auto text-gray-600 hover:text-gray-400 text-xs">✕</button>
            </div>
            <input
              ref={inputRef}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleGenerateAlternatives(instruction)}
              placeholder="자유롭게 지시하세요..."
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500 mb-2"
            />
            {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
            <button
              onClick={() => handleGenerateAlternatives(instruction)}
              disabled={!instruction.trim() || isLoading}
              className="w-full text-xs py-2 bg-red-600 rounded-lg text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isLoading ? '생성 중...' : '대안 생성'}
            </button>
          </div>
        )}

        {mode === 'quickactions' && (
          <div className="w-52 py-1">
            {QUICK_ACTIONS.map((qa) => (
              <button
                key={qa.id}
                onClick={() => { setMode('alternatives'); handleGenerateAlternatives(qa.prompt); }}
                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
              >
                {qa.label}
              </button>
            ))}
            <div className="border-t border-gray-700 mt-1 pt-1">
              <button onClick={() => setMode('idle')} className="w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:text-gray-400">← 뒤로</button>
            </div>
          </div>
        )}
      </div>

      {/* Alternatives panel */}
      {mode === 'alternatives' && (alternatives.length > 0 || isLoading) && (
        <div
          style={{
            position: 'fixed',
            top: anchorRect.bottom + 8,
            left: Math.max(8, Math.min(anchorRect.left - 16, window.innerWidth - 900)),
            zIndex: 50,
          }}
          className="flex gap-3"
        >
          {/* Original */}
          <AlternativeCard
            label="현재"
            tone="원본"
            content={originalText}
            isCurrent
            onApply={() => onClose()}
          />
          {/* Alternatives */}
          {isLoading && alternatives.length === 0
            ? [0, 1, 2].map((i) => (
                <AlternativeCard key={i} label={`대안 ${String.fromCharCode(65 + i)}`} tone="..." content="" isLoading />
              ))
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

function ToolbarButton({ icon, label, onClick, hasArrow }: {
  icon: string; label: string; onClick: () => void; hasArrow?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
    >
      <span>{icon}</span>
      <span>{label}</span>
      {hasArrow && <span className="text-gray-600">▾</span>}
    </button>
  );
}

function AlternativeCard({ label, tone, content, isCurrent, isLoading, onApply }: {
  label: string; tone: string; content: string; isCurrent?: boolean; isLoading?: boolean; onApply?: () => void;
}) {
  return (
    <div className={`w-52 bg-gray-900 border rounded-xl p-3 shadow-xl flex flex-col gap-2 ${isCurrent ? 'border-gray-600' : 'border-gray-700'}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-400">{label}</span>
        <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded-full">{tone}</span>
      </div>
      <div className="flex-1 min-h-16">
        {isLoading ? (
          <div className="animate-pulse space-y-1">
            <div className="h-2 bg-gray-700 rounded w-full" />
            <div className="h-2 bg-gray-700 rounded w-4/5" />
            <div className="h-2 bg-gray-700 rounded w-3/5" />
          </div>
        ) : (
          <p className="text-xs text-gray-200 leading-relaxed whitespace-pre-wrap break-words">{content}</p>
        )}
      </div>
      {!isCurrent && !isLoading && onApply && (
        <button
          onClick={onApply}
          className="w-full text-xs py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-lg transition-colors"
        >
          적용
        </button>
      )}
      {isCurrent && (
        <div className="text-center text-xs text-gray-600">✓ 현재</div>
      )}
    </div>
  );
}
