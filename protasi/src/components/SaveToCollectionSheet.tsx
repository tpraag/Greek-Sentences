import { useState } from 'react'
import { useApp } from '../store'
import styles from './SaveToCollectionSheet.module.css'

interface Props {
  word: string
  count: number
  onClose: () => void
  onConfirm: (target: 'new' | string, newName: string) => Promise<void>
}

export default function SaveToCollectionSheet({ word, count, onClose, onConfirm }: Props) {
  const { state } = useApp()
  const [target, setTarget] = useState<'new' | string>('new')
  const [saving, setSaving] = useState(false)
  const [newName, setNewName] = useState(word)

  async function handleSave() {
    setSaving(true)
    try {
      await onConfirm(target, newName.trim() || word)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={e => e.stopPropagation()}>
        <div className={styles.handle} />
        <h2 className={styles.title}>Save {count} sentence{count !== 1 ? 's' : ''}</h2>
        <p className={styles.sub}>Pick a collection</p>

        <div className={styles.list}>
          <button
            className={`${styles.row} ${target === 'new' ? styles.rowActive : ''}`}
            onClick={() => setTarget('new')}
          >
            <div className={styles.icon}>＋</div>
            <div className={styles.rowText}>
              <span className={styles.rowName}>{newName.trim() || word}</span>
              <span className={styles.rowSub}>New collection</span>
            </div>
          </button>
          {target === 'new' && (
            <input
              className={styles.nameInput}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Collection name"
              aria-label="New collection name"
              onFocus={e => e.target.select()}
            />
          )}
          {state.collections.map(c => {
            const n = (state.sentences[c.id] ?? []).length
            return (
              <button
                key={c.id}
                className={`${styles.row} ${target === c.id ? styles.rowActive : ''}`}
                onClick={() => setTarget(c.id)}
              >
                <div className={styles.icon}>📖</div>
                <div className={styles.rowText}>
                  <span className={styles.rowName}>{c.name}</span>
                  <span className={styles.rowSub}>{n} sentence{n !== 1 ? 's' : ''}</span>
                </div>
              </button>
            )
          })}
        </div>

        <button className={styles.saveBtn} onClick={handleSave} disabled={saving || (target === 'new' && !newName.trim())}>
          {saving ? 'Saving…' : `Save ${count} sentence${count !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}
