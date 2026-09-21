// Finds the practice word inside a generated Greek sentence so the list can highlight it.
// Claude reports the exact form it used (`target`, e.g. πήγα when practising πάω). If that's
// missing or doesn't appear, fall back to the practice word itself, then to words that start
// the same way (so μεγάλη still lights up when practising μεγάλο).

export interface Piece {
  text: string
  hit: boolean
}

// Lowercase, no accents — so ά matches α and capitals match lowercase
function plain(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function highlightPieces(greek: string, target: string | undefined, word: string): Piece[] {
  const exact = new Set([target, word].filter((w): w is string => !!w).map(w => plain(w.trim())).filter(Boolean))
  const wordPlain = plain(word)
  const stem = wordPlain.length >= 5 ? wordPlain.slice(0, Math.min(5, wordPlain.length - 1)) : null

  const tokens = greek.split(/(\s+)/)
  const cores = tokens.map(t => plain(t).replace(/[^\p{L}]/gu, ''))

  // Pass 1: the exact forms. Pass 2 (only if nothing matched): words sharing the stem.
  let hits = cores.map(c => c !== '' && exact.has(c))
  if (!hits.some(Boolean) && stem) hits = cores.map(c => c.startsWith(stem))

  const pieces: Piece[] = []
  tokens.forEach((token, i) => {
    if (!hits[i]) { pieces.push({ text: token, hit: false }); return }
    // Keep punctuation around the word out of the highlight
    const m = token.match(/^([^\p{L}]*)(.*?)([^\p{L}]*)$/su)
    if (!m || !m[2]) { pieces.push({ text: token, hit: true }); return }
    if (m[1]) pieces.push({ text: m[1], hit: false })
    pieces.push({ text: m[2], hit: true })
    if (m[3]) pieces.push({ text: m[3], hit: false })
  })
  return pieces
}
