import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store'
import { generatePracticeSentences, generateSpeech, type WordInfo, type GeneratedSentence } from '../lib/api'
import type { PracticeParams } from './WordPracticeSetup'
import styles from './WordPracticeResults.module.css'

interface AudioEntry { blob: Blob; url: string }

interface Props {
  info: WordInfo
  params: PracticeParams
  onBack: () => void
  onSave: (items: GeneratedSentence[], starred: Record<number, boolean>, audio: Record<number, AudioEntry>) => void
}

export default function WordPracticeResults({ info, params, onBack, onSave }: Props) {
  const { state } = useApp()
  const [loading, setLoading] = useState(true)
  const [errored, setErrored] = useState(false)
  const [items, setItems] = useState<GeneratedSentence[]>([])
  const [starred, setStarred] = useState<Record<number, boolean>>({})
  const [playingIdx, setPlayingIdx] = useState<number | null>(null)
  const [audio, setAudio] = useState<Record<number, AudioEntry>>({})
  const audioElRef = useRef<HTMLAudioElement>(new Audio())

  async function generate() {
    setLoading(true)
    setErrored(false)
    setItems([])
    setStarred({})
    setAudio({})
    try {
      const sentences = await generatePracticeSentences({
        word: info.word, gloss: info.gloss, pos: info.pos,
        count: params.count, level: params.level, tenses: params.tenses,
      })
      if (!sentences.length) throw new Error('empty')
      setItems(sentences)
      setLoading(false)
      // Audio ready up front, not on first tap — generate every row's Greek narration
      // in the background as soon as the list arrives, one at a time so we don't burst
      // the TTS API. Each row's play button lights up as its audio finishes.
      if (state.settings.grVoiceId) {
        for (let i = 0; i < sentences.length; i++) {
          try {
            const blob = await generateSpeech(sentences[i].greek, state.settings.grVoiceId)
            setAudio(a => ({ ...a, [i]: { blob, url: URL.createObjectURL(blob) } }))
          } catch {
            /* that row just won't be playable — starring/saving still works */
          }
        }
      }
    } catch {
      setErrored(true)
      setLoading(false)
    }
  }

  useEffect(() => { generate() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleStar(i: number) {
    setStarred(s => ({ ...s, [i]: !s[i] }))
  }

  function togglePlay(i: number) {
    const entry = audio[i]
    if (!entry) return
    if (playingIdx === i) {
      audioElRef.current.pause()
      setPlayingIdx(null)
      return
    }
    audioElRef.current.src = entry.url
    audioElRef.current.onended = () => setPlayingIdx(null)
    audioElRef.current.play()
    setPlayingIdx(i)
  }

  const starCount = Object.values(starred).filter(Boolean).length
  const meta = loading ? `Level ${params.level}` : `${items.length} sentence${items.length !== 1 ? 's' : ''} · level ${params.level} · audio ready`

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.back} onClick={onBack}>‹ Practice Setup</button>
        <div className={styles.wordRow}>
          <span className={`${styles.word} serif`}>{info.word}</span>
          <span className={styles.gloss}>{info.gloss}</span>
        </div>
        <p className={styles.meta}>{meta}</p>
      </div>

      <div className={styles.list}>
        {loading ? (
          <div className={styles.centerState}>
            <div className={styles.spinner} />
            <p className={styles.centerText}>Writing sentences…</p>
          </div>
        ) : errored ? (
          <div className={styles.centerState}>
            <div className={styles.errorCard}>
              Couldn't reach Claude just now.
            </div>
            <button className={styles.retryBtn} onClick={generate}>Try again</button>
          </div>
        ) : (
          items.map((it, i) => (
            <div key={i} className={styles.row}>
              <button
                className={`${styles.playBtn} ${playingIdx === i ? styles.playBtnActive : ''}`}
                onClick={() => togglePlay(i)}
                disabled={!audio[i]}
              >
                {playingIdx === i ? '❚❚' : '▶'}
              </button>
              <div className={styles.rowMid}>
                <p className={`${styles.greek} serif`}>{it.greek}</p>
                <p className={styles.english}>{it.english}</p>
                {it.note && <p className={styles.note}>{it.note}</p>}
              </div>
              <button className={styles.star} onClick={() => toggleStar(i)}>
                <span style={{ color: starred[i] ? '#C9A227' : '#C9C6BA' }}>{starred[i] ? '★' : '☆'}</span>
              </button>
            </div>
          ))
        )}
      </div>

      {starCount > 0 && !loading && (
        <div className={styles.saveBar}>
          <button
            className={styles.saveBtn}
            onClick={() => onSave(items, starred, audio)}
          >
            Save {starCount} sentence{starCount !== 1 ? 's' : ''}
          </button>
        </div>
      )}
    </div>
  )
}
