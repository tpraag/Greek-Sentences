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

// Strips common leading list markers (bullets, numbering) from a pasted line,
// since batch-pasted lists are often copied straight from a doc or chat.
function cleanLine(line: string): string {
  return line.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, '').trim()
}

function parseLines(text: string): string[] {
  return text.split('\n').map(cleanLine).filter(Boolean)
}

export default function QuickAdd({ onClose, onSaved, defaultCollectionId }: Props) {
  const { state, createSentence, createCollection, showToast } = useApp()
  const [mode, setMode] = useState<'single' | 'batch'>('single')
  const [text, setText] = useState('')
  const [selectedCol, setSelectedCol] = useState<string | null>(defaultCollectionId ?? null)
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null)

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

  const batchLines = mode === 'batch' ? parseLines(text) : []

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

  async function handleBatchSave() {
    if (!batchLines.length || !selectedCol) return
    setBatchProgress({ done: 0, total: batchLines.length })
    for (let i = 0; i < batchLines.length; i++) {
      await createSentence({
        en: batchLines[i],
        gr: null,
        enAudioUrl: null,
        grAudioUrl: null,
        fav: false,
        learned: false,
        collectionId: selectedCol,
        createdAt: Date.now(),
      }, state.settings.autoTranslate, state.settings.autoNarrate, true)
      setBatchProgress({ done: i + 1, total: batchLines.length })
    }
    showToast(`${batchLines.length} sentence${batchLines.length !== 1 ? 's' : ''} added`)
    onSaved(selectedCol)
  }

  async function handleNewCollection(name: string, icon: IconName, color: CollectionColor) {
    const col = await createCollection({ name, icon, color, createdAt: Date.now() })
    chooseCollection(col.id)
    setShowNew(false)
  }

  const saving = batchProgress !== null
  const isBatch = mode === 'batch'
  const canSave = isBatch ? (batchLines.length > 0 && !!selectedCol && !saving) : (!!text.trim() && !!selectedCol)

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.cancel} onClick={onClose} disabled={saving}>Cancel</button>
        <span className={styles.title}>{isBatch ? 'Add sentences' : 'New sentence'}</span>
        <button
          className={styles.save}
          disabled={!canSave}
          onClick={isBatch ? handleBatchSave : handleSave}
        >
          {isBatch ? (batchLines.length ? `Add ${batchLines.length}` : 'Save') : 'Save'}
        </button>
      </div>

      <div className={`screen-scroll`} style={{ paddingTop: 0 }}>
        <div className={styles.body}>
          <div className={`segmented ${styles.modeToggle}`}>
            <button className={mode === 'single' ? 'active' : ''} onClick={() => setMode('single')} disabled={saving}>
              One sentence
            </button>
            <button className={mode === 'batch' ? 'active' : ''} onClick={() => setMode('batch')} disabled={saving}>
              Paste a list
            </button>
          </div>

          <textarea
            className={styles.textarea}
            placeholder={isBatch ? 'Paste sentences, one per line…' : 'Type a sentence, paragraph, or story…'}
            value={text}
            onChange={e => setText(e.target.value)}
            autoFocus
            rows={isBatch ? 8 : 6}
            readOnly={saving}
          />

          {isBatch && (
            <p className={styles.lineCount}>
              {batchLines.length
                ? `${batchLines.length} sentence${batchLines.length !== 1 ? 's' : ''} detected`
                : 'One sentence per line — numbering and bullets are stripped automatically'}
            </p>
          )}

          <div className={styles.colSection}>
            <span className="label">Save to collection</span>
            <div className={styles.chips}>
              {state.collections.filter(c => !c.id.startsWith('temp-')).map(col => (
                <button
                  key={col.id}
                  className={`chip ${selectedCol === col.id ? 'active' : ''}`}
                  onClick={() => chooseCollection(col.id)}
                  disabled={saving}
                >
                  {col.name}
                </button>
              ))}
              <button
                className={`chip ${showNew ? 'active' : ''}`}
                onClick={() => setShowNew(v => !v)}
                disabled={saving}
              >
                + New
              </button>
            </div>

            {showNew && (
              <NewCollectionPanel onSave={handleNewCollection} onCancel={() => setShowNew(false)} />
            )}
          </div>

          {saving ? (
            <div className={styles.progressRow}>
              <div className={styles.spinner} />
              <span>Adding {batchProgress.done} of {batchProgress.total}…</span>
            </div>
          ) : (
            <button
              className="btn-accent"
              disabled={!canSave}
              onClick={isBatch ? handleBatchSave : handleSave}
              style={{ marginTop: 8 }}
            >
              {isBatch
                ? (batchLines.length ? `Add ${batchLines.length} sentence${batchLines.length !== 1 ? 's' : ''}` : 'Add sentences')
                : 'Save sentence'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
