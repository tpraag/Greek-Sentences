import { useState } from 'react'
import { useApp } from '../store'
import CollectionIcon from '../components/CollectionIcon'
import NewCollectionPanel from '../components/NewCollectionPanel'
import type { IconName, CollectionColor } from '../types'
import styles from './Library.module.css'

interface Props {
  onOpen: (id: string) => void
}

export default function Library({ onOpen }: Props) {
  const { state, createCollection } = useApp()
  const [showNew, setShowNew] = useState(false)
  const [search, setSearch] = useState('')

  const { collections, sentences } = state

  const totalSentences = Object.values(sentences).reduce((a, b) => a + b.length, 0)

  const filtered = collections.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  function handleCreate(name: string, icon: IconName, color: CollectionColor) {
    setShowNew(false)
    createCollection({ name, icon, color, createdAt: Date.now() })
  }

  return (
    <div className="screen-scroll">
      <div className={styles.header}>
        <h1 className={styles.title}>Library</h1>
        <p className={styles.sub}>
          {totalSentences} sentence{totalSentences !== 1 ? 's' : ''} · {collections.length} collection{collections.length !== 1 ? 's' : ''}
        </p>
        <div className={styles.searchWrap}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className={styles.search}
            placeholder="Search collections"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className="label">Collections</span>
          <button className={styles.newBtn} onClick={() => setShowNew(v => !v)}>
            + New
          </button>
        </div>

        {showNew && (
          <NewCollectionPanel onSave={handleCreate} onCancel={() => setShowNew(false)} />
        )}

        <div className={styles.list}>
          {filtered.map(col => {
            const count = (sentences[col.id] ?? []).length
            return (
              <button key={col.id} className={`card ${styles.collectionCard}`} onClick={() => onOpen(col.id)}>
                <div className={styles.iconWrap} style={{ background: col.color.bg }}>
                  <CollectionIcon icon={col.icon} accent={col.color.accent} size={24} />
                </div>
                <div className={styles.colMeta}>
                  <span className={styles.colName}>{col.name}</span>
                  <span className={styles.colSub}>{count} sentence{count !== 1 ? 's' : ''}</span>
                </div>
                <svg className={styles.chevron} width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 1 7 7 1 13"/>
                </svg>
              </button>
            )
          })}
          {filtered.length === 0 && !showNew && (
            <p className={styles.empty}>
              {search ? 'No collections match.' : 'Tap + New to create your first collection.'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
