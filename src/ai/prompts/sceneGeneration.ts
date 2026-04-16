/**
 * 씬 AI 생성 프롬프트
 * 3가지 모드: 캐릭터 기반 랜덤, 큰그림 기반, 블록 상세화
 * + 스토리 연동 모드: 기존 모드에 스토리 컨텍스트를 주입
 */
import { fitSectionsToTokenBudget } from '../tokenBudget';

export const SYSTEM_SCENE_FROM_CHARACTERS = `당신은 한국 영화 시나리오 전문 작가입니다.
주어진 캐릭터 정보를 바탕으로 하나의 씬을 생성합니다.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "header": { "interior": "INT|EXT|INT/EXT", "location": "장소명", "timeOfDay": "DAY|NIGHT|DAWN|DUSK" },
  "blocks": [
    { "type": "action", "text": "지문 내용" },
    { "type": "character", "characterId": "캐릭터이름", "voiceType": "normal" },
    { "type": "dialogue", "text": "대사 내용" },
    { "type": "parenthetical", "text": "지시문 내용" },
    { "type": "transition", "transitionType": "컷" }
  ]
}

규칙:
- 지문(action)으로 시작하고, 장면 묘사를 구체적으로
- 캐릭터(character) 블록 다음에는 반드시 대사(dialogue)가 와야 함
- 지시문(parenthetical)은 캐릭터와 대사 사이에 올 수 있음
- voiceType은 "normal", "V.O.", "O.S." 중 선택
- characterId에는 캐릭터 이름을 그대로 사용
- 대사는 캐릭터의 말투와 성격을 반영
- 블록 10~20개 이내로 간결하게 생성
- 대사는 1~3줄 이내
- JSON만 반환하고 다른 설명은 쓰지 마세요`;

export const SYSTEM_SCENE_FROM_OVERVIEW = `당신은 한국 영화 시나리오 전문 작가입니다.
주어진 씬 설명/시놉시스를 바탕으로 완성된 씬을 생성합니다.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "header": { "interior": "INT|EXT|INT/EXT", "location": "장소명", "timeOfDay": "DAY|NIGHT|DAWN|DUSK" },
  "blocks": [
    { "type": "action", "text": "지문 내용" },
    { "type": "character", "characterId": "캐릭터이름", "voiceType": "normal" },
    { "type": "dialogue", "text": "대사 내용" },
    { "type": "parenthetical", "text": "지시문 내용" },
    { "type": "transition", "transitionType": "컷" }
  ]
}

규칙:
- 지문(action)으로 시작하고, 장면 묘사를 구체적으로
- 캐릭터(character) 블록 다음에는 반드시 대사(dialogue)가 와야 함
- voiceType은 "normal", "V.O.", "O.S." 중 선택
- 설명에 언급된 분위기, 갈등, 감정을 충실히 반영
- 블록 10~20개 이내로 간결하게 생성
- 대사는 1~3줄 이내
- JSON만 반환하고 다른 설명은 쓰지 마세요`;

export const SYSTEM_SCENE_ELABORATE = `당신은 한국 영화 시나리오 전문 작가입니다.
기존 씬의 블록들을 더 상세하고 구체적으로 확장합니다.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "blocks": [
    { "type": "action", "text": "확장된 지문" },
    { "type": "character", "characterId": "캐릭터이름", "voiceType": "normal" },
    { "type": "dialogue", "text": "확장된 대사" },
    ...
  ]
}

규칙:
- 기존 블록 순서를 유지하되, 각 블록의 내용을 더 풍부하게
- 짧은 지문은 구체적 묘사를 추가
- 대사 사이에 적절한 지문/지시문을 추가
- 캐릭터의 말투와 성격을 유지
- 기존 내용의 의미를 바꾸지 말 것
- 블록 20개 이내, 대사는 1~3줄 이내
- JSON만 반환하고 다른 설명은 쓰지 마세요`;

// ── 스토리 연동 모드 ──

export const SYSTEM_SCENE_STRUCTURED = `당신은 한국 영화 시나리오 전문 작가입니다.
주어진 스토리 컨텍스트(이전 씬, 캐릭터 아크, 플롯 스레드)를 바탕으로 씬을 생성합니다.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "header": { "interior": "INT|EXT|INT/EXT", "location": "장소명", "timeOfDay": "DAY|NIGHT|DAWN|DUSK" },
  "blocks": [
    { "type": "action", "text": "지문 내용" },
    { "type": "character", "characterId": "캐릭터이름", "voiceType": "normal" },
    { "type": "dialogue", "text": "대사 내용" },
    { "type": "parenthetical", "text": "지시문 내용" },
    { "type": "transition", "transitionType": "컷" }
  ]
}

## 핵심 규칙 — 스토리 연속성
- **이전 씬에서 일어난 사건, 감정, 대화를 반드시 참조하세요.** 인물들은 직전 씬의 경험을 기억하고 있어야 합니다.
- **캐릭터의 감정 상태는 이전 씬에서 자연스럽게 이어져야 합니다.** 갑작스러운 감정 변화 없이, 직전 사건의 영향이 드러나야 합니다.
- **진행 중인 플롯 스레드가 있다면 한 단계 진전시키세요.** 새로운 정보 공개, 긴장 고조, 관계 변화 등.
- **미해결 복선이 있다면 자연스럽게 언급하거나 회수할 기회를 만드세요.**
- **현재 씬에 이미 기존 내용이 있다면, 그 내용의 톤과 방향을 존중하며 확장하세요.**

## 캐릭터 규칙
- **등록된 캐릭터만 사용하고, 새 캐릭터를 만들지 마세요**
- characterId에는 캐릭터 이름을 그대로 사용
- **캐릭터의 목표(goal)는 행동/태도/암시로 간접적으로 드러내세요** (직접 언급 아님)
- **캐릭터의 결점(flaw)은 대화나 반응에서 자연스럽게 표출**
- 대사는 각 캐릭터의 말투(speechStyle)와 성격을 정확히 반영
- **대사 예시가 제공된 캐릭터는 그 말투 패턴을 정확히 따르세요**
- 캐릭터 간 관계가 대사와 행동에 자연스럽게 드러나야 함

## 금지 사항 — 반드시 지키세요
- **설명적 대사 금지**: 캐릭터가 서로 이미 아는 정보를 대사로 설명하지 마세요 (예: "너도 알다시피 우리 아버지가...")
- **감정 직접 진술 금지**: 캐릭터가 "나 화났어", "나 슬퍼" 같이 감정을 직접 말하게 하지 마세요. 행동, 말투, 침묵으로 드러내세요.
- **씬 내 완전 해결 금지**: 이 씬의 중심 갈등을 씬 안에서 깔끔하게 해결하지 마세요. 긴장이나 미해결 요소를 남기세요.
- **클리셰 묘사 금지**: "주먹을 불끈 쥐며", "눈에 눈물이 고이며" 같은 상투적 표현을 피하세요. 구체적이고 독창적인 묘사를 사용하세요.
- **각 캐릭터의 대사는 구별되어야 합니다**: 모든 캐릭터가 같은 어조로 말하면 안 됩니다. 말투, 어휘, 문장 길이를 다르게 하세요.

## 형식 규칙
- 지문(action)으로 시작하고, 장면 묘사를 구체적으로
- 캐릭터(character) 블록 다음에는 반드시 대사(dialogue)가 와야 함
- voiceType은 "normal", "V.O.", "O.S." 중 선택
- 블록 10~20개 이내로 간결하게 생성
- 대사는 1~3줄 이내
- JSON만 반환하고 다른 설명은 쓰지 마세요`;

export interface StoryContextInput {
  meta?: { title?: string; genre?: string[]; logline?: string };
  scenePosition?: { current: number; total: number };
  currentScene?: {
    header?: string;
    existingContent?: string;
    emotionalTone?: string[];
    tags?: string[];
    status?: string;
    notes?: string;
  };
  prevScenes?: { number: number; location: string; summary?: string }[];
  nextScenes?: { number: number; location: string; summary?: string }[];
  characters?: {
    name: string; description?: string; speechStyle?: string;
    occupation?: string; traits?: string[];
    goal?: string; flaw?: string; arc?: string;
    relationships?: string[];
    speechExamples?: string[];
  }[];
  activeThreads?: { name: string; description: string }[];
  currentBeat?: { name: string; description: string; act: number };
  unresolvedForeshadowing?: { description: string; importance: string }[];
  prevCharacterStates?: { characterId: string; emotional: string; situation: string }[];
}

/**
 * 스토리 컨텍스트를 조립합니다.
 * tokenBudget이 주어지면 우선순위 기반으로 섹션을 절삭합니다.
 * 우선순위: 1(필수) ~ 6(선택적)
 */
export function buildStoryContext(ctx: StoryContextInput, tokenBudget?: number): string {
  const sections: { key: string; content: string; priority: number }[] = [];

  // P1: 작품 메타 + 씬 위치 + 비트 (필수, 크기 작음)
  {
    const lines: string[] = [];
    if (ctx.meta) {
      const { title, genre, logline } = ctx.meta;
      const genreStr = genre?.length ? genre.join(', ') : '';
      if (title || genreStr) lines.push(`## 작품: ${title ?? ''}${genreStr ? ` (${genreStr})` : ''}`);
      if (logline) lines.push(`로그라인: ${logline}`);
    }
    if (ctx.scenePosition) {
      lines.push(`## 현재 위치: 장면 ${ctx.scenePosition.current} / ${ctx.scenePosition.total}`);
    }
    if (ctx.currentBeat) {
      lines.push(`스토리 비트: **${ctx.currentBeat.name}** (${ctx.currentBeat.act}막) — ${ctx.currentBeat.description}`);
    }
    if (lines.length) sections.push({ key: 'meta', content: lines.join('\n'), priority: 1 });
  }

  // P1: 현재 씬 정보 (필수 - 지금 편집 중인 씬)
  if (ctx.currentScene) {
    const lines: string[] = ['## 현재 씬'];
    if (ctx.currentScene.header) lines.push(`장소: ${ctx.currentScene.header}`);
    if (ctx.currentScene.status) lines.push(`상태: ${ctx.currentScene.status}`);
    if (ctx.currentScene.emotionalTone?.length) lines.push(`감정톤: ${ctx.currentScene.emotionalTone.join(', ')}`);
    if (ctx.currentScene.tags?.length) lines.push(`태그: ${ctx.currentScene.tags.join(', ')}`);
    if (ctx.currentScene.notes) lines.push(`작가 메모: ${ctx.currentScene.notes}`);
    if (ctx.currentScene.existingContent) {
      lines.push(`\n### 기존 작성 내용\n${ctx.currentScene.existingContent}`);
    }
    sections.push({ key: 'currentScene', content: lines.join('\n'), priority: 1 });
  }

  // P2: 캐릭터 감정 상태 (연속성에 핵심)
  if (ctx.prevCharacterStates?.length) {
    const lines: string[] = [
      '## 캐릭터 현재 상태 (직전 씬 종료 시점)',
      '⚠ 아래 감정/상황은 캐릭터의 고정 성격이 아닌, 직전 씬에서의 상태입니다. 이 씬은 이 상태에서 시작해야 합니다.',
    ];
    for (const cs of ctx.prevCharacterStates) {
      lines.push(`- **${cs.characterId}**: ${cs.emotional} — ${cs.situation}`);
    }
    sections.push({ key: 'charStates', content: lines.join('\n'), priority: 2 });
  }

  // P2: 이전 씬 요약 (서사 흐름에 핵심)
  if (ctx.prevScenes?.length) {
    const lines: string[] = ['## 직전 씬'];
    for (const s of ctx.prevScenes) {
      lines.push(`- 장면 ${s.number} (${s.location}): ${s.summary ?? '요약 없음'}`);
    }
    sections.push({ key: 'prevScenes', content: lines.join('\n'), priority: 2 });
  }

  // P3: 캐릭터 상세 (크기가 클 수 있음)
  if (ctx.characters?.length) {
    const lines: string[] = ['## 등장 캐릭터'];
    for (const c of ctx.characters) {
      lines.push(`### ${c.name}`);
      if (c.description) lines.push(`설명: ${c.description}`);
      if (c.occupation) lines.push(`직업: ${c.occupation}`);
      if (c.speechStyle) lines.push(`말투: ${c.speechStyle}`);
      if (c.traits?.length) lines.push(`성격: ${c.traits.join(', ')}`);
      if (c.goal) lines.push(`목표: ${c.goal}`);
      if (c.flaw) lines.push(`결점: ${c.flaw}`);
      if (c.arc) lines.push(`아크: ${c.arc}`);
      if (c.relationships?.length) {
        lines.push(`관계:`);
        for (const r of c.relationships) lines.push(`  - ${r}`);
      }
      if (c.speechExamples?.length) {
        lines.push(`대사 예시:`);
        for (const ex of c.speechExamples.slice(0, 3)) lines.push(`  > "${ex}"`);
      }
      lines.push('');
    }
    sections.push({ key: 'characters', content: lines.join('\n'), priority: 3 });
  }

  // P4: 플롯 스레드
  if (ctx.activeThreads?.length) {
    const lines: string[] = ['## 진행 중인 플롯 스레드'];
    for (const t of ctx.activeThreads) {
      lines.push(`- **${t.name}**: ${t.description}`);
    }
    sections.push({ key: 'threads', content: lines.join('\n'), priority: 4 });
  }

  // P4: 미해결 복선
  if (ctx.unresolvedForeshadowing?.length) {
    const lines: string[] = ['## 미해결 복선'];
    for (const f of ctx.unresolvedForeshadowing) {
      lines.push(`- [${f.importance}] ${f.description}`);
    }
    sections.push({ key: 'foreshadowing', content: lines.join('\n'), priority: 4 });
  }

  // P5: 다음 씬 (참고 수준)
  if (ctx.nextScenes?.length) {
    const lines: string[] = ['## 이후 씬 (참고)'];
    for (const s of ctx.nextScenes) {
      lines.push(`- 장면 ${s.number} (${s.location}): ${s.summary ?? '요약 없음'}`);
    }
    sections.push({ key: 'nextScenes', content: lines.join('\n'), priority: 5 });
  }

  // 토큰 예산 적용
  let finalSections = sections;
  if (tokenBudget && tokenBudget > 0) {
    finalSections = fitSectionsToTokenBudget(sections, tokenBudget);
  }

  return '# 스토리 컨텍스트\n\n' + finalSections.map(s => s.content).join('\n\n');
}

// ── 기존 자유 모드 프롬프트 빌더 ──

interface CharInfo {
  name: string;
  description: string;
  speechStyle?: string;
  speechTaboos?: string;
  speechExamples?: string[];
  occupation?: string;
  traits?: string[];
  goal?: string;
  flaw?: string;
  arc?: string;
}

function formatCharacterBlock(c: CharInfo): string {
  const lines: string[] = [];
  lines.push(`### ${c.name}`);
  lines.push(c.description);
  if (c.occupation) lines.push(`- 직업: ${c.occupation}`);
  if (c.goal) lines.push(`- **목표**: ${c.goal}`);
  if (c.flaw) lines.push(`- **결점**: ${c.flaw}`);
  if (c.arc) lines.push(`- **아크**: ${c.arc}`);
  if (c.traits?.length) lines.push(`- 성격: ${c.traits.join(', ')}`);
  if (c.speechStyle) lines.push(`- **말투**: ${c.speechStyle}`);
  if (c.speechTaboos) lines.push(`- **금지 표현**: ${c.speechTaboos}`);
  if (c.speechExamples?.length) {
    lines.push(`- 대사 예시:`);
    for (const ex of c.speechExamples.slice(0, 3)) lines.push(`  > "${ex}"`);
  }
  return lines.join('\n');
}

export function buildCharacterScenePrompt(
  characters: CharInfo[],
  projectLogline?: string,
  hint?: string,
): string {
  const parts: string[] = [];

  if (projectLogline) parts.push(`## 작품 로그라인\n${projectLogline}\n`);

  parts.push('## 캐릭터 정보\n');
  for (const c of characters) {
    parts.push(formatCharacterBlock(c));
    parts.push('');
  }

  parts.push('## 필수 반영 사항');
  parts.push('- 캐릭터의 **목표**는 직접 언급이 아닌, 행동/태도/넌지시 암시로 드러내세요 (과거의 꿈, 대사 속 은유 등)');
  parts.push('- 캐릭터의 **결점**은 대화나 반응에서 자연스럽게 표출되어야 합니다');
  parts.push('- 각 캐릭터의 **말투**(speechStyle)를 정확히 따르세요 — 가장 중요한 규칙입니다');
  parts.push('- **대사 예시**가 있으면 그 패턴, 어조, 문장 길이를 유지하세요');
  parts.push('- **금지 표현**은 절대 사용하지 마세요');

  if (hint) {
    parts.push(`\n## 추가 요청\n${hint}`);
  } else {
    parts.push('\n이 캐릭터들이 만나는 흥미로운 씬을 생성해주세요.');
  }

  return parts.join('\n');
}

export function buildOverviewScenePrompt(
  overview: string,
  characters?: CharInfo[],
): string {
  const parts: string[] = [];
  parts.push(`## 씬 설명\n${overview}`);

  if (characters?.length) {
    parts.push('\n## 등장 캐릭터\n');
    for (const c of characters) {
      parts.push(formatCharacterBlock(c));
      parts.push('');
    }
    parts.push('## 필수 반영 사항');
    parts.push('- 캐릭터의 **목표**는 행동/태도/암시로 간접적으로 드러내세요');
    parts.push('- 캐릭터의 **결점**은 대화나 반응에서 자연스럽게 표출');
    parts.push('- **말투**(speechStyle)를 정확히 따르세요 — 가장 중요');
  }

  parts.push('\n이 설명을 바탕으로 완성된 씬을 생성해주세요.');
  return parts.join('\n');
}

export function buildElaboratePrompt(
  blocks: { type: string; text?: string; characterId?: string }[],
  characters?: CharInfo[],
): string {
  const parts: string[] = [];
  parts.push('## 기존 씬 블록');

  for (const b of blocks) {
    if (b.type === 'character') {
      parts.push(`[캐릭터] ${b.characterId}`);
    } else if (b.text) {
      parts.push(`[${b.type}] ${b.text}`);
    }
  }

  if (characters?.length) {
    parts.push('\n## 캐릭터 프로필');
    for (const c of characters) {
      const info: string[] = [`- **${c.name}**`];
      if (c.speechStyle) info.push(`  말투: ${c.speechStyle}`);
      if (c.goal) info.push(`  목표: ${c.goal}`);
      if (c.flaw) info.push(`  결점: ${c.flaw}`);
      if (c.speechExamples?.length) info.push(`  대사 예시: "${c.speechExamples[0]}"`);
      parts.push(info.join('\n'));
    }
  }

  parts.push('\n이 블록들을 더 상세하고 풍부하게 확장해주세요. 캐릭터의 말투와 목표/결점을 반영하세요.');
  return parts.join('\n');
}
