import { useState } from 'react'
import { useApp } from '../store'
import { getEligibleSentences, selectQuizSentences } from '../lib/quizSelection'
import QuizSession from './QuizSession'
import type { Sentence } from '../types'
import styles from './QuizBank.module.css'

interface Props {
  onBack: () => void
}

const QUICK_SIZE = 5
const FULL_SIZE = 10

export default function QuizBank({ onBack }: Props) {
  const { state } = useApp()
  const [session, setSession] = useState<Sentence[] | null>(null)

  const allSentences = Object.values(state.sentences).flat()
  const eligible = getEligibleSentences(allSentences)

  function start(size: number) {
    setSession(selectQuizSentences(allSentences, size))
  }

  if (session) {
    return <QuizSession sentences={session} onExit={() => setSession(null)} />
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.back} onClick={onBack}>
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="7 1 1 7 7 13" />
          </svg>
          Progress
        </button>
        <h1 className={styles.title}>Quiz Bank</h1>
        <p className={styles.sub}>
          {eligible.length} mastered sentence{eligible.length !== 1 ? 's' : ''} eligible
        </p>
      </div>

      <div className="screen-scroll" style={{ paddingTop: 0 }}>
        <div className={styles.body}>
          {eligible.length === 0 ? (
            <p className={styles.empty}>Master a sentence first to unlock quizzing.</p>
          ) : (
            <div className={styles.options}>
              <button className={styles.optionCard} onClick={() => start(QUICK_SIZE)}>
                <div className={styles.optionTitle}>Quick Quiz</div>
                <div className={styles.optionSub}>{Math.min(QUICK_SIZE, eligible.length)} sentence{Math.min(QUICK_SIZE, eligible.length) !== 1 ? 's' : ''}</div>
              </button>
              <button className={styles.optionCard} onClick={() => start(FULL_SIZE)}>
                <div className={styles.optionTitle}>Full Quiz</div>
                <div className={styles.optionSub}>{Math.min(FULL_SIZE, eligible.length)} sentence{Math.min(FULL_SIZE, eligible.length) !== 1 ? 's' : ''}</div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
