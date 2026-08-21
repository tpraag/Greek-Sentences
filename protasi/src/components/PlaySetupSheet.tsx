import { useState, useRef } from 'react'
import { useApp } from '../store'
import type { PlaybackOrder, PlayerView, GreekSpeed } from '../types'
import styles from './PlaySetupSheet.module.css'

interface Props {
  count: number
  onStart: (opts: { order: PlaybackOrder; gapSeconds: number; view: PlayerView; greekSpeed: GreekSpeed; loopList: boolean; sentenceRepeat: number }) => void
  onClose: () => void
}

const ORDER_LABELS: Record<PlaybackOrder, string> = {
  en: 'English only',
  gr: 'Greek only',
  'en-gr': 'EN → GR',
  'gr-en': 'GR → EN',
}

const REPEAT_OPTIONS = [1, 2, 3, 0] // 0 = ∞
const repeatLabel = (n: number) => n === 0 ? '∞' : `${n}×`

export default function PlaySetupSheet({ count, onStart, onClose }: Props) {
  const { state } = useApp()
  const [order, setOrder] = useState<PlaybackOrder>(state.settings.order)
  const [gap, setGap] = useState(state.settings.gapSeconds)
  const [view, setView] = useState<PlayerView>(state.settings.defaultPlayerView)
  const [speed, setSpeed] = useState<GreekSpeed>(state.settings.greekSpeed)
  const [repeat, setRepeat] = useState(state.settings.sentenceRepeat ?? 1)
  const [loopList, setLoopList] = useState(false)

  // Slide-down dismiss: animate out on close, and allow swipe-down to dismiss
  const [closing, setClosing] = useState(false)
  const [dragY, setDragY] = useState(0)
  const dragStart = useRef<number | null>(null)

  function close() {
    setClosing(true)
    setTimeout(onClose, 220)
  }

  function onTouchStart(e: React.TouchEvent) {
    dragStart.current = e.touches[0].clientY
  }
  function onTouchMove(e: React.TouchEvent) {
    if (dragStart.current === null) return
    const dy = e.touches[0].clientY - dragStart.current
    if (dy > 0) setDragY(dy)
  }
  function onTouchEnd() {
    if (dragY > 100) close()
    else setDragY(0)
    dragStart.current = null
  }

  return (
    <div
      className={`${styles.overlay} ${closing ? styles.overlayClosing : ''}`}
      onClick={close}
    >
      <div
        className={`${styles.sheet} ${closing ? styles.sheetClosing : ''}`}
        onClick={e => e.stopPropagation()}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
      >
        <div
          className={styles.handleZone}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="sheet-handle" />
        </div>
        <h2 className={styles.title}>Play all</h2>
        <p className={styles.count}>{count} sentence{count !== 1 ? 's' : ''}</p>

        <div className={styles.section}>
          <span className="label">Order</span>
          <div className={styles.chips}>
            {(Object.keys(ORDER_LABELS) as PlaybackOrder[]).map(o => (
              <button key={o} className={`chip ${order === o ? 'active' : ''}`} onClick={() => setOrder(o)}>
                {ORDER_LABELS[o]}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <span className="label">Pause between sentences</span>
          <div className={styles.stepper}>
            <button className={styles.stepBtn} onClick={() => setGap(g => Math.max(0, g - 1))}>−</button>
            <span className={styles.stepVal}>{gap}s</span>
            <button className={styles.stepBtn} onClick={() => setGap(g => Math.min(10, g + 1))}>+</button>
          </div>
        </div>

        <div className={styles.section}>
          <span className="label">Repeat each sentence</span>
          <div className="segmented">
            {REPEAT_OPTIONS.map(n => (
              <button key={n} className={repeat === n ? 'active' : ''} onClick={() => setRepeat(n)}>
                {repeatLabel(n)}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <span className="label">Greek speed</span>
          <div className="segmented">
            {([0.7, 0.85, 1.0] as GreekSpeed[]).map(s => (
              <button key={s} className={speed === s ? 'active' : ''} onClick={() => setSpeed(s)}>
                {s === 1.0 ? '1×' : `${s}×`}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <span className="label">While playing</span>
          <div className={styles.chips}>
            <button className={`chip ${view === 'compact' ? 'active' : ''}`} onClick={() => setView('compact')}>Compact bar</button>
            <button className={`chip ${view === 'immersive' ? 'active' : ''}`} onClick={() => setView('immersive')}>Immersive</button>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.loopRow}>
            <span className={styles.loopLabel}>Loop playlist</span>
            <label className="switch">
              <input type="checkbox" checked={loopList} onChange={e => setLoopList(e.target.checked)} />
              <div className="switch-track" />
            </label>
          </div>
        </div>

        <button
          className="btn-accent"
          style={{ marginTop: 8 }}
          onClick={() => onStart({ order, gapSeconds: gap, view, greekSpeed: speed, loopList, sentenceRepeat: repeat })}
        >
          Start playing
        </button>
      </div>
    </div>
  )
}
