import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store'
import { normalizeWord } from '../lib/wordCache'
import { getLearningStatus } from '../lib/mastery'
import type { WordInfo, GeneratedSentence } from '../lib/api'
import InterlinearGreek from './InterlinearGreek'
import WordPopup from './WordPopup'
import SaveToCollectionSheet from './SaveToCollectionSheet'
import WordPracticeSetup, { type PracticeParams } from '../screens/WordPracticeSetup'
import WordPracticeResults from '../screens/WordPracticeResults'
import ConjugationTable from '../screens/ConjugationTable'
import { COLOR_PALETTE, type PlaybackOrder, type GreekSpeed } from '../types'
import styles from './ImmersivePlayer.module.css'

const ORDER_CYCLE: PlaybackOrder[] = ['en', 'gr', 'en-gr', 'gr-en']
const ORDER_LABEL: Record<PlaybackOrder, string> = { en: 'E', gr: 'G', 'en-gr': 'E→G', 'gr-en': 'G→E' }
const SPEED_CYCLE: GreekSpeed[] = [0.7, 0.85, 1.0]
const REPEAT_CYCLE = [1, 2, 3, 0] // 0 = ∞
const GAP_CYCLE = [3, 5, 7, 8, 10]
const MAX_DOTS = 12

interface AudioEntry { blob: Blob; url: string }
interface Props {
  onOpenSentence: (collectionId: string, sentenceId: string, wasPlaying: boolean) => void
  hidden: boolean     // the sentence page is showing on top; the playback session stays as it was
}

export default function ImmersivePlayer({ onOpenSentence, hidden }: Props) {
  const {
    state, dispatch, pauseResume, nextSentence, prevSentence, stopPlayback,
    setGreekSpeed, setPlaybackOrder, setGapSeconds, seek, setLearningStatus,
    generateAudio, createCollection, createSentence,
    uploadAudioBlob, showToast,
  } = useApp()
  const { playback } = state

  const [pickedWord, setPickedWord] = useState<string | null>(null)
  // Blur the Greek so it can be practised by ear/memory; remembered between sessions
  const [hideGreek, setHideGreek] = useState(() => {
    try { return localStorage.getItem('hideGreek') === '1' } catch { return false }
  })
  function toggleHideGreek() {
    setPickedWord(null)
    setHideGreek(h => {
      try { localStorage.setItem('hideGreek', h ? '0' : '1') } catch { /* ignore */ }
      return !h
    })
  }

  // Word Practice sub-flow — see design_handoff_word_practice/README.md. Rendered in
  // place of the normal player body while active; returning to the player leaves
  // playback position untouched (no global nav state needed for this).
  function defaultPracticeParams(): PracticeParams {
    return {
      count: state.settings.practiceDefaultCount ?? 3,
      level: state.settings.practiceDefaultLevel ?? 'A2',
      tenses: ['Present', 'Past', 'Future'],
      genders: ['Masculine', 'Feminine', 'Neuter'],
      numbers: ['Singular', 'Plural'],
    }
  }
  const [practiceInfo, setPracticeInfo] = useState<WordInfo | null>(null)
  const [practiceScreen, setPracticeScreen] = useState<'setup' | 'results'>('setup')
  const [practiceParams, setPracticeParams] = useState<PracticeParams>(defaultPracticeParams)
  const [conj, setConj] = useState<{ lemma: string; word?: string; from: 'player' | 'practice' } | null>(null)
  const [pendingSave, setPendingSave] = useState<{
    items: GeneratedSentence[]; starred: Record<number, boolean>; audio: Record<number, AudioEntry>
  } | null>(null)

  // Ticks while a gap is counting down so "Next in Ns" stays live
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!playback.inGap || playback.paused) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [playback.inGap, playback.paused])

  // A word popup belongs to the sentence it was opened on — drop it when playback moves on.
  const currentSentenceId = playback.queue[playback.qpos]
  useEffect(() => { setPickedWord(null) }, [currentSentenceId])

  // Coming back from the sentence page: if the sentence was deleted there, there's nothing
  // left to show, so end the session rather than leaving an invisible one running
  const wasHidden = useRef(false)
  useEffect(() => {
    if (wasHidden.current && !hidden && playback.active && playback.view === 'immersive') {
      const list = playback.collectionId ? (state.sentences[playback.collectionId] ?? []) : []
      if (!list.some(s => s.id === currentSentenceId)) stopPlayback()
    }
    wasHidden.current = hidden
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden])

  if (hidden || !playback.active || playback.view !== 'immersive') return null

  const col = state.collections.find(c => c.id === playback.collectionId)
  const sentences = playback.collectionId ? (state.sentences[playback.collectionId] ?? []) : []
  const current = sentences.find(s => s.id === playback.queue[playback.qpos])

  function handleWordTap(token: string) {
    setPickedWord(prev => (prev && normalizeWord(prev) === normalizeWord(token)) ? null : token)
  }

  function openPractice(info: WordInfo) {
    if (playback.active && !playback.paused) pauseResume()
    // Remember the sentence being played so the generated set never repeats it
    setPracticeInfo({ ...info, sentence: info.sentence ?? current?.gr ?? undefined })
    setPracticeParams(defaultPracticeParams())
    setPracticeScreen('setup')
    setPickedWord(null)
  }

  function openConjugation(lemma: string, word: string) {
    if (playback.active && !playback.paused) pauseResume()
    setConj({ lemma, word, from: 'player' })
  }

  // Opens this sentence's own page. Playback is paused (not stopped) so the page's
  // "Player" back link returns to exactly where you were.
  function openSentencePage() {
    if (!current) return
    const wasPlaying = !playback.paused
    if (wasPlaying) pauseResume()
    onOpenSentence(current.collectionId, current.id, wasPlaying)
  }

  function closePractice() {
    setPracticeInfo(null)
    setPendingSave(null)
  }

  async function handleConfirmSave(target: 'new' | string, newName: string) {
    if (!practiceInfo || !pendingSave) return
    const collectionId = target === 'new'
      ? (await createCollection({ name: newName, icon: 'book', color: COLOR_PALETTE[0], createdAt: Date.now() })).id
      : target

    const indices = Object.keys(pendingSave.starred).filter(k => pendingSave.starred[+k]).map(Number)
    for (const i of indices) {
      const it = pendingSave.items[i]
      const sentence = await createSentence({
        en: it.english, gr: it.greek, enAudioUrl: null, grAudioUrl: null,
        fav: false, learned: false, collectionId, createdAt: Date.now(),
      }, false, false)
      const entry = pendingSave.audio[i]
      if (entry) await uploadAudioBlob(sentence.id, collectionId, 'gr', entry.blob, state.settings.grVoiceId).catch(() => {})
      if (state.settings.enVoiceId) await generateAudio(sentence.id, collectionId, 'en').catch(() => {})
    }

    showToast(`${indices.length} sentence${indices.length !== 1 ? 's' : ''} saved · narrating now`)
    setPendingSave(null)
  }

  function cycle<T>(arr: T[], value: T): T {
    return arr[(arr.indexOf(value) + 1) % arr.length]
  }

  // Word Practice sub-flow takes over the whole screen while active — its own screens
  // manage their own (light) background/padding, this wrapper is purely structural
  // (fixed overlay + scroll), unlike the dark player .screen below.
  if (conj) {
    return (
      <div className={styles.practiceWrap}>
        <ConjugationTable
          lemma={conj.lemma}
          word={conj.word}
          backLabel={conj.from === 'practice' ? 'Practice' : 'Player'}
          onBack={() => setConj(null)}
          onPractice={info => { setConj(null); openPractice(info) }}
        />
      </div>
    )
  }

  if (practiceInfo) {
    return (
      <div className={styles.practiceWrap}>
        {practiceScreen === 'setup' ? (
          <WordPracticeSetup
            info={practiceInfo}
            params={practiceParams}
            onParamsChange={setPracticeParams}
            onBack={closePractice}
            onGenerate={() => setPracticeScreen('results')}
            onOpenTable={lemma => setConj({ lemma, word: practiceInfo.word, from: 'practice' })}
          />
        ) : (
          <WordPracticeResults
            info={practiceInfo}
            params={practiceParams}
            onBack={() => setPracticeScreen('setup')}
            onSave={(items, starred, audio) => setPendingSave({ items, starred, audio })}
          />
        )}
        {pendingSave && (
          <SaveToCollectionSheet
            word={practiceInfo.word}
            count={Object.values(pendingSave.starred).filter(Boolean).length}
            onClose={() => setPendingSave(null)}
            onConfirm={handleConfirmSave}
          />
        )}
      </div>
    )
  }

  if (!current) return null

  const status = getLearningStatus(current)

  // Only shown when the sentence repeats: which cycle we're on, and how long until the next
  // thing happens (the audio finishing, or the gap before the next repeat/sentence ending)
  const cycleNumber = playback.sentencePlayCount + 1
  const cycleLabel = playback.sentenceRepeat === 0 ? `Cycle ${cycleNumber} · ∞` : `Cycle ${cycleNumber} of ${playback.sentenceRepeat}`
  let timeLabel = ''
  if (playback.paused) timeLabel = 'Paused'
  else if (playback.inGap && playback.gapEndsAt) timeLabel = `Next in ${Math.max(0, Math.ceil((playback.gapEndsAt - now) / 1000))}s`
  else if (playback.duration) timeLabel = `${Math.max(0, Math.ceil(playback.duration * (1 - playback.progress)))}s left`

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.chevron} onClick={stopPlayback} aria-label="Collapse">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        <div className={styles.colName}>{col?.name}</div>
        <div className={styles.headerActions}>
        <button className={styles.sentenceBtn} onClick={toggleHideGreek} aria-label={hideGreek ? 'Show Greek text' : 'Hide Greek text'} aria-pressed={hideGreek}>
          {hideGreek ? (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          )}
        </button>
        <button className={styles.sentenceBtn} onClick={openSentencePage} aria-label="Open sentence page">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 3 14 8 19 8"/>
            <line x1="9" y1="13" x2="15" y2="13"/>
            <line x1="9" y1="17" x2="13" y2="17"/>
          </svg>
        </button>
        </div>
      </div>

      {playback.queue.length > MAX_DOTS ? (
        <div className={styles.compactPos}>{playback.qpos + 1} / {playback.queue.length}</div>
      ) : (
        <div className={styles.dots}>
          {playback.queue.map((_, i) => (
            <div key={i} className={`${styles.dot} ${i === playback.qpos ? styles.dotActive : ''}`} />
          ))}
        </div>
      )}

      <div className={styles.sentenceBlock} onClick={() => setPickedWord(null)}>
        {current.gr ? (
          <p className={`${styles.greek} serif ${hideGreek ? styles.greekHidden : ''}`}>
            <InterlinearGreek
              text={current.gr}
              showPhonetics={state.settings.showPhonetics}
              onWordTap={handleWordTap}
              stackClassName={styles.wordStack}
              wordClassName={styles.grWord}
              phoneticClassName={styles.phonetic}
              selectedWord={pickedWord}
              selectedClassName={styles.grWordSelected}
            />
          </p>
        ) : (
          <p className={styles.greek}>{current.en}</p>
        )}
        {current.gr && <p className={styles.gloss}>{current.en}</p>}

        {pickedWord && current.gr && !hideGreek && (
          <WordPopup
            word={pickedWord}
            sentence={current.gr}
            onPracticeWord={openPractice}
            onOpenConjugation={openConjugation}
          />
        )}
      </div>

      {playback.sentenceRepeat !== 1 && (
        <div className={styles.repeatRow}>
          <span>{cycleLabel}</span>
          <span>{timeLabel}</span>
        </div>
      )}

      <input
        className={styles.scrub}
        type="range"
        min={0}
        max={1}
        step={0.001}
        value={playback.progress}
        onChange={e => seek(Number(e.target.value))}
        style={{ ['--fill' as string]: `${playback.progress * 100}%` }}
      />

      <div className={styles.statusRow}>
        <button
          className={`${styles.statusBtn} ${status === 'learning' ? styles.statusLearning : ''}`}
          onClick={() => setLearningStatus(current.id, current.collectionId, status === 'learning' ? 'new' : 'learning')}
        >
          ↻ Learning
        </button>
        <button
          className={`${styles.statusBtn} ${status === 'mastered' ? styles.statusGot : ''}`}
          onClick={() => setLearningStatus(current.id, current.collectionId, status === 'mastered' ? 'new' : 'mastered')}
        >
          ✓ Got it
        </button>
      </div>

      <div className={styles.transport}>
        <button className={styles.transportBtn} onClick={prevSentence} aria-label="Previous">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 5h2v14H6z"/>
            <path d="M18.5 5v14l-11-7 11-7z"/>
          </svg>
        </button>
        <button
          className={`${styles.bigPlay} ${!playback.paused && !playback.inGap ? styles.bigPlayPulsing : ''}`}
          onClick={pauseResume}
        >
          {playback.paused ? (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="#22261F"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="#22261F"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          )}
        </button>
        <button className={styles.transportBtn} onClick={nextSentence} aria-label="Next">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 5h2v14h-2z"/>
            <path d="M5.5 5v14l11-7-11-7z"/>
          </svg>
        </button>
      </div>

      <div className={styles.knobRow}>
        <button className={styles.knob} onClick={() => setGreekSpeed(cycle(SPEED_CYCLE, playback.greekSpeed))}>
          <span className={styles.knobCaption}>Speed</span>
          <span className={styles.knobValue}>{playback.greekSpeed === 1 ? '1×' : `${playback.greekSpeed}×`}</span>
        </button>
        <button
          className={styles.knob}
          onClick={() => dispatch({ type: 'SET_PLAYBACK', playback: { sentenceRepeat: cycle(REPEAT_CYCLE, playback.sentenceRepeat), sentencePlayCount: 0 } })}
        >
          <span className={styles.knobCaption}>Repeat</span>
          <span className={styles.knobValue}>{playback.sentenceRepeat === 0 ? '∞' : `${playback.sentenceRepeat}×`}</span>
        </button>
        <button className={styles.knob} onClick={() => setGapSeconds(cycle(GAP_CYCLE, playback.gapSeconds))}>
          <span className={styles.knobCaption}>Gap</span>
          <span className={styles.knobValue}>{playback.gapSeconds}s</span>
        </button>
        <button className={styles.knob} onClick={() => setPlaybackOrder(cycle(ORDER_CYCLE, playback.order))}>
          <span className={styles.knobCaption}>Mode</span>
          <span className={styles.knobValue}>{ORDER_LABEL[playback.order]}</span>
        </button>
      </div>
    </div>
  )
}
