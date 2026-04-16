/**
 * 씬 메타 정보 AI 프롬프트
 * 요약 생성 + 사전 계획 메모
 */

import { buildContextSection, type ProjectContext } from './visualizationGen';

/** 기존 씬 내용을 읽고 요약하는 프롬프트 */
export const SYSTEM_SCENE_SUMMARY = '당신은 한국 영화 시나리오 전문 편집자입니다. 씬 내용을 읽고 핵심을 2~3줄로 요약하세요. 요약문만 반환하세요.';

/** 스토리 컨텍스트 기반으로 씬 계획 메모를 작성하는 프롬프트 */
export const SYSTEM_SCENE_PLAN_MEMO = `당신은 한국 영화 시나리오 구성 전문가입니다.
주어진 스토리 컨텍스트와 씬 위치를 바탕으로, 이 씬에서 일어나야 할 일을 계획하는 메모를 2~4줄로 작성하세요.
포함할 내용:
- 핵심 사건 또는 갈등
- 관련 캐릭터의 역할과 행동
- 이 씬이 전체 이야기에서 수행하는 기능
메모만 반환하세요. 설명이나 번호 없이 자연스러운 문장으로.`;

/** 씬 계획 메모 생성을 위한 유저 프롬프트 빌더 */
export function buildScenePlanMemoPrompt(
  ctx: ProjectContext,
  scenePosition?: { current: number; total: number },
  currentBeat?: { name: string; description: string },
  prevSceneSummaries?: string[],
  nextSceneSummaries?: string[],
): string {
  const parts = [buildContextSection(ctx)];

  if (scenePosition) {
    parts.push(`## 현재 씬 위치\n전체 ${scenePosition.total}씬 중 ${scenePosition.current}번째\n`);
  }

  if (currentBeat) {
    parts.push(`## 현재 비트\n**${currentBeat.name}**: ${currentBeat.description}\n`);
  }

  if (prevSceneSummaries?.length) {
    parts.push('## 이전 씬 메모');
    prevSceneSummaries.forEach((s, i) => parts.push(`${i + 1}. ${s}`));
    parts.push('');
  }

  if (nextSceneSummaries?.length) {
    parts.push('## 다음 씬 메모');
    nextSceneSummaries.forEach((s, i) => parts.push(`${i + 1}. ${s}`));
    parts.push('');
  }

  parts.push('이 씬에서 일어나야 할 일을 계획하는 메모를 작성해주세요.');
  return parts.join('\n');
}
