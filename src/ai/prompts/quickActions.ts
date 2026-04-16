/**
 * 빠른 액션 프롬프트 프리셋
 * settings.json에서 커스텀 가능
 */

export interface QuickActionPreset {
  id: string;
  label: string;
  prompt: string;
  category?: 'tone' | 'style' | 'transform' | 'analysis';
}

export const DEFAULT_QUICK_ACTIONS: QuickActionPreset[] = [
  {
    id: 'qa-honorific',
    label: '존댓말 ↔ 반말',
    prompt: '이 대사의 높임법을 전환하세요. 존댓말이면 반말로, 반말이면 존댓말로 바꿔주세요. 캐릭터의 성격은 유지하세요.',
    category: 'style',
  },
  {
    id: 'qa-shorten',
    label: '대사 줄이기 (50%)',
    prompt: '이 내용을 절반 길이로 줄여주세요. 핵심 메시지와 감정은 유지하면서 군더더기를 제거하세요.',
    category: 'style',
  },
  {
    id: 'qa-emotional',
    label: '더 감정적으로',
    prompt: '이 내용을 더 감정적으로 만들어주세요. 감정의 강도를 높이되 과장되지 않게.',
    category: 'tone',
  },
  {
    id: 'qa-dry',
    label: '더 건조하게',
    prompt: '이 내용을 더 건조하고 사무적으로 만들어주세요. 감정을 절제하고 사실 위주로.',
    category: 'tone',
  },
  {
    id: 'qa-show',
    label: '대사→지문 (보여주기)',
    prompt: '이 대사의 내용을 직접 말하지 않고 행동과 지문으로 "보여주기(show)"로 변환하세요. 시나리오 지문체로 작성하세요.',
    category: 'transform',
  },
  {
    id: 'qa-novel-to-script',
    label: '소설체→시나리오 지문체',
    prompt: '이 소설체 묘사를 시나리오 지문체로 변환하세요. 현재 시제, 간결한 문장, 카메라가 볼 수 있는 것만.',
    category: 'transform',
  },
  {
    id: 'qa-subtext',
    label: '서브텍스트 추가',
    prompt: '이 대사에 서브텍스트를 추가하세요. 말의 표면과 속뜻이 다르게, 캐릭터가 진짜 의도를 숨기는 대사로.',
    category: 'style',
  },
  {
    id: 'qa-visual',
    label: '시각적으로 묘사',
    prompt: '이 내용을 더 시각적으로 묘사하세요. 카메라에 잡히는 구체적 이미지 중심으로.',
    category: 'style',
  },
];

export const SYSTEM_PROMPT_QUICK_ACTION = `당신은 한국 영화 시나리오 전문 편집자입니다.
요청받은 빠른 수정을 적용합니다.

규칙:
- 3가지 버전을 JSON 배열로 반환: ["버전1", "버전2", "버전3"]
- 각 버전은 약간씩 다른 해석으로
- 다른 설명 없이 JSON 배열만 반환합니다.`;
