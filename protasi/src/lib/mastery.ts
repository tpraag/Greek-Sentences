import type { LearningStatus, Sentence } from '../types'

// Sentences saved before this feature existed have no learningStatus field — treat as 'new'.
// 'good' was a status that existed briefly and has since been removed — fold any sentence
// still carrying it into 'learning' rather than requiring a data migration.
export function getLearningStatus(s: Sentence): LearningStatus {
  const status = s.learningStatus as string | undefined
  if (status === 'good') return 'learning'
  if (status === 'new' || status === 'learning' || status === 'mastered') return status
  return 'new'
}

export function isMastered(s: Sentence): boolean {
  return getLearningStatus(s) === 'mastered'
}

// Counts words while ignoring punctuation; works for both Greek and Latin script.
export function countWords(text: string): number {
  const matches = text.match(/[\p{L}\p{N}]+/gu)
  return matches ? matches.length : 0
}

// points = ceil(wordCount / 10), minimum 1 for any non-empty sentence
export function calcMasteryPoints(wordCount: number): number {
  if (wordCount <= 0) return 0
  return Math.max(1, Math.ceil(wordCount / 10))
}

export const STATUS_LABEL: Record<LearningStatus, string> = {
  new: 'New',
  learning: 'Learning',
  mastered: 'Mastered',
}

export const STATUS_COLOR: Record<LearningStatus, string> = {
  new: 'var(--ink-faint)',
  learning: 'var(--fav)',
  mastered: 'var(--accent)',
}

export const LEARNING_STATUSES: LearningStatus[] = ['new', 'learning', 'mastered']
