import { useState } from 'react'
import { useApp } from '../store'
import { translateWordCached, normalizeWord } from '../lib/wordCache'
import type { PlaybackOrder, GreekSpeed } from '../types'
import styles from './ImmersivePlayer.module.css'

const ORDER_OPTIONS: { value: PlaybackOrder; label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'gr', label: 'GR' },
  { value: 'en-gr', label: 'EN→GR' },
  { value: 'gr-en', label: 'GR→EN' },
]
const SPEED_OPTIONS: GreekSpeed[] = [0.7, 0.85, 1.0]
const MAX_DOTS = 12

export default function ImmersivePlayer() {
  const { state, dispatch, pauseResume, nextSentence, prevSentence, stopPlayback, setGreekSpeed, setPlaybackOrder } = useApp()
  const { playback } = state
  const [wordCache, setWordCache] = useState<Record<string, string>>({})
  const [popover, setPopover] = useState<{ word: string; translation: string; loading: boolean } | null>(null)

  async function handleWordTap(word: string) {
    const clean = normalizeWord(word)
    if (!clean) return
    if (wordCache[clean]) {
      setPopover({ word: clean, translation: wordCache[clean], loading: false })
      return
    }
    setPopover({ word: clean, translation: '', loading: true })
    try {
      const translation = await translateWordCached(clean)
      setWordCache(c => ({ ...c, [clean]: translation }))
      setPopover({ word: clean, translation, loading: false })
    } catch {
      setPopover({ word: clean, translation: 'Could not translate', loading: false })
    }
  }

  const REPEAT_OPTIONS = [1, 2, 3, 0] // 0 = ∞
  const repeatLabel = (n: number) => n === 0 ? '∞' : `${n}×`

  if (!playback.active || playback.view !== 'immersive') return null

  const col = state.collections.find(c => c.id === playback.collectionId)
  const sentences = playback.collectionId ? (state.sentences[playback.collectionId] ?? []) : []
  const current = sentences.find(s => s.id === playback.queue[playback.qpos])

  const phases = playback.order === 'en' ? ['en'] : playback.order === 'gr' ? ['gr'] : playback.order === 'en-gr' ? ['en','gr'] : ['gr','en']
  const langLabel = playback.inGap ? 'Pausing' : (phases[playback.phaseIdx] === 'en' ? 'English' : 'Ελληνικά')

  return (
    <div className={styles.screen}>
      <button className={styles.dismiss} onClick={stopPlayback}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="18 15 12 9 6 15"/>
        </svg>
      </button>

      <div className={styles.colName}>{col?.name}</div>

      {/* Progress dots — windowed so long collections don't overflow. Edge dots
          shrink to signal there are more sentences beyond the visible window. */}
      <div className={styles.dots}>
        {(() => {
          const total = playback.queue.length
          let start = 0
          if (total > MAX_DOTS) {
            start = Math.max(0, Math.min(playback.qpos - Math.floor(MAX_DOTS / 2), total - MAX_DOTS))
          }
          const end = Math.min(total, start + MAX_DOTS)
          const items = []
          for (let i = start; i < end; i++) {
            const moreBefore = i === start && start > 0
            const moreAfter = i === end - 1 && end < total
            items.push(
              <div
                key={i}
                className={`${styles.dot} ${i <= playback.qpos ? styles.dotFilled : ''} ${moreBefore || moreAfter ? styles.dotEdge : ''}`}
              />
            )
          }
          return items
        })()}
      </div>

      <div className={styles.langLabel}>{langLabel} · {playback.qpos + 1} of {playback.queue.length}</div>

      {current && (
        <div className={styles.textArea} onClick={() => setPopover(null)}>
          {/* Greek is always the primary text, on top — tap any word for its translation */}
          {current.gr ? (
            <p className={`${styles.primary} serif`} style={{ position: 'relative' }}>
              {current.gr.split(/(\s+)/).map((token, i) =>
                /\s+/.test(token) ? token :
                <span
                  key={i}
                  className={styles.grWord}
                  onClick={e => { e.stopPropagation(); handleWordTap(token) }}
                >{token}</span>
              )}
            </p>
          ) : (
            <p className={styles.primary}>{current.en}</p>
          )}
          {current.gr && (
            <p className={styles.secondary}>{current.en}</p>
          )}
          {popover && (
            <div className={styles.wordPopover}>
              <span className={styles.popoverWord}>{popover.word}</span>
              <span className={styles.popoverArrow}>→</span>
              <span className={styles.popoverTranslation}>{popover.loading ? '…' : popover.translation}</span>
              <button className={styles.popoverClose} onClick={() => setPopover(null)}>✕</button>
            </div>
          )}
        </div>
      )}

      {/* Order control */}
      <div className={styles.ctrlRow}>
        {ORDER_OPTIONS.map(o => (
          <button
            key={o.value}
            className={`${styles.ctrlBtn} ${playback.order === o.value ? styles.ctrlActive : ''}`}
            onClick={() => setPlaybackOrder(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Speed + repeat controls */}
      <div className={styles.ctrlRow}>
        <span className={styles.ctrlTag}>Speed</span>
        {SPEED_OPTIONS.map(s => (
          <button
            key={s}
            className={`${styles.ctrlBtn} ${playback.greekSpeed === s ? styles.ctrlActive : ''}`}
            onClick={() => setGreekSpeed(s)}
          >
            {s === 1.0 ? '1×' : `${s}×`}
          </button>
        ))}
      </div>

      <div className={styles.ctrlRow}>
        <span className={styles.ctrlTag}>Repeat</span>
        {REPEAT_OPTIONS.map(n => (
          <button
            key={n}
            className={`${styles.ctrlBtn} ${playback.sentenceRepeat === n ? styles.ctrlActive : ''}`}
            onClick={() => dispatch({ type: 'SET_PLAYBACK', playback: { sentenceRepeat: n, sentencePlayCount: 0 } })}
          >
            {repeatLabel(n)}
          </button>
        ))}
      </div>

      <div className={styles.transport}>
        <button className={styles.transportBtn} onClick={prevSentence}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
            <polygon points="19 20 9 12 19 4 19 20"/>
            <line x1="5" y1="19" x2="5" y2="5" stroke="white" strokeWidth="2"/>
          </svg>
        </button>
        <button className={styles.bigPlay} onClick={pauseResume}>
          {playback.paused ? (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          )}
        </button>
        <button className={styles.transportBtn} onClick={nextSentence}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
            <polygon points="5 4 15 12 5 20 5 4"/>
            <line x1="19" y1="5" x2="19" y2="19" stroke="white" strokeWidth="2"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
