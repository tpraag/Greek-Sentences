import { useEffect, useState } from 'react'
import { getVerbTable, tabOfWord, tabsFor, formMatches, TABS, PERSONS, type TabKey, type VerbEntry } from '../lib/conjugation'
import type { WordInfo } from '../lib/api'
import styles from './ConjugationTable.module.css'

interface Props {
  lemma: string
  word?: string            // the tapped word — its row is highlighted and its tab opens first
  backLabel: string
  onBack: () => void
  onPractice: (info: WordInfo) => void
}

export default function ConjugationTable({ lemma, word, backLabel, onBack, onPractice }: Props) {
  const [entry, setEntry] = useState<VerbEntry | null>(null)
  const [tab, setTab] = useState<TabKey>('present')
  const [source, setSource] = useState<'data' | 'claude'>('data')
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setEntry(null)
    setFailed(false)
    getVerbTable(lemma)
      .then(t => {
        if (cancelled) return
        if (!t) { setFailed(true); return }
        setEntry(t.entry)
        setSource(t.source)
        if (word) setTab(tabOfWord(t.entry, word) ?? 'present')
      })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [lemma, word, attempt])

  const tabs = entry ? tabsFor(entry) : TABS
  const current = TABS.find(t => t.key === tab) ?? TABS[0]
  const sections = entry ? current.sections.filter(s => entry[s.key]?.some(Boolean)) : []

  return (
    <div className={styles.screen}>
      <button className={styles.back} onClick={onBack}>‹ {backLabel}</button>

      <div className={styles.head}>
        <div className={styles.eyebrow}>Conjugation</div>
        <div className={styles.lemmaRow}>
          <span className={`${styles.lemma} serif`}>{lemma}</span>
          <span className={styles.pos}>verb</span>
        </div>
        <p className={styles.meaning}>{entry?.m ?? ''}</p>
      </div>

      <div className={styles.tabs}>
        {tabs.map(t => (
          <button
            key={t.key}
            className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className={styles.note}>{current.note}</p>

      <div className={styles.rows}>
        {!entry && !failed && (
          <div className={styles.status}>
            <div className={styles.spinner} />
            <p>Writing the conjugation table…</p>
          </div>
        )}
        {failed && (
          <div className={styles.status}>
            <p>Couldn't load a conjugation table for this verb.</p>
            <button className={styles.retry} onClick={() => setAttempt(a => a + 1)}>Try again</button>
          </div>
        )}
        {entry && sections.map(section => (
          <div key={section.key} className={styles.section}>
            {section.caption && sections.length > 1 && <div className={styles.caption}>{section.caption}</div>}
            {(entry[section.key] ?? []).map((form, i) => {
              // Imperatives don't exist for every person; other tenses show a dash for a gap
              if (!form && (section.key === 'is' || section.key === 'ic')) return null
              const here = !!word && formMatches(form, word)
              return (
                <div key={i} className={`${styles.row} ${here ? styles.rowHere : ''}`}>
                  <span className={styles.person}>{PERSONS[i]}</span>
                  <span className={`${styles.form} serif ${form ? '' : styles.formEmpty}`}>{form ?? '—'}</span>
                </div>
              )
            })}
          </div>
        ))}
        {entry && (
          <p className={styles.credit}>
            {source === 'claude'
              ? 'Written by Claude — worth double-checking irregular forms'
              : 'Conjugations from Wiktionary contributors, CC BY-SA 4.0'}
          </p>
        )}
      </div>

      <button
        className={styles.practiceBtn}
        disabled={!entry}
        onClick={() => entry && onPractice({ word: lemma, gloss: entry.m, pos: 'verb' })}
      >
        Practice this verb
      </button>
    </div>
  )
}
