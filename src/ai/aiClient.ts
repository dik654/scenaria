import type { AppSettings } from '../types/project';

type AIProvider = AppSettings['ai'];

/**
 * Shared AI call utility used by AIFloatingToolbar, SceneMetaPane, etc.
 * Returns an array of suggested strings (1 or 3 depending on `count`).
 */
export async function callAI(
  ai: AIProvider,
  systemPrompt: string,
  userPrompt: string,
  count: 1 | 3 = 3,
): Promise<string[]> {
  if (!ai.apiKey && ai.provider !== 'local-vllm') {
    throw new Error('AI API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.');
  }

  const endpoint =
    ai.provider === 'claude'
      ? 'https://api.anthropic.com/v1/messages'
      : (ai.endpoint ?? 'http://localhost:8000/v1/messages');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(ai.provider === 'claude'
        ? { 'x-api-key': ai.apiKey!, 'anthropic-version': '2023-06-01' }
        : {}),
      ...(ai.provider === 'openai' ? { Authorization: `Bearer ${ai.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: ai.model ?? 'claude-sonnet-4-6',
      max_tokens: count === 1 ? 512 : 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) throw new Error(`AI 호출 실패: ${response.status}`);

  const data = await response.json();
  const raw: string =
    ai.provider === 'openai'
      ? (data.choices[0].message.content as string)
      : (data.content[0].text as string);

  if (count === 1) return [raw.trim()];

  // Parse JSON array of alternatives
  const match = raw.match(/\[[\s\S]*\]/);
  if (match) {
    const parsed = JSON.parse(match[0]) as string[];
    return parsed.slice(0, 3);
  }
  return [raw.trim()];
}
