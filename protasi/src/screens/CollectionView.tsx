import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store'
import CollectionIcon from '../components/CollectionIcon'
import NewCollectionPanel from '../components/NewCollectionPanel'
import PlaySetupSheet from '../components/PlaySetupSheet'
import SwipeToDelete from '../components/SwipeToDelete'
import type { IconName, CollectionColor, Sentence } from '../types'
import styles from './CollectionView.module.css'

interface Props {
  collectionId: string
  onBack: () => void
  onSentence: (id: string) => void
}

export default function CollectionView({ collectionId, onBack, onSentence }: Props) {
  const { state, updateCollection, deleteCollection, translateSentence, updateSentence, deleteSentence, startPlayback, pauseResume } = useApp()
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameVal, setRenameVal] = useState('')
  const [iconSheet, setIconSheet] = useState(false)
  const [playSetup, setPlaySetup] = useState(false)

  const col = state.collections.find(c => c.id === collectionId)
  const sentences = state.sentences[collectionId] ?? []
  const playingRowRef = useRef<HTMLDivElement | null>(null)

  // Scroll to the currently playing sentence
  useEffect(() => {
    if (state.playback.active && playingRowRef.current) {
      playingRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [state.playback.qpos, state.playback.active])

  if (!col) return null

  async function handleRename() {
    if (!renameVal.trim()) return
    await updateCollection(collectionId, { name: renameVal.trim() })
    setRenaming(false)
  }

  async function handleDelete() {
    if (!confirm(`Delete "${col!.name}" and all its sentences?`)) return
    await deleteCollection(collectionId)
    onBack()
  }

  async function handleIconSave(_name: string, icon: IconName, color: CollectionColor) {
    await updateCollection(collectionId, { icon, color })
    setIconSheet(false)
  }

  const translated = sentences.filter(s => s.gr)

  function handlePlayAll() {
    setPlaySetup(true)
  }

  function handleStartPlay(opts: any) {
    setPlaySetup(false)
    const queue = translated.map(s => s.id)
    if (!queue.length) return
    startPlayback(collectionId, queue, opts)
  }

  function handlePlayOne(s: Sentence) {
    if (!s.gr) {
      translateSentence(s.id, collectionId)
      return
    }
    // Continue from this sentence through the rest, using the current play-all defaults
    const ids = translated.map(t => t.id)
    const startIdx = ids.indexOf(s.id)
    const queue = startIdx >= 0 ? ids.slice(startIdx) : [s.id]
    startPlayback(collectionId, queue, {
      order: state.settings.order,
      gapSeconds: state.settings.gapSeconds,
      view: 'immersive',
      greekSpeed: state.settings.greekSpeed,
      sentenceRepeat: state.settings.sentenceRepeat,
      loopList: false,
    })
  }

  return (
    <div className={styles.screen}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.back} onClick={onBack}>
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="7 1 1 7 7 13"/>
          </svg>
          Library
        </button>
        <div className={styles.titleRow}>
          <div className={styles.titleGroup}>
            <div className={styles.iconWrap} style={{ background: col.color.bg }}>
              <CollectionIcon icon={col.icon} accent={col.color.accent} size={20} />
            </div>
            {renaming ? (
              <div className={styles.renameRow}>
                <input
                  className={styles.renameInput}
                  value={renameVal}
                  onChange={e => setRenameVal(e.target.value)}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleRename()}
                />
                <button className={styles.saveBtn} onClick={handleRename}>Save</button>
                <button className={styles.cancelBtn} onClick={() => setRenaming(false)}>Cancel</button>
              </div>
            ) : (
              <h2 className={styles.title}>{col.name}</h2>
            )}
          </div>
          <button className={styles.menuBtn} onClick={() => setMenuOpen(true)}>•••</button>
        </div>
        <p className={styles.sub}>{sentences.length} sentence{sentences.length !== 1 ? 's' : ''} · {translated.length} translated</p>
      </div>

      {/* Play all bar */}
      {translated.length > 0 && (
        <button className={styles.playBar} onClick={handlePlayAll}>
          <div className={styles.playBarLeft}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            <div>
              <div className={styles.playBarTitle}>Play all</div>
              <div className={styles.playBarSub}>
                {state.settings.order.replace('-', ' → ').toUpperCase()} · {state.settings.gapSeconds}s gap
              </div>
            </div>
          </div>
          <span className={styles.optionsPill}>Options</span>
        </button>
      )}

      {/* Sentence list */}
      <div className={`screen-scroll ${state.playback.active ? 'with-player' : ''}`} style={{ paddingTop: 0 }}>
        <div className={styles.list}>
          {sentences.map(s => {
            const isPlaying = state.playback.active && state.playback.queue[state.playback.qpos] === s.id
            return (
              <SwipeToDelete key={s.id} onDelete={() => deleteSentence(s.id, collectionId)}>
                <div
                  ref={isPlaying ? playingRowRef : null}
                  className={`${styles.row} ${isPlaying ? styles.playing : ''}`}
                  onClick={() => onSentence(s.id)}
                  role="button"
                  tabIndex={0}
                >
                  <button
                    className={`${styles.playBtn} ${isPlaying ? styles.playBtnActive : ''}`}
                    style={{ opacity: s.gr ? 1 : 0.4 }}
                    onClick={e => {
                      e.stopPropagation()
                      if (isPlaying) pauseResume()
                      else handlePlayOne(s)
                    }}
                  >
                    {isPlaying && !state.playback.paused ? (
                      <svg width="10" height="12" viewBox="0 0 12 14" fill="#fff">
                        <rect x="2" y="1" width="3" height="12" rx="1"/>
                        <rect x="7" y="1" width="3" height="12" rx="1"/>
                      </svg>
                    ) : (
                      <svg width="10" height="12" viewBox="0 0 12 14" fill={isPlaying ? '#fff' : col.color.accent}>
                        <polygon points="1 1 11 7 1 13"/>
                      </svg>
                    )}
                  </button>
                  <div className={styles.textGroup}>
                    {s.gr ? (
                      <span className={`${styles.gr} serif`}>{s.gr}</span>
                    ) : s.translating ? (
                      <span className={styles.translating}>Translating…</span>
                    ) : (
                      <span className={styles.notTranslated}>Tap to translate & narrate</span>
                    )}
                    <span className={styles.en}>{s.en}</span>
                  </div>
                  <button
                    className={styles.favBtn}
                    onClick={e => {
                      e.stopPropagation()
                      updateSentence(s.id, collectionId, { fav: !s.fav })
                    }}
                  >
                    {s.fav ? '★' : '☆'}
                  </button>
                </div>
              </SwipeToDelete>
            )
          })}
          {sentences.length === 0 && (
            <p className={styles.empty}>No sentences yet. Tap + to add one.</p>
          )}
        </div>
      </div>

      {/* ••• menu sheet */}
      {menuOpen && (
        <div className="sheet-overlay" onClick={() => setMenuOpen(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className={styles.menuList}>
              <button className={styles.menuItem} onClick={() => { setMenuOpen(false); setRenameVal(col.name); setRenaming(true) }}>
                Rename collection
              </button>
              <div className="hairline" />
              <button className={styles.menuItem} onClick={() => { setMenuOpen(false); setIconSheet(true) }}>
                Change icon & color
              </button>
              <div className="hairline" />
              <button className={`${styles.menuItem} ${styles.destructive}`} onClick={() => { setMenuOpen(false); handleDelete() }}>
                Delete collection
              </button>
              <div className="hairline" />
              <button className={styles.menuItem} onClick={() => setMenuOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Icon picker sheet */}
      {iconSheet && (
        <div className="sheet-overlay" onClick={() => setIconSheet(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h3 className={styles.sheetTitle}>Icon & Color</h3>
            <NewCollectionPanel
              onSave={handleIconSave}
              onCancel={() => setIconSheet(false)}
            />
          </div>
        </div>
      )}

      {/* Play setup sheet */}
      {playSetup && (
        <PlaySetupSheet
          count={translated.length}
          onStart={handleStartPlay}
          onClose={() => setPlaySetup(false)}
        />
      )}
    </div>
  )
}
