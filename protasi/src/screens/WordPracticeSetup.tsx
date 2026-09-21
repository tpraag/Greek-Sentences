import { useEffect, useState } from 'react'
import type { WordInfo } from '../lib/api'
import { findVerb } from '../lib/conjugation'
import styles from './WordPracticeSetup.module.css'

export interface PracticeParams {
  count: number
  level: string
  tenses: string[]
}

interface Props {
  info: WordInfo
  params: PracticeParams
  onParamsChange: (params: PracticeParams) => void
  onBack: () => void
  onGenerate: () => void
  onOpenTable: (lemma: string) => void
}

const COUNTS = [1, 3, 5, 8]
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1']
const LEVEL_HINT: Record<string, string> = {
  A1: 'Very simple', A2: 'Simple everyday', B1: 'Conversational', B2: 'Fluent, longer', C1: 'Nuanced',
}
const TENSES = ['Present', 'Past', 'Future', 'Imperative']

// Controlled by the parent (rather than owning its own state) so navigating back from
// Results to Setup shows exactly what was chosen before — the design's explicit
// "regenerating with different settings is one tap away" requirement.
export default function WordPracticeSetup({ info, params, onParamsChange, onBack, onGenerate, onOpenTable }: Props) {
  const isVerb = info.pos === 'verb'
  const [tableLemma, setTableLemma] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    setTableLemma(null)
    if (isVerb) {
      // Built-in data first; otherwise the dictionary form Claude gave, or the word itself
      findVerb(info.word)
        .then(v => v?.lemma ?? info.lemma ?? info.word)
        .catch(() => info.lemma ?? info.word)
        .then(l => { if (!cancelled) setTableLemma(l) })
    }
    return () => { cancelled = true }
  }, [info.word, info.lemma, isVerb])
  const { count, level, tenses } = params

  function toggleTense(t: string) {
    const on = tenses.includes(t)
    if (on && tenses.length === 1) return // keep a floor of one selected
    onParamsChange({ ...params, tenses: on ? tenses.filter(x => x !== t) : [...tenses, t] })
  }

  return (
    <div className={styles.screen}>
      <button className={styles.back} onClick={onBack}>‹ Player</button>

      <div className={styles.wordHeader}>
        <div className={styles.eyebrow}>Practice the word</div>
        <div className={styles.wordRow}>
          <span className={`${styles.word} serif`}>{info.word}</span>
          <span className={styles.pos}>{info.pos}</span>
        </div>
        <p className={styles.gloss}>{info.gloss}</p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.label}>How many sentences</span>
          <span className={styles.value}>{count} sentences</span>
        </div>
        <div className={styles.optionRow}>
          {COUNTS.map(n => (
            <button
              key={n}
              className={`${styles.optionBtn} ${count === n ? styles.optionActive : ''}`}
              onClick={() => onParamsChange({ ...params, count: n })}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.label}>Level</span>
          <span className={styles.value}>{LEVEL_HINT[level]}</span>
        </div>
        <div className={styles.optionRow}>
          {LEVELS.map(l => (
            <button
              key={l}
              className={`${styles.optionBtn} ${styles.optionSmall} ${level === l ? styles.optionActive : ''}`}
              onClick={() => onParamsChange({ ...params, level: l })}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {isVerb && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.label}>Vary the conjugation</span>
            {tableLemma && (
              <button className={styles.tableLink} onClick={() => onOpenTable(tableLemma)}>Full table ›</button>
            )}
          </div>
          <p className={styles.subLabel}>Mix persons and tenses across the set</p>
          <div className={styles.pillRow}>
            {TENSES.map(t => (
              <button
                key={t}
                className={`${styles.pill} ${tenses.includes(t) ? styles.pillActive : ''}`}
                onClick={() => toggleTense(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={styles.spacer} />

      <button className={styles.generateBtn} onClick={onGenerate}>
        Generate {count} sentences
      </button>
      <p className={styles.footnote}>Sentences are written by Claude, then narrated with your ElevenLabs voice.</p>
    </div>
  )
}
