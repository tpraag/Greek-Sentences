import { useMemo, useState } from 'react'
import { useApp } from '../store'
import StatusDot from '../components/StatusDot'
import type { Sentence } from '../types'
import styles from './SentenceSearch.module.css'

interface Props {
  onBack: () => void
  onSentence: (collectionId: string, sentenceId: string) => void
  onCollection: (collectionId: string) => void
}

export default function SentenceSearch({ onBack, onSentence, onCollection }: Props) {
  const { state } = useApp()
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const all: Sentence[] = Object.values(state.sentences).flat()
    return all.filter(s =>
      s.en.toLowerCase().includes(q) || (s.gr ?? '').toLowerCase().includes(q)
    )
  }, [query, state.sentences])

  const matchingCollections = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return state.collections.filter(c => c.name.toLowerCase().includes(q))
  }, [query, state.collections])

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.back} onClick={onBack}>
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="7 1 1 7 7 13" />
          </svg>
          Library
        </button>
        <div className={styles.searchWrap}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className={styles.search}
            placeholder="Search sentences and collections"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      <div className="screen-scroll" style={{ paddingTop: 0 }}>
        <div className={styles.list}>
          {!query.trim() ? (
            <p className={styles.empty}>Start typing to search across every collection.</p>
          ) : results.length === 0 && matchingCollections.length === 0 ? (
            <p className={styles.empty}>Nothing matches "{query.trim()}".</p>
          ) : (
            <>
            {matchingCollections.map(c => (
              <button key={c.id} className={styles.row} onClick={() => onCollection(c.id)}>
                <div className={styles.textGroup}>
                  <span className={styles.en}>{c.name}</span>
                  <span className={styles.colName}>Collection</span>
                </div>
              </button>
            ))}
            {results.map(s => {
              const col = state.collections.find(c => c.id === s.collectionId)
              return (
                <button
                  key={s.id}
                  className={styles.row}
                  onClick={() => onSentence(s.collectionId, s.id)}
                >
                  <div className={styles.textGroup}>
                    {s.gr ? (
                      <span className={`${styles.gr} serif`}>{s.gr}</span>
                    ) : (
                      <span className={styles.notTranslated}>Not yet translated</span>
                    )}
                    <span className={styles.en}>{s.en}</span>
                    {col && <span className={styles.colName}>{col.name}</span>}
                  </div>
                  <StatusDot sentence={s} />
                </button>
              )
            })}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
