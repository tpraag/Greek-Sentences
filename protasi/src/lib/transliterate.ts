// Rule-based Greek → Latin phonetic transliteration, meant as a pronunciation aid for
// a learner (not a formal transliteration standard like ISO 843). Handles the common
// digraphs and the position-dependent sounds that trip up a literal letter-by-letter
// mapping (μπ/ντ/γκ, αυ/ευ voicing, γ before front vowels).

const ACCENT_MAP: Record<string, string> = {
  'ά': 'α', 'έ': 'ε', 'ή': 'η', 'ί': 'ι', 'ό': 'ο', 'ύ': 'υ', 'ώ': 'ω',
  'ϊ': 'ι', 'ϋ': 'υ', 'ΐ': 'ι', 'ΰ': 'υ',
}

function stripAccent(ch: string): string {
  return ACCENT_MAP[ch] ?? ch
}

const VOICELESS = new Set(['θ', 'κ', 'ξ', 'π', 'σ', 'ς', 'τ', 'φ', 'χ', 'ψ'])
const FRONT_VOWELS = new Set(['ε', 'αι', 'η', 'ι', 'υ', 'οι', 'ει'])

// μπ/ντ/γκ sound different at the start of a word vs. in the middle of one
const NASAL_CLUSTERS: Record<string, { initial: string; medial: string }> = {
  'μπ': { initial: 'b', medial: 'mb' },
  'ντ': { initial: 'd', medial: 'nd' },
  'γκ': { initial: 'g', medial: 'ng' },
}

const DIGRAPHS: Record<string, string> = {
  'γγ': 'ng', 'γξ': 'nx', 'τσ': 'ts', 'τζ': 'tz',
  'αι': 'e', 'ει': 'i', 'οι': 'i', 'υι': 'i', 'ου': 'ou',
}

const SINGLE: Record<string, string> = {
  'α': 'a', 'β': 'v', 'γ': 'gh', 'δ': 'dh', 'ε': 'e', 'ζ': 'z', 'η': 'i', 'θ': 'th',
  'ι': 'i', 'κ': 'k', 'λ': 'l', 'μ': 'm', 'ν': 'n', 'ξ': 'x', 'ο': 'o', 'π': 'p',
  'ρ': 'r', 'σ': 's', 'ς': 's', 'τ': 't', 'υ': 'i', 'φ': 'f', 'χ': 'h', 'ψ': 'ps', 'ω': 'o',
}

const GREEK_LETTER_RE = /[Ͱ-Ͽἀ-῿]/

function transliterateWord(word: string): string {
  const lower = word.toLowerCase()
  const n = lower.length
  const at = (idx: number) => idx < n ? stripAccent(lower[idx]) : ''

  let out = ''
  let i = 0
  while (i < n) {
    const c0 = at(i)
    const c1 = at(i + 1)
    const two = c0 + c1

    // αυ / ευ / ηυ — "v" before a vowel or voiced consonant, "f" before a voiceless one
    if (two === 'αυ' || two === 'ευ' || two === 'ηυ') {
      const next = at(i + 2)
      const base = two === 'αυ' ? 'a' : two === 'ευ' ? 'e' : 'i'
      out += base + (VOICELESS.has(next) ? 'f' : 'v')
      i += 2
      continue
    }

    if (NASAL_CLUSTERS[two]) {
      const isWordInitial = i === 0 || !GREEK_LETTER_RE.test(lower[i - 1])
      out += isWordInitial ? NASAL_CLUSTERS[two].initial : NASAL_CLUSTERS[two].medial
      i += 2
      continue
    }

    if (DIGRAPHS[two]) {
      out += DIGRAPHS[two]
      i += 2
      continue
    }

    // γ before a front-vowel sound is closer to "y" than the usual soft "gh"
    if (c0 === 'γ' && (FRONT_VOWELS.has(c1) || FRONT_VOWELS.has(c1 + at(i + 2)))) {
      out += 'y'
      i += 1
      continue
    }

    if (SINGLE[c0]) {
      out += SINGLE[c0]
      i += 1
      continue
    }

    // Not a mapped Greek letter (punctuation, digits, already-Latin text) — pass through
    out += word[i]
    i += 1
  }

  if (word[0] && word[0] !== word[0].toLowerCase()) {
    out = out.charAt(0).toUpperCase() + out.slice(1)
  }
  return out
}

// Transliterates only the Greek runs of `text`, leaving spaces/punctuation/other scripts as-is.
export function transliterateGreek(text: string): string {
  return text.split(/([\p{L}\p{M}]+)/gu)
    .map(token => GREEK_LETTER_RE.test(token) ? transliterateWord(token) : token)
    .join('')
}
