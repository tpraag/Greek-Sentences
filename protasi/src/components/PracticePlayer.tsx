import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store'
import type { GeneratedSentence } from '../lib/api'
import type { GreekSpeed } from '../types'
import styles from './PracticePlayer.module.css'

interface AudioEntry { blob: Blob; url: string }

interface Props {
  word: string
  items: GeneratedSentence[]
  audio: Record<number, AudioEntry>
  starred: Record<number, boolean>
  onToggleStar: (i: number) => void
  onClose: () => void
}

const SPEED_CYCLE: GreekSpeed[] = [0.7, 0.85, 1.0]
const REPEAT_CYCLE = [1, 2, 3, 0] // 0 = ∞
const GAP_CYCLE = [3, 5, 7, 10]

function cycle<T>(arr: T[], value: T): T {
  return arr[(arr.indexOf(value) + 1) % arr.length]
}

// Greek orthography drops the tonos on capitals, so strip it rather than relying on
// text-transform (which would keep the accent).
function capsNoTonos(word: string): string {
  return word.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
}

// Listen-and-repeat player over a generated practice set. It plays the in-memory preview
// audio from the results screen, and keeps its own speed/repeat/gap (starting from the
// saved playback defaults) so tweaking it never changes the main player.
export default function PracticePlayer({ word, items, audio, starred, onToggleStar, onClose }: Props) {
  const { state } = useApp()
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [progress, setProgress] = useState(0)
  const [speed, setSpeed] = useState<GreekSpeed>(state.settings.greekSpeed)
  const [repeat, setRepeat] = useState(state.settings.sentenceRepeat ?? 1)
  const [gap, setGap] = useState(state.settings.gapSeconds)

  const elRef = useRef<HTMLAudioElement>(new Audio())
  const cfgRef = useRef({ speed, repeat, gap })
  cfgRef.current = { speed, repeat, gap }

  const item = items[idx]
  const entryUrl = audio[idx]?.url

  useEffect(() => {
    const el = elRef.current
    el.ontimeupdate = () => setProgress(el.duration ? el.currentTime / el.duration : 0)
    return () => { el.ontimeupdate = null; el.onended = null; el.pause() }
  }, [])

  useEffect(() => { elRef.current.playbackRate = speed }, [speed])

  useEffect(() => { setProgress(0) }, [idx])

  // Plays the current sentence, repeating and then advancing per the settings. Waits
  // (quietly) if this sentence's audio hasn't finished generating yet.
  useEffect(() => {
    if (!playing || !entryUrl) return
    const el = elRef.current
    let plays = 0
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    function start() {
      if (cancelled) return
      el.src = entryUrl!
      el.playbackRate = cfgRef.current.speed
      // An interrupted start (skipping ahead, unmounting) rejects with AbortError — that's
      // not a playback failure, so don't flip the player to paused for it.
      el.play().catch(err => { if (!cancelled && err?.name !== 'AbortError') setPlaying(false) })
    }

    el.onended = () => {
      plays++
      const r = cfgRef.current.repeat
      const again = r === 0 || plays < r
      timer = setTimeout(() => {
        if (cancelled) return
        if (again) start()
        else if (idx < items.length - 1) setIdx(idx + 1)
        else setPlaying(false)
      }, cfgRef.current.gap * 1000)
    }

    start()
    return () => { cancelled = true; clearTimeout(timer); el.onended = null; el.pause() }
  }, [playing, idx, entryUrl, items.length])

  function goTo(next: number) {
    setIdx((next + items.length) % items.length)
  }

  function seek(fraction: number) {
    const el = elRef.current
    if (el.duration) el.currentTime = fraction * el.duration
    setProgress(fraction)
  }

  if (!item) return null
  const waiting = playing && !entryUrl

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.dismiss} onClick={onClose} aria-label="Back to results">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        <div className={styles.label}>Practice set · {capsNoTonos(word)}</div>
        <button className={styles.star} onClick={() => onToggleStar(idx)} aria-label={starred[idx] ? 'Unstar' : 'Star'}>
          <span style={{ color: starred[idx] ? '#E0A33E' : '#B4B4A8' }}>{starred[idx] ? '★' : '☆'}</span>
        </button>
      </div>

      <div className={styles.center}>
        <div className={styles.position}>{idx + 1} of {items.length}</div>
        <p className={`${styles.greek} serif`}>{item.greek}</p>
        <p className={styles.english}>{item.english}</p>
        {item.note && <p className={styles.note}>{item.note}</p>}
        {waiting && <p className={styles.note}>Preparing audio…</p>}
      </div>

      <input
        className={styles.scrub}
        type="range"
        min={0}
        max={1}
        step={0.001}
        value={progress}
        onChange={e => seek(Number(e.target.value))}
        style={{ ['--fill' as string]: `${progress * 100}%` }}
        aria-label="Position"
      />

      <div className={styles.transport}>
        <button className={styles.skipBtn} onClick={() => goTo(idx - 1)} aria-label="Previous">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 5h2v14H6z"/>
            <path d="M18.5 5v14l-11-7 11-7z"/>
          </svg>
        </button>
        <button className={styles.bigPlay} onClick={() => setPlaying(p => !p)} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="#F5F2EC"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="#F5F2EC"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          )}
        </button>
        <button className={styles.skipBtn} onClick={() => goTo(idx + 1)} aria-label="Next">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 5h2v14h-2z"/>
            <path d="M5.5 5v14l11-7-11-7z"/>
          </svg>
        </button>
      </div>

      <div className={styles.knobRow}>
        <button className={styles.knob} onClick={() => setSpeed(cycle(SPEED_CYCLE, speed))}>
          <span className={styles.knobCaption}>Speed</span>
          <span className={styles.knobValue}>{speed === 1 ? '1×' : `${speed}×`}</span>
        </button>
        <button className={styles.knob} onClick={() => setRepeat(cycle(REPEAT_CYCLE, repeat))}>
          <span className={styles.knobCaption}>Repeat</span>
          <span className={styles.knobValue}>{repeat === 0 ? '∞' : `${repeat}×`}</span>
        </button>
        <button className={styles.knob} onClick={() => setGap(cycle(GAP_CYCLE, gap))}>
          <span className={styles.knobCaption}>Gap</span>
          <span className={styles.knobValue}>{gap}s</span>
        </button>
      </div>
    </div>
  )
}
