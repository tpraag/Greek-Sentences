import { countWords, calcMasteryPoints } from '../lib/mastery'
import type { Sentence } from '../types'

interface Props {
  sentence: Sentence
  onConfirm: () => void
  onCancel: () => void
}

export default function MasteryConfirmSheet({ sentence, onConfirm, onCancel }: Props) {
  const points = calcMasteryPoints(countWords(sentence.gr ?? sentence.en ?? ''))

  return (
    <div className="sheet-overlay" onClick={onCancel}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h3 style={{ fontSize: 17, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>
          Mark as Mastered?
        </h3>
        <p style={{ fontSize: 14, color: 'var(--ink-soft)', textAlign: 'center', marginBottom: 20, lineHeight: 1.5 }}>
          {sentence.masteryPointsAwarded
            ? "You've already earned points for this sentence, so this won't add more — it'll just bring it back into your Mastered Quiz Bank."
            : `You'll earn +${points} Mastery Point${points !== 1 ? 's' : ''}. This can't be undone later.`}
        </p>
        <button className="btn-accent" onClick={onConfirm}>Mark as Mastered</button>
        <button className="btn-outline" style={{ marginTop: 10, width: '100%' }} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
