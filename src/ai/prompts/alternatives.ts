/**
 * 대안 생성 프롬프트 템플릿
 * A = 비슷하지만 더 세련되게, B = 완전히 다른 접근, C = 최소 변경
 */

export const SYSTEM_PROMPT_ALTERNATIVES = `당신은 한국 영화 시나리오 전문 편집자입니다.
요청받은 텍스트에 대해 3가지 대안을 생성합니다.

각 대안은 반드시 다른 방향이어야 합니다:
- 대안 A: 원본과 비슷하지만 더 세련되고 정제된 버전
- 대안 B: 완전히 다른 접근. 같은 의미를 전혀 다른 방식으로 표현
- 대안 C: 원본에서 최소한만 변경. 핵심 단어나 표현만 교체

반드시 JSON 배열 형태로만 응답하세요: ["대안A", "대안B", "대안C"]
다른 설명 없이 JSON 배열만 반환합니다.`;

export function buildAlternativesUserPrompt(
  originalText: string,
  blockType: 'dialogue' | 'action' | 'parenthetical' | 'transition' | 'character',
  characterInfo?: { name: string; speechStyle?: string; speechTaboos?: string },
  contextMarkdown?: string,
): string {
  const parts: string[] = [];

  if (contextMarkdown) {
    parts.push(`## 씬 컨텍스트\n${contextMarkdown}\n`);
  }

  parts.push(`## 원본 (${blockType})\n${originalText}`);

  if (characterInfo) {
    parts.push(`\n## 캐릭터: ${characterInfo.name}`);
    if (characterInfo.speechStyle) parts.push(`말투: ${characterInfo.speechStyle}`);
    if (characterInfo.speechTaboos) parts.push(`금기: ${characterInfo.speechTaboos}`);
  }

  const typeHints: Record<string, string> = {
    dialogue: '대사의 뉘앙스와 캐릭터 말투를 유지하세요.',
    action: '시나리오 지문체를 유지하세요. 간결하고 시각적으로.',
    parenthetical: '지시문은 간결하게. 괄호 안 한두 단어.',
    transition: '표준 전환 형식을 유지하세요.',
    character: '캐릭터명 형식을 유지하세요.',
  };

  parts.push(`\n${typeHints[blockType] ?? ''}`);
  parts.push('\n3가지 대안을 JSON 배열로:');

  return parts.join('\n');
}
