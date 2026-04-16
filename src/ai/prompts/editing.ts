/**
 * 인라인 편집 AI 프롬프트
 * AIFloatingToolbar에서 사용하는 수정/대안 생성 프롬프트
 */

/**
 * 인라인 수정용 시스템 프롬프트 빌더.
 * @param contextMarkdown 씬 컨텍스트 마크다운 (선택)
 * @param extra 추가 지시사항 (선택)
 */
export function buildEditingSystemPrompt(contextMarkdown?: string, extra?: string): string {
  return [
    '당신은 한국 영화 시나리오 전문 편집자입니다.',
    extra ?? '요청한 수정 사항을 적용한 버전 하나만 제공합니다.',
    '수정된 텍스트만 출력하세요. 설명, 따옴표, 번호 없이 순수 텍스트만.',
    ...(contextMarkdown ? ['\n## 씬 컨텍스트 (참고용)\n', contextMarkdown] : []),
  ].join('\n');
}

/**
 * 대안 3개 생성용 시스템 프롬프트 빌더.
 * @param contextMarkdown 씬 컨텍스트 마크다운 (선택)
 */
export function buildInlineAlternativesSystemPrompt(contextMarkdown?: string): string {
  return [
    '시나리오 편집자. 주어진 대사나 지문을 3가지 버전으로 다시 써라.',
    '규칙: 수정된 텍스트만 출력. 설명/번호/따옴표 금지. 버전 사이는 반드시 --- 한 줄로 구분.',
    ...(contextMarkdown ? ['[컨텍스트]', contextMarkdown] : []),
  ].join('\n');
}
