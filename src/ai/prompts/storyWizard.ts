/**
 * AI 스토리 마법사 프롬프트
 * 전제/장르를 입력받아 Save The Cat 15비트 + 플롯 스레드를 생성
 */

export const SYSTEM_STORY_WIZARD = `당신은 한국 영화 시나리오 구성 전문가입니다.
주어진 전제(premise)와 장르, 캐릭터 정보를 바탕으로 완성된 스토리 구조를 생성합니다.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "logline": "한 줄 요약 (30자 내외)",
  "premise": "3~5줄 시놉시스",
  "beats": [
    {
      "id": "opening_image",
      "name": "오프닝 이미지",
      "description": "이 작품에서의 구체적 설명",
      "relativePosition": 0.01,
      "act": 1
    }
  ],
  "threads": [
    {
      "name": "스레드 이름",
      "color": "#EF4444",
      "description": "스레드 설명"
    }
  ]
}

beats는 반드시 Save The Cat의 15개 비트를 모두 포함하세요:
1. opening_image (오프닝 이미지, 0.01, 1막)
2. theme_stated (주제 제시, 0.05, 1막)
3. setup (설정, 0.10, 1막)
4. catalyst (촉매, 0.12, 1막)
5. debate (고민, 0.18, 1막)
6. break_into_two (2막 진입, 0.25, 2막)
7. b_story (B 스토리, 0.27, 2막)
8. fun_and_games (재미와 게임, 0.35, 2막)
9. midpoint (미드포인트, 0.50, 2막)
10. bad_guys_close_in (적의 반격, 0.55, 2막)
11. all_is_lost (최악의 순간, 0.62, 2막)
12. dark_night (암흑의 밤, 0.68, 2막)
13. break_into_three (3막 진입, 0.75, 3막)
14. finale (피날레, 0.85, 3막)
15. final_image (마지막 이미지, 0.99, 3막)

규칙:
- 각 beat의 description은 이 특정 작품에 맞게 구체적으로 작성 (1~2줄)
- threads는 2~5개, 장르와 캐릭터에 맞게 선택
- thread의 color는 #EF4444, #F59E0B, #10B981, #3B82F6, #8B5CF6 중 선택
- JSON만 반환하고 다른 설명은 쓰지 마세요`;

export function buildWizardPrompt(
  premise: string,
  genre: string,
  characters?: { name: string; description?: string; goal?: string; flaw?: string }[],
): string {
  const parts: string[] = [];

  parts.push(`## 전제\n${premise}`);
  if (genre) parts.push(`\n## 장르\n${genre}`);

  if (characters?.length) {
    parts.push('\n## 캐릭터');
    for (const c of characters) {
      parts.push(`- **${c.name}**: ${c.description ?? '(설명 없음)'}`);
      if (c.goal) parts.push(`  목표: ${c.goal}`);
      if (c.flaw) parts.push(`  결점: ${c.flaw}`);
    }
  }

  parts.push('\n이 전제를 바탕으로 완성된 15비트 구조와 플롯 스레드를 생성해주세요.');
  return parts.join('\n');
}

export interface WizardBeat {
  id: string;
  name: string;
  description: string;
  relativePosition: number;
  act: number;
}

export interface WizardThread {
  name: string;
  color: string;
  description: string;
}

export interface WizardResult {
  logline: string;
  premise: string;
  beats: WizardBeat[];
  threads: WizardThread[];
}
