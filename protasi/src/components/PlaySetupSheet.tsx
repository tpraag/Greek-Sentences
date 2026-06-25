import { useState } from 'react'
import { useApp } from '../store'
import type { PlaybackOrder, PlayerView, GreekSpeed } from '../types'
import styles from './PlaySetupSheet.module.css'

interface Props {
  count: number
  onStart: (opts: { order: PlaybackOrder; gapSeconds: number; view: PlayerView; greekSpeed: GreekSpeed }) => void
  onClose: () => void
}

const ORDER_LABELS: Record<PlaybackOrder, string> = {
  en: 'English only',
  gr: 'Greek only',
  'en-gr': 'EN → GR',
  'gr-en': 'GR → EN',
}

export default function PlaySetupSheet({ count, onStart, onClose }: Props) {
  const { state } = useApp()
  const [order, setOrder] = useState<PlaybackOrder>(state.settings.order)
  const [gap, setGap] = useState(state.settings.gapSeconds)
  const [view, setView] = useState<PlayerView>(state.settings.defaultPlayerView)

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
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
          <span className="label">While playing</span>
          <div className={styles.chips}>
            <button className={`chip ${view === 'compact' ? 'active' : ''}`} onClick={() => setView('compact')}>Compact bar</button>
            <button className={`chip ${view === 'immersive' ? 'active' : ''}`} onClick={() => setView('immersive')}>Immersive</button>
          </div>
        </div>

        <button
          className="btn-accent"
          style={{ marginTop: 8 }}
          onClick={() => onStart({ order, gapSeconds: gap, view, greekSpeed: state.settings.greekSpeed })}
        >
          Start playing
        </button>
      </div>
    </div>
  )
}
