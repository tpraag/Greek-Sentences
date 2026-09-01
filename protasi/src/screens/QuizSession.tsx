import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store'
import { transliterateGreek } from '../lib/transliterate'
import type { Sentence, QuizResult } from '../types'
import styles from './QuizSession.module.css'

interface Props {
  sentences: Sentence[]
  onExit: () => void
}

interface Tally { correct: number; almost: number; incorrect: number }

export default function QuizSession({ sentences, onExit }: Props) {
  const { state, startPlayback, recordQuizResult, setLearningStatus } = useApp()
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [rated, setRated] = useState<QuizResult | null>(null)
  const [tally, setTally] = useState<Tally>({ correct: 0, almost: 0, incorrect: 0 })
  const playedEnRef = useRef(-1)

  const sentence = sentences[index]
  const finished = index >= sentences.length

  useEffect(() => {
    if (finished || !sentence) return
    if (playedEnRef.current === index) return
    playedEnRef.current = index
    startPlayback(sentence.collectionId, [sentence.id], {
      order: 'en', gapSeconds: 0, view: 'compact', greekSpeed: state.settings.greekSpeed,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, finished])

  if (finished) {
    const total = tally.correct + tally.almost + tally.incorrect
    return (
      <div className={styles.screen}>
        <div className={styles.summary}>
          <h1 className={styles.summaryTitle}>Quiz complete</h1>
          <div className={styles.summaryGrid}>
            <div><span className={styles.summaryValue}>{tally.correct}</span><span className={styles.summaryLabel}>Correct</span></div>
            <div><span className={styles.summaryValue}>{tally.almost}</span><span className={styles.summaryLabel}>Almost</span></div>
            <div><span className={styles.summaryValue}>{tally.incorrect}</span><span className={styles.summaryLabel}>Incorrect</span></div>
          </div>
          <p className={styles.summarySub}>{total} sentence{total !== 1 ? 's' : ''} reviewed</p>
          <button className="btn-accent" onClick={onExit}>Done</button>
        </div>
      </div>
    )
  }

  function playEn() {
    startPlayback(sentence.collectionId, [sentence.id], {
      order: 'en', gapSeconds: 0, view: 'compact', greekSpeed: state.settings.greekSpeed,
    })
  }

  function reveal() {
    setRevealed(true)
    startPlayback(sentence.collectionId, [sentence.id], {
      order: 'gr', gapSeconds: 0, view: 'compact', greekSpeed: state.settings.greekSpeed,
    })
  }

  function playGr() {
    startPlayback(sentence.collectionId, [sentence.id], {
      order: 'gr', gapSeconds: 0, view: 'compact', greekSpeed: state.settings.greekSpeed,
    })
  }

  function rate(result: QuizResult) {
    recordQuizResult(sentence.id, sentence.collectionId, result)
    setTally(t => ({ ...t, [result]: t[result] + 1 }))
    setRated(result)
  }

  function next() {
    setIndex(i => i + 1)
    setRevealed(false)
    setRated(null)
  }

  function downgrade() {
    setLearningStatus(sentence.id, sentence.collectionId, 'good')
    next()
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.back} onClick={onExit}>
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="7 1 1 7 7 13" />
          </svg>
          Exit quiz
        </button>
        <span className={styles.counter}>{index + 1} / {sentences.length}</span>
      </div>

      <div className={`screen-scroll ${state.playback.active ? 'with-player' : ''}`}>
        <div className={styles.body}>
          <div className={styles.label}>English</div>
          <p className={styles.en}>{sentence.en}</p>
          <button className={styles.replayBtn} onClick={playEn}>
            <svg width="12" height="14" viewBox="0 0 14 16" fill="currentColor"><polygon points="1 1 13 8 1 15" /></svg>
            Play again
          </button>

          {!revealed ? (
            <button className={styles.revealBtn} onClick={reveal}>Reveal Greek</button>
          ) : (
            <>
              <div className="hairline" style={{ margin: '24px 0' }} />
              <div className={styles.label}>Ελληνικά</div>
              <p className={`${styles.gr} serif`}>{sentence.gr}</p>
              {state.settings.showPhonetics && sentence.gr && (
                <p className={styles.phonetic}>{transliterateGreek(sentence.gr)}</p>
              )}
              <button className={styles.replayBtn} onClick={playGr}>
                <svg width="12" height="14" viewBox="0 0 14 16" fill="currentColor"><polygon points="1 1 13 8 1 15" /></svg>
                Play again
              </button>

              {!rated ? (
                <div className={styles.rateRow}>
                  <button className={`${styles.rateBtn} ${styles.incorrect}`} onClick={() => rate('incorrect')}>Incorrect</button>
                  <button className={`${styles.rateBtn} ${styles.almost}`} onClick={() => rate('almost')}>Almost</button>
                  <button className={`${styles.rateBtn} ${styles.correct}`} onClick={() => rate('correct')}>Correct</button>
                </div>
              ) : rated === 'incorrect' ? (
                <div className={styles.downgradePanel}>
                  <p className={styles.downgradeText}>Move this sentence back to Good?</p>
                  <div className={styles.downgradeRow}>
                    <button className="btn-outline" onClick={downgrade}>Move back to Good</button>
                    <button className="btn-accent" onClick={next}>Keep as Mastered</button>
                  </div>
                </div>
              ) : (
                <button className="btn-accent" style={{ marginTop: 20 }} onClick={next}>
                  {index + 1 < sentences.length ? 'Next sentence' : 'Finish quiz'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
