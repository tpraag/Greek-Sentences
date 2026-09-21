const FAST_MODEL = 'claude-haiku-4-5-20251001'

// Sends one user-turn prompt to Claude and returns the raw text response. Both
// api/word-info.ts and api/generate-practice.ts ask for JSON-only replies and parse
// the result themselves — this helper just handles the HTTP call.
export async function askClaude(prompt: string, maxTokens: number, model: string = FAST_MODEL): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Anthropic API error ${res.status}: ${detail.slice(0, 300)}`)
  }

  const data = await res.json()
  const text = data?.content?.[0]?.text
  if (typeof text !== 'string') throw new Error('Unexpected Anthropic response shape')
  return text
}
