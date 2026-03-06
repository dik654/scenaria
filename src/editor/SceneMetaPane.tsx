import { useState } from 'react';
import type { Scene } from '../types/scene';
import { STATUS_LABELS, STATUS_BG_BUTTON, STATUS_BG_ACTIVE } from '../utils/statusMapping';
import type { SceneStatus } from '../types/scene';
import { useProjectStore } from '../store/projectStore';
import { callAI } from '../ai/aiClient';

const TONE_OPTIONS = [
  '희망적', '긴장', '슬픔', '분노', '두려움', '기쁨',
  '멜랑꼴리', '우아함', '유머', '극적', '고요함', '혼란',
];

const STATUS_ORDER: SceneStatus[] = ['outline', 'draft', 'revision', 'done'];

function tensionColor(level: number): string {
  if (level <= 3) return 'text-blue-400';
  if (level <= 6) return 'text-yellow-400';
  if (level <= 8) return 'text-orange-400';
  return 'text-red-400';
}

function tensionLabel(level: number): string {
  if (level <= 2) return '평온';
  if (level <= 4) return '잔잔';
  if (level <= 6) return '보통';
  if (level <= 8) return '긴장';
  return '폭발';
}

function TagInput({ tags, onChange, readOnly }: {
  tags: string[];
  onChange: (tags: string[]) => void;
  readOnly: boolean;
}) {
  const [inputValue, setInputValue] = useState('');

  const addTag = (value: string) => {
    const tag = value.trim();
    if (!tag || tags.includes(tag)) { setInputValue(''); return; }
    onChange([...tags, tag]);
    setInputValue('');
  };

  return (
    <div className="flex flex-wrap gap-1.5 items-center min-h-7 bg-gray-900 border border-gray-700 rounded px-2 py-1">
      {tags.map((tag) => (
        <span key={tag} className="flex items-center gap-1 bg-gray-700 rounded-full px-2 py-0.5 text-xs text-gray-300">
          {tag}
          {!readOnly && (
            <button
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className="text-gray-500 hover:text-red-400 transition-colors leading-none"
            >
              ×
            </button>
          )}
        </span>
      ))}
      {!readOnly && (
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(inputValue); }
            if (e.key === 'Backspace' && !inputValue && tags.length > 0) onChange(tags.slice(0, -1));
          }}
          onBlur={() => inputValue && addTag(inputValue)}
          placeholder={tags.length === 0 ? '태그 입력 후 Enter' : ''}
          className="bg-transparent text-xs text-gray-300 focus:outline-none min-w-20 placeholder-gray-700"
        />
      )}
    </div>
  );
}

export function SceneMetaPane({ scene, onChange, readOnly }: {
  scene: Scene;
  onChange: (updates: Partial<Scene>) => void;
  readOnly: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const { settings } = useProjectStore();
  const { meta } = scene;

  const handleAISummary = async () => {
    setSummaryLoading(true);
    try {
      const sceneText = scene.blocks
        .map((b) => {
          if ('text' in b) return b.text;
          if (b.type === 'character') return b.characterId;
          if (b.type === 'transition') return b.transitionType;
          return '';
        })
        .filter(Boolean)
        .join('\n');

      const [summary] = await callAI(
        settings.ai,
        '당신은 한국 영화 시나리오 전문 편집자입니다. 씬 내용을 읽고 핵심을 2~3줄로 요약하세요. 요약문만 반환하세요.',
        `씬 헤더: ${scene.header.interior}. ${scene.header.location} - ${scene.header.timeOfDay}\n\n${sceneText}`,
        1,
      );
      onChange({ meta: { ...meta, summary } });
    } catch (err) {
      console.error('AI 요약 생성 실패:', err);
    } finally {
      setSummaryLoading(false);
    }
  };

  const toggleTone = (tone: string) => {
    if (readOnly) return;
    const current = meta.emotionalTone ?? [];
    const next = current.includes(tone) ? current.filter((t) => t !== tone) : [...current, tone];
    onChange({ meta: { ...meta, emotionalTone: next } });
  };

  return (
    <div className="border-t border-gray-800 bg-gray-950 flex-shrink-0">
      {/* Collapsed bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-1.5 text-xs text-gray-600 hover:text-gray-400 transition-colors"
      >
        {meta.status && (
          <span className={`px-1.5 py-0.5 rounded-full text-white font-medium ${STATUS_BG_BUTTON[meta.status]}`}>
            {STATUS_LABELS[meta.status]}
          </span>
        )}
        <span className={`font-mono font-bold ${tensionColor(meta.tensionLevel ?? 5)}`}>
          긴장 {meta.tensionLevel ?? 5}/10
        </span>
        {meta.emotionalTone?.length ? (
          <span className="text-gray-600">{meta.emotionalTone.slice(0, 3).join(' · ')}</span>
        ) : null}
        {meta.summary ? (
          <span className="flex-1 truncate text-left">{meta.summary}</span>
        ) : (
          <span className="flex-1 text-gray-800 italic">씬 메모 없음</span>
        )}
        <span>{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Expanded */}
      {expanded && (
        <div className="px-4 py-3 space-y-3 border-t border-gray-800/50">
          {/* Status */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">작성 상태</label>
            <div className="flex gap-1">
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  onClick={() => !readOnly && onChange({ meta: { ...meta, status: s } })}
                  className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                    meta.status === s
                      ? `${STATUS_BG_ACTIVE[s]} text-white`
                      : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-500">씬 요약 / 메모</label>
              {!readOnly && settings.ai.apiKey && (
                <button
                  onClick={handleAISummary}
                  disabled={summaryLoading}
                  title="AI로 씬 요약 자동 생성"
                  className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-500 hover:text-red-400 hover:bg-gray-700 transition-colors disabled:opacity-40"
                >
                  {summaryLoading ? '생성 중...' : '✦ AI 요약'}
                </button>
              )}
            </div>
            <textarea
              value={meta.summary ?? ''}
              onChange={(e) => !readOnly && onChange({ meta: { ...meta, summary: e.target.value } })}
              readOnly={readOnly}
              rows={2}
              placeholder="이 씬에서 일어나는 일을 요약하세요..."
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-gray-500 resize-none placeholder-gray-700"
            />
          </div>

          {/* Tension + Minutes */}
          <div className="flex items-center gap-6">
            <div className="flex-1">
              <label className={`text-xs font-medium mb-1 flex items-center gap-2 ${tensionColor(meta.tensionLevel ?? 5)}`}>
                긴장도
                <span className="font-bold">{meta.tensionLevel ?? 5}</span>
                <span className="text-gray-600 font-normal">({tensionLabel(meta.tensionLevel ?? 5)})</span>
              </label>
              <input
                type="range"
                min={1} max={10}
                value={meta.tensionLevel ?? 5}
                onChange={(e) => !readOnly && onChange({ meta: { ...meta, tensionLevel: Number(e.target.value) } })}
                disabled={readOnly}
                className="w-full accent-red-500 cursor-pointer"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">예상 분량</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0.5} max={30} step={0.5}
                  value={meta.estimatedMinutes ?? 1}
                  onChange={(e) => !readOnly && onChange({ meta: { ...meta, estimatedMinutes: Number(e.target.value) } })}
                  readOnly={readOnly}
                  className="w-16 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none text-center"
                />
                <span className="text-xs text-gray-600">분</span>
              </div>
            </div>
          </div>

          {/* Emotional tones */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">감정 톤</label>
            <div className="flex flex-wrap gap-1.5">
              {TONE_OPTIONS.map((tone) => {
                const active = (meta.emotionalTone ?? []).includes(tone);
                return (
                  <button
                    key={tone}
                    onClick={() => toggleTone(tone)}
                    disabled={readOnly}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      active
                        ? 'border-red-600 bg-red-900/30 text-red-300'
                        : 'border-gray-700 text-gray-600 hover:border-gray-500 hover:text-gray-400'
                    }`}
                  >
                    {tone}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">태그</label>
            <TagInput
              tags={meta.tags ?? []}
              onChange={(tags) => !readOnly && onChange({ meta: { ...meta, tags } })}
              readOnly={readOnly}
            />
          </div>
        </div>
      )}
    </div>
  );
}
