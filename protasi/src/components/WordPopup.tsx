import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store'
import { getWordInfoCached } from '../lib/wordInfoCache'
import { generateSpeech } from '../lib/api'
import { normalizeWord } from '../lib/wordCache'
import type { WordInfo } from '../lib/api'
import styles from './WordPopup.module.css'

interface Props {
  word: string          // raw tapped token, punctuation and all
  sentence: string       // full Greek sentence, for gloss context
  onClose: () => void
  onPracticeWord: (info: WordInfo) => void
}

export default function WordPopup({ word, sentence, onClose, onPracticeWord }: Props) {
  const { state } = useApp()
  const [info, setInfo] = useState<WordInfo | null>(null)
  const [error, setError] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(new Audio())

  useEffect(() => {
    let cancelled = false
    setInfo(null)
    setError(false)
    getWordInfoCached(word, sentence)
      .then(i => { if (!cancelled) setInfo(i) })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word])

  async function playWord() {
    if (speaking || !state.settings.grVoiceId) return
    setSpeaking(true)
    try {
      const clean = normalizeWord(word)
      const blob = await generateSpeech(clean, state.settings.grVoiceId)
      audioRef.current.src = URL.createObjectURL(blob)
      await audioRef.current.play()
    } catch {
      /* ignore — a failed one-off word playback isn't worth surfacing */
    } finally {
      setSpeaking(false)
    }
  }

  return (
    <div className={styles.popup} onClick={e => e.stopPropagation()}>
      {error ? (
        <p className={styles.errorText}>Could not look up this word.</p>
      ) : !info ? (
        <p className={styles.loadingText}>Looking up…</p>
      ) : (
        <>
          <div className={styles.row1}>
            <span className={`${styles.word} serif`}>{normalizeWord(word)}</span>
            <span className={styles.pos}>{info.pos}</span>
          </div>
          <p className={styles.gloss}>{info.gloss}</p>
          <div className={styles.actions}>
            <button className={styles.playBtn} onClick={playWord} disabled={speaking} aria-label="Play word">
              ▶
            </button>
            <button className={styles.practiceBtn} onClick={() => onPracticeWord(info)}>
              Practice this word
            </button>
          </div>
        </>
      )}
      <button className={styles.close} onClick={onClose} aria-label="Close">✕</button>
    </div>
  )
}
