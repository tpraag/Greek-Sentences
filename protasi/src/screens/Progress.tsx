import { useState } from 'react'
import { useApp } from '../store'
import { getLearningStatus, countWords, LEARNING_STATUSES, STATUS_COLOR, STATUS_LABEL } from '../lib/mastery'
import { getEligibleSentences } from '../lib/quizSelection'
import QuizBank from './QuizBank'
import styles from './Progress.module.css'

interface Props {
  onBack: () => void
}

export default function Progress({ onBack }: Props) {
  const { state } = useApp()
  const [quizBank, setQuizBank] = useState(false)

  const allSentences = Object.values(state.sentences).flat()

  const masteredSentences = allSentences.filter(s => getLearningStatus(s) === 'mastered')
  const masteredWords = masteredSentences.reduce((sum, s) => sum + countWords(s.gr ?? s.en ?? ''), 0)

  const breakdown: Record<string, number> = { new: 0, learning: 0, good: 0, mastered: 0 }
  for (const s of allSentences) breakdown[getLearningStatus(s)]++

  const attempts = allSentences.reduce((sum, s) => sum + (s.quizAttempts ?? 0), 0)
  const correct = allSentences.reduce((sum, s) => sum + (s.quizCorrect ?? 0), 0)
  const accuracy = attempts >= 3 ? Math.round((correct / attempts) * 100) : null

  const eligibleForQuiz = getEligibleSentences(allSentences).length

  if (quizBank) {
    return <QuizBank onBack={() => setQuizBank(false)} />
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.back} onClick={onBack}>
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="7 1 1 7 7 13" />
          </svg>
          Library
        </button>
        <h1 className={styles.title}>Progress</h1>
      </div>

      <div className="screen-scroll" style={{ paddingTop: 0 }}>
        <div className={styles.body}>
          <div className={styles.statGrid}>
            <div className={`card ${styles.statCard}`}>
              <span className={styles.statValue}>{state.progress.lifetimeMasteryPoints}</span>
              <span className={styles.statLabel}>Mastery Points</span>
            </div>
            <div className={`card ${styles.statCard}`}>
              <span className={styles.statValue}>{masteredSentences.length}</span>
              <span className={styles.statLabel}>Mastered sentences</span>
            </div>
            <div className={`card ${styles.statCard}`}>
              <span className={styles.statValue}>{masteredWords}</span>
              <span className={styles.statLabel}>Mastered words</span>
            </div>
            <div className={`card ${styles.statCard}`}>
              <span className={styles.statValue}>{accuracy !== null ? `${accuracy}%` : '—'}</span>
              <span className={styles.statLabel}>Quiz accuracy</span>
            </div>
          </div>

          <div className="label" style={{ margin: '24px 0 8px' }}>By learning status</div>
          <div className={`card ${styles.breakdownCard}`}>
            {LEARNING_STATUSES.map((status, i) => (
              <div key={status}>
                <div className={styles.breakdownRow}>
                  <span className={styles.breakdownDot} style={{ background: STATUS_COLOR[status] }} />
                  <span className={styles.breakdownLabel}>{STATUS_LABEL[status]}</span>
                  <span className={styles.breakdownCount}>{breakdown[status]}</span>
                </div>
                {i < LEARNING_STATUSES.length - 1 && <div className="hairline" />}
              </div>
            ))}
          </div>

          <div className="label" style={{ margin: '24px 0 8px' }}>Quiz</div>
          <button className={`card ${styles.quizCard}`} onClick={() => setQuizBank(true)}>
            <div>
              <div className={styles.quizTitle}>Start a quiz</div>
              <div className={styles.quizSub}>
                {eligibleForQuiz > 0
                  ? `${eligibleForQuiz} mastered sentence${eligibleForQuiz !== 1 ? 's' : ''} ready`
                  : 'Master a sentence to unlock quizzing'}
              </div>
            </div>
            <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 1 7 7 1 13" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
