import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store'
import { getWordGrammarCached } from '../lib/wordInfoCache'
import { generateSpeech } from '../lib/api'
import { normalizeWord, translateWordCached } from '../lib/wordCache'
import { findVerb, type VerbMatch } from '../lib/conjugation'
import type { WordInfo, WordGrammar } from '../lib/api'
import styles from './WordPopup.module.css'

interface Props {
  word: string          // raw tapped token, punctuation and all
  sentence: string       // full Greek sentence, for grammar context
  onPracticeWord: (info: WordInfo) => void
  onOpenConjugation: (lemma: string, word: string) => void
}

// The meaning comes from Google Translate (cached on the device, usually instant), so the
// popup opens straight away. The grammar tags come from a slower Claude call and fill in
// when they arrive.
export default function WordPopup({ word, sentence, onPracticeWord, onOpenConjugation }: Props) {
  const { state } = useApp()
  const [gloss, setGloss] = useState<string | null>(null)
  const [glossFailed, setGlossFailed] = useState(false)
  const [grammar, setGrammar] = useState<WordGrammar | null>(null)
  const [grammarFailed, setGrammarFailed] = useState(false)
  const [verb, setVerb] = useState<VerbMatch | null>(null)
  const [opening, setOpening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const grammarRef = useRef<Promise<WordGrammar> | null>(null)
  const audioRef = useRef<HTMLAudioElement>(new Audio())

  useEffect(() => {
    let cancelled = false
    setGloss(null)
    setGlossFailed(false)
    setGrammar(null)
    setGrammarFailed(false)
    setVerb(null)
    findVerb(word)
      .then(v => { if (!cancelled) setVerb(v) })
      .catch(() => { /* no table for this word — that's fine */ })
    translateWordCached(word)
      .then(g => { if (!cancelled) setGloss(g) })
      .catch(() => { if (!cancelled) setGlossFailed(true) })
    const p = getWordGrammarCached(word, sentence)
    grammarRef.current = p
    p.then(g => { if (!cancelled) setGrammar(g) })
      .catch(() => { if (!cancelled) setGrammarFailed(true) })
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

  // Practice needs the part of speech (it decides whether the tense picker shows), so if
  // the grammar hasn't arrived yet, wait for it rather than guessing.
  async function handlePractice() {
    if (!gloss || opening) return
    setOpening(true)
    let g = grammar
    if (!g) {
      try { g = await grammarRef.current! } catch { g = null }
    }
    onPracticeWord({
      word: normalizeWord(word),
      gloss,
      pos: g?.pos ?? 'other',
      lemma: verb?.lemma ?? g?.lemma ?? undefined,
    })
  }

  // The base form shows as soon as the built-in verb data recognises the word; for verbs it
  // doesn't know, it appears when the grammar lookup supplies one. Either way it's hidden if
  // the grammar lookup says this isn't a verb here (some forms double as other words).
  const candidate = verb?.lemma ?? grammar?.lemma ?? null
  const baseForm = candidate && normalizeWord(candidate) !== normalizeWord(word) && (!grammar || grammar.pos === 'verb')
    ? candidate
    : null

  return (
    <div className={styles.popup} onClick={e => e.stopPropagation()}>
      {glossFailed ? (
        <p className={styles.errorText}>Could not look up this word.</p>
      ) : gloss === null ? (
        <p className={styles.loadingText}>Looking up…</p>
      ) : (
        <>
          <button className={styles.playBtn} onClick={playWord} disabled={speaking} aria-label="Play word">
            ▶
          </button>
          <div className={styles.row1}>
            <span className={`${styles.word} serif`}>{normalizeWord(word)}</span>
            {grammar ? (
              <>
                <span className={styles.pos}>{grammar.pos}</span>
                {grammar.gender && <span className={styles.gender}>{grammar.gender}</span>}
              </>
            ) : !grammarFailed && (
              <span className={`${styles.pos} ${styles.posLoading}`}>…</span>
            )}
            {baseForm && (
              <button className={`${styles.lemma} serif`} onClick={() => onOpenConjugation(baseForm, word)}>
                ← {baseForm}
              </button>
            )}
          </div>
          <p className={styles.gloss}>{gloss}</p>
          {grammar?.details && <p className={styles.details}>{grammar.details}</p>}
          <div className={styles.actions}>
            <button className={styles.practiceBtn} onClick={handlePractice} disabled={opening}>
              {opening ? 'Opening…' : 'Practice this word'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
