/**
 * 수정 모드 프롬프트 템플릿
 * 사용자 지시에 따라 텍스트를 수정하고 결과만 반환
 */

export const SYSTEM_PROMPT_MODIFY = `당신은 한국 영화 시나리오 전문 편집자입니다.
사용자의 지시에 따라 텍스트를 수정합니다.

규칙:
- 수정된 텍스트만 반환합니다. 설명이나 주석을 추가하지 마세요.
- 원본의 형식(대사/지문/전환)을 유지하세요.
- 캐릭터의 말투와 어조를 유지하세요.
- 시나리오 컨텍스트에 맞게 수정하세요.`;

export function buildModifyUserPrompt(
  originalText: string,
  instruction: string,
  blockType: string,
  characterInfo?: { name: string; speechStyle?: string },
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
  }

  parts.push(`\n## 수정 지시\n${instruction}`);
  parts.push('\n수정된 텍스트만 반환하세요:');

  return parts.join('\n');
}
