import type { Sentence } from '../types'
import { isMastered } from './mastery'

const DAY_MS = 24 * 60 * 60 * 1000

// Deterministic priority score — higher goes first. Combines three signals from the spec:
// never/long-ago quizzed, previously answered incorrectly, mastered a long time ago.
function priorityScore(s: Sentence, now: number): number {
  let score = 0

  if (!s.lastQuizDate) {
    score += 1000 // never quizzed — highest priority
  } else {
    score += Math.min((now - s.lastQuizDate) / DAY_MS, 365) // older last-quiz → higher score
  }

  if (s.lastQuizResult === 'incorrect') score += 500
  else if (s.lastQuizResult === 'almost') score += 150

  if (s.lastMasteredDate) {
    score += Math.min((now - s.lastMasteredDate) / DAY_MS, 365) * 0.1 // small tiebreak
  }

  return score
}

// Eligible = currently Mastered with a Greek translation to quiz on.
export function getEligibleSentences(sentences: Sentence[]): Sentence[] {
  return sentences.filter(s => isMastered(s) && s.gr)
}

// Non-random selection, prioritized per spec §4. Returns up to `size` sentences,
// or every eligible sentence if fewer than `size` are available.
export function selectQuizSentences(sentences: Sentence[], size: number): Sentence[] {
  const now = Date.now()
  return getEligibleSentences(sentences)
    .map(s => ({ s, score: priorityScore(s, now) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, size)
    .map(x => x.s)
}
