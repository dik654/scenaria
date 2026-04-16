/**
 * 시각화 패널 AI 생성 프롬프트
 * BeatBoard, PlotThreadTimeline, ForeshadowingManager 에서 사용
 */

// ── 공통 컨텍스트 타입 ──

export interface ProjectContext {
  meta?: { title?: string; logline?: string; genre?: string[] };
  characters?: { name: string; description?: string; goal?: string; flaw?: string; arc?: string; traits?: string[] }[];
  scenes?: { id: string; number: number; location: string; summary?: string; timeOfDay: string }[];
  existingThreads?: { name: string; description: string }[];
  existingBeats?: { id: string; name: string; description: string }[];
  existingForeshadowing?: { description: string; status: string; importance: string }[];
}

// ── BeatBoard ──

export const SYSTEM_BEAT_GENERATION = `당신은 한국 영화 시나리오 구성 전문가입니다.
주어진 작품 정보를 바탕으로 Save The Cat 15비트 각각에 대한 구체적인 씬 설명을 생성합니다.

절대 규칙:
- 반드시 사용자가 제공한 캐릭터, 설정, 로그라인만 사용하세요.
- 제공되지 않은 캐릭터 이름이나 외부 작품/인물을 절대 사용하지 마세요.
- 인터넷이나 기존 작품에서 가져온 내용을 포함하지 마세요.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "beatDescriptions": {
    "opening_image": "이 작품에서의 구체적 오프닝 이미지 설명",
    "theme_stated": "...",
    "setup": "...",
    "catalyst": "...",
    "debate": "...",
    "break_into_two": "...",
    "b_story": "...",
    "fun_and_games": "...",
    "midpoint": "...",
    "bad_guys": "...",
    "all_is_lost": "...",
    "dark_night": "...",
    "break_into_three": "...",
    "finale": "...",
    "final_image": "..."
  },
  "suggestedScenes": {
    "opening_image": [{ "location": "장소", "summary": "씬 요약", "timeOfDay": "DAY" }],
    "theme_stated": [{ "location": "...", "summary": "...", "timeOfDay": "DAY" }]
  }
}

형식 규칙:
- 15개 비트 ID를 모두 포함: opening_image, theme_stated, setup, catalyst, debate, break_into_two, b_story, fun_and_games, midpoint, bad_guys, all_is_lost, dark_night, break_into_three, finale, final_image
- beatDescriptions: 각 비트에 대해 이 특정 작품에 맞는 1~2줄 설명
- suggestedScenes: 각 비트에 대해 1~2개의 씬 제안 (location, summary, timeOfDay)
- timeOfDay: DAY, NIGHT, DAWN, DUSK 중 선택
- 제공된 캐릭터 이름만 구체적으로 사용하세요
- 한국어로 작성
- JSON만 반환하고 다른 설명은 쓰지 마세요`;

export interface BeatGenResult {
  beatDescriptions: Record<string, string>;
  suggestedScenes: Record<string, { location: string; summary: string; timeOfDay: string }[]>;
}

// ── PlotThread ──

export const SYSTEM_THREAD_GENERATION = `당신은 한국 영화 시나리오 구성 전문가입니다.
주어진 작품 정보를 바탕으로 플롯 스레드(서사 라인)를 생성합니다.

절대 규칙:
- 반드시 사용자가 제공한 캐릭터, 설정, 로그라인만 사용하세요.
- 제공되지 않은 캐릭터 이름이나 외부 작품/인물을 절대 사용하지 마세요.
- 인터넷이나 기존 작품에서 가져온 내용을 포함하지 마세요.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "threads": [
    {
      "name": "스레드 이름",
      "color": "#EF4444",
      "description": "스레드의 핵심 갈등과 전개 방향 설명"
    }
  ]
}

형식 규칙:
- 3~6개의 스레드 생성
- color는 다음 중 선택: #EF4444, #F59E0B, #10B981, #3B82F6, #8B5CF6, #EC4899, #14B8A6, #F97316
- 각 스레드에 고유한 색상 배정
- 주 스레드(A Story), 보조 스레드(B Story), 캐릭터 내면 갈등, 테마적 스레드 등 다양하게
- description: 2~3줄로 갈등 구조와 전개 방향 설명
- JSON만 반환하고 다른 설명은 쓰지 마세요`;

export interface ThreadGenResult {
  threads: {
    name: string;
    color: string;
    description: string;
  }[];
}

// ── Foreshadowing ──

export const SYSTEM_FORESHADOWING_GENERATION = `당신은 한국 영화 시나리오 구성 전문가입니다.
주어진 작품 정보를 바탕으로 복선(foreshadowing)과 회수(payoff) 계획을 생성합니다.

절대 규칙:
- 반드시 사용자가 제공한 캐릭터, 설정, 로그라인만 사용하세요.
- 제공되지 않은 캐릭터 이름이나 외부 작품/인물을 절대 사용하지 마세요.
- 인터넷이나 기존 작품에서 가져온 내용을 포함하지 마세요.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "items": [
    {
      "plantDescription": "복선 내용 (어떤 장면/대사/소품으로 심어지는지)",
      "payoffDescription": "회수 방법 (어떻게 다시 등장하여 의미를 갖는지)",
      "strength": "medium",
      "importance": "major",
      "notes": "선택적 메모"
    }
  ]
}

형식 규칙:
- 5~10개의 복선-회수 쌍 생성
- importance: "critical" (핵심 반전), "major" (중요 서사), "minor" (디테일)
- strength: "weak" (은은한 암시), "medium" (알아챌 수 있는), "strong" (강력한 연결)
- 다양한 복선 기법 사용: 대사, 소품, 행동 패턴, 시각적 모티프, 캐릭터 습관, 배경 디테일 등
- 제공된 캐릭터 이름만 구체적으로 언급하세요
- JSON만 반환하고 다른 설명은 쓰지 마세요`;

export interface ForeshadowingGenResult {
  items: {
    plantDescription: string;
    payoffDescription: string;
    strength: 'weak' | 'medium' | 'strong';
    importance: 'minor' | 'major' | 'critical';
    notes?: string;
  }[];
}

// ── 공통 프롬프트 빌더 ──

export function buildContextSection(ctx: ProjectContext): string {
  const parts: string[] = [];

  if (ctx.meta) {
    const { title, logline, genre } = ctx.meta;
    if (title) parts.push(`## 작품: ${title}`);
    if (genre?.length) parts.push(`장르: ${genre.join(', ')}`);
    if (logline) parts.push(`로그라인: ${logline}`);
    parts.push('');
  }

  if (ctx.characters?.length) {
    parts.push('## 캐릭터');
    for (const c of ctx.characters) {
      parts.push(`- **${c.name}**: ${c.description ?? '(설명 없음)'}`);
      if (c.goal) parts.push(`  목표: ${c.goal}`);
      if (c.flaw) parts.push(`  결점: ${c.flaw}`);
      if (c.arc) parts.push(`  아크: ${c.arc}`);
      if (c.traits?.length) parts.push(`  성격: ${c.traits.join(', ')}`);
    }
    parts.push('');
  }

  if (ctx.scenes?.length) {
    parts.push('## 기존 씬');
    for (const s of ctx.scenes) {
      parts.push(`- 장면 ${s.number} (${s.id}): ${s.location} [${s.timeOfDay}]${s.summary ? ` — ${s.summary}` : ''}`);
    }
    parts.push('');
  }

  if (ctx.existingThreads?.length) {
    parts.push('## 기존 플롯 스레드');
    for (const t of ctx.existingThreads) {
      parts.push(`- **${t.name}**: ${t.description}`);
    }
    parts.push('');
  }

  if (ctx.existingBeats?.length) {
    parts.push('## 기존 비트 구조');
    for (const b of ctx.existingBeats) {
      parts.push(`- **${b.name}**: ${b.description}`);
    }
    parts.push('');
  }

  if (ctx.existingForeshadowing?.length) {
    parts.push('## 기존 복선');
    for (const f of ctx.existingForeshadowing) {
      parts.push(`- [${f.importance}/${f.status}] ${f.description}`);
    }
    parts.push('');
  }

  return parts.join('\n');
}

/** 사용 가능한 캐릭터 이름 목록을 리마인더로 추가 */
function appendCharacterReminder(parts: string[], ctx: ProjectContext): void {
  const names = ctx.characters?.map(c => c.name).filter(Boolean);
  if (names?.length) {
    parts.push(`\n⚠️ 사용 가능한 캐릭터: ${names.join(', ')} — 이 이름만 사용하세요. 다른 이름을 만들지 마세요.`);
  }
}

export function buildBeatGenPrompt(ctx: ProjectContext, userRequirements?: string): string {
  const parts = [buildContextSection(ctx)];
  if (userRequirements) parts.push(`## 사용자 요청\n${userRequirements}\n`);
  parts.push('이 작품의 15비트 각각에 대한 구체적 설명과 씬 제안을 생성해주세요.');
  appendCharacterReminder(parts, ctx);
  return parts.join('\n');
}

export function buildThreadGenPrompt(ctx: ProjectContext, userRequirements?: string): string {
  const parts = [buildContextSection(ctx)];
  if (userRequirements) parts.push(`## 사용자 요청\n${userRequirements}\n`);
  parts.push('이 작품에 필요한 플롯 스레드를 생성해주세요.');
  appendCharacterReminder(parts, ctx);
  return parts.join('\n');
}

export function buildForeshadowingGenPrompt(ctx: ProjectContext, userRequirements?: string): string {
  const parts = [buildContextSection(ctx)];
  if (userRequirements) parts.push(`## 사용자 요청\n${userRequirements}\n`);
  parts.push('이 작품에 효과적인 복선-회수 계획을 생성해주세요.');
  appendCharacterReminder(parts, ctx);
  return parts.join('\n');
}
