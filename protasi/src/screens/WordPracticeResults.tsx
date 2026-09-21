import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store'
import { generatePracticeSentences, generateSpeech, translateGreekWordToEnglish, type WordInfo, type GeneratedSentence } from '../lib/api'
import { disagrees } from '../lib/sentenceCheck'
import PracticePlayer from '../components/PracticePlayer'
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
  // Sentences whose meaning Google Translate reads differently from Claude's — index → Google's English
  const [flags, setFlags] = useState<Record<number, string>>({})
  const [playingIdx, setPlayingIdx] = useState<number | null>(null)
  const [playerOpen, setPlayerOpen] = useState(false)
  const [audio, setAudio] = useState<Record<number, AudioEntry>>({})
  const audioElRef = useRef<HTMLAudioElement>(new Audio())

  async function generate() {
    setLoading(true)
    setErrored(false)
    setItems([])
    setStarred({})
    setFlags({})
    setAudio({})
    try {
      const sentences = await generatePracticeSentences({
        word: info.word, gloss: info.gloss, pos: info.pos,
        count: params.count, level: params.level, tenses: params.tenses,
        genders: params.genders, numbers: params.numbers, avoid: info.sentence,
      })
      if (!sentences.length) throw new Error('empty')
      setItems(sentences)
      setLoading(false)
      // Independent second opinion, in parallel with everything else: read each Greek
      // sentence back into English and flag any that don't match what Claude says it means
      sentences.forEach((s, i) => {
        translateGreekWordToEnglish(s.greek)
          .then(g => { if (disagrees(s.english, g)) setFlags(f => ({ ...f, [i]: g })) })
          .catch(() => { /* no check available — say nothing */ })
      })
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

  function openPlayer() {
    audioElRef.current.pause()
    setPlayingIdx(null)
    setPlayerOpen(true)
  }

  const hasAudio = Object.keys(audio).length > 0
  const starCount = Object.values(starred).filter(Boolean).length
  const meta = loading ? `Level ${params.level}` : `${items.length} sentence${items.length !== 1 ? 's' : ''} · level ${params.level} · audio ready`

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.topRow}>
          <button className={styles.back} onClick={onBack}>‹ Practice Setup</button>
          {!loading && !errored && (
            <button className={styles.playAll} onClick={openPlayer} disabled={!hasAudio}>
              <svg width="11" height="12" viewBox="0 0 12 14" fill="currentColor"><polygon points="1 1 11 7 1 13"/></svg>
              Play all
            </button>
          )}
        </div>
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
                {flags[i] && (
                  <p className={styles.flag}>Worth double-checking — Google reads this as “{flags[i]}”</p>
                )}
              </div>
              <button className={styles.star} onClick={() => toggleStar(i)}>
                <span style={{ color: starred[i] ? '#C9A227' : '#C9C6BA' }}>{starred[i] ? '★' : '☆'}</span>
              </button>
            </div>
          ))
        )}
      </div>

      {playerOpen && (
        <PracticePlayer
          word={info.word}
          items={items}
          audio={audio}
          starred={starred}
          onToggleStar={toggleStar}
          onClose={() => setPlayerOpen(false)}
        />
      )}

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
