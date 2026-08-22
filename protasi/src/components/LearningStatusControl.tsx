import { useState } from 'react'
import { LEARNING_STATUSES, STATUS_COLOR, STATUS_LABEL, getLearningStatus } from '../lib/mastery'
import MasteryConfirmSheet from './MasteryConfirmSheet'
import type { LearningStatus, Sentence } from '../types'
import styles from './LearningStatusControl.module.css'

interface Props {
  sentence: Sentence
  onChange: (status: LearningStatus) => void
}

export default function LearningStatusControl({ sentence, onChange }: Props) {
  const [confirming, setConfirming] = useState(false)
  const value = getLearningStatus(sentence)

  function handlePick(status: LearningStatus) {
    // Marking Mastered permanently awards points — confirm first so an accidental tap can't do it.
    if (status === 'mastered' && value !== 'mastered') {
      setConfirming(true)
      return
    }
    onChange(status)
  }

  return (
    <div className={styles.group}>
      {LEARNING_STATUSES.map(status => {
        const active = value === status
        return (
          <button
            key={status}
            className={`${styles.btn} ${active ? styles.active : ''}`}
            style={active ? { color: STATUS_COLOR[status] } : undefined}
            onClick={() => handlePick(status)}
          >
            <span className={styles.dot} style={{ background: STATUS_COLOR[status] }} />
            {STATUS_LABEL[status]}
          </button>
        )
      })}

      {confirming && (
        <MasteryConfirmSheet
          sentence={sentence}
          onConfirm={() => { onChange('mastered'); setConfirming(false) }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  )
}
