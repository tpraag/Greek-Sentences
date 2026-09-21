const FAST_MODEL = 'claude-haiku-4-5-20251001'

// Sends one user-turn prompt to Claude and returns the raw text response. The routes ask
// for JSON-only replies and parse the result themselves — this helper just handles the
// HTTP call. `noThinking` switches off extended thinking on models that think by default
// (Sonnet 5 does): a lookup like a conjugation table doesn't need it, and it keeps the
// call fast and its whole token budget for the answer.
export async function askClaude(
  prompt: string,
  maxTokens: number,
  model: string = FAST_MODEL,
  opts: { noThinking?: boolean } = {},
): Promise<string> {
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
      ...(opts.noThinking ? { thinking: { type: 'disabled' } } : {}),
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Anthropic API error ${res.status}: ${detail.slice(0, 300)}`)
  }

  const data = await res.json()
  // Replies are a list of blocks — a thinking block can come first — so collect the text ones
  const blocks: { type?: string; text?: unknown }[] = Array.isArray(data?.content) ? data.content : []
  const text = blocks.filter(b => b?.type === 'text' && typeof b.text === 'string').map(b => b.text as string).join('')
  if (!text) {
    throw new Error(`No text in Anthropic response (stop_reason: ${data?.stop_reason}, blocks: ${blocks.map(b => b?.type).join(',') || 'none'})`)
  }
  if (data?.stop_reason === 'max_tokens') throw new Error('Anthropic response was cut off (max_tokens)')
  return text
}
