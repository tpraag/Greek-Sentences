import { useState, useEffect, useRef } from 'react'
import { useApp } from '../store'
import NewCollectionPanel from '../components/NewCollectionPanel'
import type { IconName, CollectionColor } from '../types'
import styles from './QuickAdd.module.css'

interface Props {
  onClose: () => void
  onSaved: (collectionId: string) => void
  defaultCollectionId?: string | null
}

export default function QuickAdd({ onClose, onSaved, defaultCollectionId }: Props) {
  const { state, createSentence, createCollection } = useApp()
  const [text, setText] = useState('')
  const [selectedCol, setSelectedCol] = useState<string | null>(defaultCollectionId ?? null)

  // Once the user (or the new-collection flow below) has explicitly chosen a collection,
  // the auto-select effect must never override it — even if it re-fires from a
  // state.collections update that lands before the explicit choice's own render commits.
  const userPickedRef = useRef(false)
  function chooseCollection(id: string) {
    userPickedRef.current = true
    setSelectedCol(id)
  }

  // Preselect the collection the user is currently in, else the first real one
  useEffect(() => {
    if (userPickedRef.current || selectedCol) return
    if (defaultCollectionId && state.collections.some(c => c.id === defaultCollectionId)) {
      chooseCollection(defaultCollectionId)
      return
    }
    const first = state.collections.find(c => !c.id.startsWith('temp-'))
    if (first) chooseCollection(first.id)
  }, [state.collections])
  const [showNew, setShowNew] = useState(false)

  async function handleSave() {
    if (!text.trim() || !selectedCol) return
    const sentence = {
      en: text.trim(),
      gr: null,
      enAudioUrl: null,
      grAudioUrl: null,
      fav: false,
      learned: false,
      collectionId: selectedCol,
      createdAt: Date.now(),
    }
    onSaved(selectedCol)
    createSentence(sentence, state.settings.autoTranslate, state.settings.autoNarrate)
  }

  async function handleNewCollection(name: string, icon: IconName, color: CollectionColor) {
    const col = await createCollection({ name, icon, color, createdAt: Date.now() })
    chooseCollection(col.id)
    setShowNew(false)
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.cancel} onClick={onClose}>Cancel</button>
        <span className={styles.title}>New sentence</span>
        <button
          className={styles.save}
          disabled={!text.trim() || !selectedCol}
          onClick={handleSave}
        >
          Save
        </button>
      </div>

      <div className={`screen-scroll`} style={{ paddingTop: 0 }}>
        <div className={styles.body}>
          <textarea
            className={styles.textarea}
            placeholder="Type a sentence, paragraph, or story…"
            value={text}
            onChange={e => setText(e.target.value)}
            autoFocus
            rows={6}
          />

          <div className={styles.colSection}>
            <span className="label">Save to collection</span>
            <div className={styles.chips}>
              {state.collections.filter(c => !c.id.startsWith('temp-')).map(col => (
                <button
                  key={col.id}
                  className={`chip ${selectedCol === col.id ? 'active' : ''}`}
                  onClick={() => chooseCollection(col.id)}
                >
                  {col.name}
                </button>
              ))}
              <button
                className={`chip ${showNew ? 'active' : ''}`}
                onClick={() => setShowNew(v => !v)}
              >
                + New
              </button>
            </div>

            {showNew && (
              <NewCollectionPanel onSave={handleNewCollection} onCancel={() => setShowNew(false)} />
            )}
          </div>

          <button
            className="btn-accent"
            disabled={!text.trim() || !selectedCol}
            onClick={handleSave}
            style={{ marginTop: 8 }}
          >
            Save sentence
          </button>
        </div>
      </div>
    </div>
  )
}
