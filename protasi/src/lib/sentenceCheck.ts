// Second opinion on a generated practice sentence. Claude writes the Greek and its English
// meaning; Google Translate reads the Greek back into English independently. If the two
// English versions share hardly any content words, the Greek probably doesn't say what
// Claude claimed (a wrong word, a made-up word, a mangled meaning) and is worth flagging.
// This catches meaning errors, not subtle grammar slips — Google tends to read those
// charitably — and it only ever warns; it never removes a sentence.

const STOP = new Set((
  'the an and or but of to in on at by for with from as is are was were be been being am ' +
  'i you he she it we they me him her us them my your his its our their this that these those ' +
  'do does did done have has had will would can could should not no very so too also just ' +
  'there here what which who when where how about into over out up down than then'
).split(' '))

// Crude stem: the first five letters, so "speaks", "speaking" and "speak" line up
function contentStems(text: string): Set<string> {
  return new Set(
    text.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/)
      .filter(w => w.length > 1 && !STOP.has(w))
      .map(w => w.slice(0, 5)),
  )
}

export function disagrees(claudeEnglish: string, googleEnglish: string): boolean {
  const a = contentStems(claudeEnglish)
  const b = contentStems(googleEnglish)
  // Too little to compare reliably — better to stay quiet than to cry wolf
  if (a.size < 3 || b.size < 2) return false
  let shared = 0
  a.forEach(w => { if (b.has(w)) shared++ })
  return shared / Math.min(a.size, b.size) < 0.5
}
