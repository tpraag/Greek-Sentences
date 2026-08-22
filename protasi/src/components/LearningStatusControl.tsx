import { LEARNING_STATUSES, STATUS_COLOR, STATUS_LABEL } from '../lib/mastery'
import type { LearningStatus } from '../types'
import styles from './LearningStatusControl.module.css'

interface Props {
  value: LearningStatus
  onChange: (status: LearningStatus) => void
}

export default function LearningStatusControl({ value, onChange }: Props) {
  return (
    <div className={styles.group}>
      {LEARNING_STATUSES.map(status => {
        const active = value === status
        return (
          <button
            key={status}
            className={`${styles.btn} ${active ? styles.active : ''}`}
            style={active ? { color: STATUS_COLOR[status] } : undefined}
            onClick={() => onChange(status)}
          >
            <span className={styles.dot} style={{ background: STATUS_COLOR[status] }} />
            {STATUS_LABEL[status]}
          </button>
        )
      })}
    </div>
  )
}
