import { useState } from 'react'
import { useApp } from '../store'
import { normalizeWord } from '../lib/wordCache'
import { getLearningStatus } from '../lib/mastery'
import type { WordInfo, GeneratedSentence } from '../lib/api'
import InterlinearGreek from './InterlinearGreek'
import WordPopup from './WordPopup'
import SaveToCollectionSheet from './SaveToCollectionSheet'
import WordPracticeSetup, { type PracticeParams } from '../screens/WordPracticeSetup'
import WordPracticeResults from '../screens/WordPracticeResults'
import { COLOR_PALETTE, type PlaybackOrder, type GreekSpeed } from '../types'
import styles from './ImmersivePlayer.module.css'

const ORDER_CYCLE: PlaybackOrder[] = ['en', 'gr', 'en-gr', 'gr-en']
const ORDER_LABEL: Record<PlaybackOrder, string> = { en: 'E', gr: 'G', 'en-gr': 'E→G', 'gr-en': 'G→E' }
const SPEED_CYCLE: GreekSpeed[] = [0.7, 0.85, 1.0]
const REPEAT_CYCLE = [1, 2, 3, 0] // 0 = ∞
const GAP_CYCLE = [3, 5, 7, 10]
const MAX_DOTS = 12

interface AudioEntry { blob: Blob; url: string }
interface Props {
  onEditSentence: (collectionId: string, sentenceId: string) => void
}

export default function ImmersivePlayer({ onEditSentence }: Props) {
  const {
    state, dispatch, pauseResume, nextSentence, prevSentence, stopPlayback,
    setGreekSpeed, setPlaybackOrder, setGapSeconds, seek, setLearningStatus,
    updateSentence, deleteSentence, generateAudio, createCollection, createSentence,
    uploadAudioBlob, showToast,
  } = useApp()
  const { playback } = state

  const [pickedWord, setPickedWord] = useState<string | null>(null)
  const [overflowOpen, setOverflowOpen] = useState(false)
  const [addToCollectionOpen, setAddToCollectionOpen] = useState(false)
  const [recording, setRecording] = useState(false)

  // Word Practice sub-flow — see design_handoff_word_practice/README.md. Rendered in
  // place of the normal player body while active; returning to the player leaves
  // playback position untouched (no global nav state needed for this).
  function defaultPracticeParams(): PracticeParams {
    return {
      count: state.settings.practiceDefaultCount ?? 3,
      level: state.settings.practiceDefaultLevel ?? 'A2',
      tenses: ['Present', 'Past', 'Future'],
    }
  }
  const [practiceInfo, setPracticeInfo] = useState<WordInfo | null>(null)
  const [practiceScreen, setPracticeScreen] = useState<'setup' | 'results'>('setup')
  const [practiceParams, setPracticeParams] = useState<PracticeParams>(defaultPracticeParams)
  const [pendingSave, setPendingSave] = useState<{
    items: GeneratedSentence[]; starred: Record<number, boolean>; audio: Record<number, AudioEntry>
  } | null>(null)

  if (!playback.active || playback.view !== 'immersive') return null

  const col = state.collections.find(c => c.id === playback.collectionId)
  const sentences = playback.collectionId ? (state.sentences[playback.collectionId] ?? []) : []
  const current = sentences.find(s => s.id === playback.queue[playback.qpos])

  function handleWordTap(token: string) {
    setPickedWord(prev => (prev && normalizeWord(prev) === normalizeWord(token)) ? null : token)
  }

  function openPractice(info: WordInfo) {
    if (playback.active && !playback.paused) pauseResume()
    setPracticeInfo(info)
    setPracticeParams(defaultPracticeParams())
    setPracticeScreen('setup')
    setPickedWord(null)
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
      if (entry) await uploadAudioBlob(sentence.id, collectionId, 'gr', entry.blob).catch(() => {})
      if (state.settings.enVoiceId) await generateAudio(sentence.id, collectionId, 'en').catch(() => {})
    }

    showToast(`${indices.length} sentence${indices.length !== 1 ? 's' : ''} saved · narrating now`)
    setPendingSave(null)
  }

  function handleAddToCollection(targetId: string) {
    if (!current) return
    createSentence({
      en: current.en, gr: current.gr, enAudioUrl: current.enAudioUrl, grAudioUrl: current.grAudioUrl,
      fav: false, learned: false, collectionId: targetId, createdAt: Date.now(),
    }, false, false)
    const target = state.collections.find(c => c.id === targetId)
    showToast(`Added to ${target?.name ?? 'collection'}`)
    setAddToCollectionOpen(false)
    setOverflowOpen(false)
  }

  function handleRegenerate() {
    if (!current) return
    updateSentence(current.id, current.collectionId, { enAudioUrl: null, grAudioUrl: null })
    if (current.en) generateAudio(current.id, current.collectionId, 'en')
    if (current.gr) generateAudio(current.id, current.collectionId, 'gr')
    setOverflowOpen(false)
  }

  async function handleDelete() {
    if (!current) return
    if (!confirm('Delete this sentence permanently?')) return
    await deleteSentence(current.id, current.collectionId)
    stopPlayback()
  }

  function cycle<T>(arr: T[], value: T): T {
    return arr[(arr.indexOf(value) + 1) % arr.length]
  }

  // Word Practice sub-flow takes over the whole screen while active — its own screens
  // manage their own (light) background/padding, this wrapper is purely structural
  // (fixed overlay + scroll), unlike the dark player .screen below.
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

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.chevron} onClick={stopPlayback} aria-label="Collapse">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        <div className={styles.colName}>{col?.name}</div>
        <div className={styles.headerSpacer} />
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
          <p className={`${styles.greek} serif`}>
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

        {pickedWord && current.gr && (
          <WordPopup
            word={pickedWord}
            sentence={current.gr}
            onClose={() => setPickedWord(null)}
            onPracticeWord={openPractice}
          />
        )}
      </div>

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
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 5h2v14H6z"/>
            <path d="M18.5 5v14l-11-7 11-7z"/>
          </svg>
        </button>
        <button
          className={styles.recordBtn}
          style={recording ? { background: '#C9A227' } : undefined}
          onClick={() => {
            setRecording(r => !r)
            if (!recording) showToast('Recording — speak now, then compare')
          }}
        >
          <span style={{ color: recording ? '#22261F' : 'rgba(255,255,255,.6)' }}>●</span>
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
        <button className={styles.modeBtn} onClick={() => setPlaybackOrder(cycle(ORDER_CYCLE, playback.order))}>
          {ORDER_LABEL[playback.order]}
        </button>
        <button className={styles.transportBtn} onClick={nextSentence} aria-label="Next">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
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
        <button className={styles.overflowBtn} onClick={() => setOverflowOpen(true)} aria-label="More">⋯</button>
      </div>

      {overflowOpen && (
        <div className="sheet-overlay" onClick={() => setOverflowOpen(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <button className={styles.menuItem} onClick={() => { setOverflowOpen(false); stopPlayback(); onEditSentence(current.collectionId, current.id) }}>
              Edit sentence
            </button>
            <div className="hairline" />
            <button className={styles.menuItem} onClick={handleRegenerate}>Regenerate audio</button>
            <div className="hairline" />
            <button className={styles.menuItem} onClick={() => setAddToCollectionOpen(true)}>Add to another collection</button>
            <div className="hairline" />
            <button className={`${styles.menuItem} ${styles.menuDestructive}`} onClick={handleDelete}>Delete sentence</button>
            <div className="hairline" />
            <button className={styles.menuItem} onClick={() => setOverflowOpen(false)}>Cancel</button>
          </div>
        </div>
      )}

      {addToCollectionOpen && (
        <div className="sheet-overlay" onClick={() => setAddToCollectionOpen(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            {state.collections.filter(c => c.id !== current.collectionId).map(c => (
              <div key={c.id}>
                <button className={styles.menuItem} onClick={() => handleAddToCollection(c.id)}>{c.name}</button>
                <div className="hairline" />
              </div>
            ))}
            <button className={styles.menuItem} onClick={() => setAddToCollectionOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
