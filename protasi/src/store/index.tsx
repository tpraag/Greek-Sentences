import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react'
import type {
  Collection, Sentence, Settings, PlaybackState, PlaybackOrder, PlayerView, GreekSpeed,
  UserProgress, LearningStatus, QuizResult,
} from '../types'
import * as db from '../lib/db'
import { subscribeCollections, subscribeSettings, subscribeSentences, subscribeAllSentences, subscribeProgress, incrementLifetimeMasteryPoints } from '../lib/db'
import { isFirebaseConfigured } from '../lib/firebase'
import { subscribeAuth } from '../lib/auth'
import { translateToGreek, generateSpeech } from '../lib/api'
import { uploadAudio } from '../lib/db'
import { cacheAudioBlob, getCachedObjectUrl, fetchAndCache } from '../lib/audioCache'
import { precacheWords } from '../lib/wordCache'
import { getLearningStatus, countWords, calcMasteryPoints } from '../lib/mastery'

const DEFAULT_SETTINGS: Settings = {
  enVoiceId: '',
  grVoiceId: '',
  savedVoices: [],
  order: 'en-gr',
  gapSeconds: 3,
  greekSpeed: 1.0,
  sentenceRepeat: 1,
  defaultPlayerView: 'compact',
  autoTranslate: true,
  autoNarrate: true,
}

const DEFAULT_PROGRESS: UserProgress = {
  lifetimeMasteryPoints: 0,
}

const DEFAULT_PLAYBACK: PlaybackState = {
  active: false,
  queue: [],
  qpos: 0,
  order: 'en-gr',
  phaseIdx: 0,
  inGap: false,
  paused: false,
  loopList: false,
  sentenceRepeat: 1,
  sentencePlayCount: 0,
  view: 'compact',
  collectionId: null,
  gapSeconds: 3,
  greekSpeed: 1.0,
}

interface AppState {
  collections: Collection[]
  sentences: Record<string, Sentence[]>  // keyed by collectionId
  settings: Settings
  progress: UserProgress
  playback: PlaybackState
  loading: boolean
  toast: string | null
}

type Action =
  | { type: 'SET_COLLECTIONS'; collections: Collection[] }
  | { type: 'ADD_COLLECTION'; collection: Collection }
  | { type: 'UPDATE_COLLECTION'; id: string; data: Partial<Collection> }
  | { type: 'DELETE_COLLECTION'; id: string }
  | { type: 'SET_SENTENCES'; collectionId: string; sentences: Sentence[] }
  | { type: 'SET_ALL_SENTENCES'; byCollection: Record<string, Sentence[]> }
  | { type: 'ADD_SENTENCE'; sentence: Sentence }
  | { type: 'UPDATE_SENTENCE'; id: string; collectionId: string; data: Partial<Sentence> }
  | { type: 'DELETE_SENTENCE'; id: string; collectionId: string }
  | { type: 'SET_SETTINGS'; settings: Settings }
  | { type: 'SET_PROGRESS'; progress: UserProgress }
  | { type: 'SET_PLAYBACK'; playback: Partial<PlaybackState> }
  | { type: 'STOP_PLAYBACK' }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_TOAST'; toast: string | null }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_COLLECTIONS':
      return { ...state, collections: action.collections }
    case 'ADD_COLLECTION': {
      if (state.collections.some(c => c.id === action.collection.id)) return state
      return { ...state, collections: [...state.collections, action.collection] }
    }
    case 'UPDATE_COLLECTION':
      return {
        ...state,
        collections: state.collections.map(c =>
          c.id === action.id ? { ...c, ...action.data } : c
        ),
      }
    case 'DELETE_COLLECTION': {
      const { [action.id]: _, ...rest } = state.sentences
      return {
        ...state,
        collections: state.collections.filter(c => c.id !== action.id),
        sentences: rest,
      }
    }
    case 'SET_SENTENCES': {
      // Preserve client-only `translating` flag so onSnapshot doesn't clear an in-progress translation
      const prev = state.sentences[action.collectionId] ?? []
      const merged = action.sentences.map(s => {
        const p = prev.find(e => e.id === s.id)
        return p?.translating ? { ...s, translating: true } : s
      })
      return { ...state, sentences: { ...state.sentences, [action.collectionId]: merged } }
    }
    case 'SET_ALL_SENTENCES': {
      // Replace the whole map but preserve client-only `translating` flags so an
      // in-progress translation isn't cleared by the snapshot.
      const next: Record<string, Sentence[]> = {}
      for (const [colId, list] of Object.entries(action.byCollection)) {
        const prev = state.sentences[colId] ?? []
        next[colId] = list.map(s => {
          const p = prev.find(e => e.id === s.id)
          return p?.translating ? { ...s, translating: true } : s
        })
      }
      return { ...state, sentences: next }
    }
    case 'ADD_SENTENCE': {
      const existing = state.sentences[action.sentence.collectionId] ?? []
      if (existing.some(s => s.id === action.sentence.id)) return state
      return {
        ...state,
        sentences: { ...state.sentences, [action.sentence.collectionId]: [...existing, action.sentence] },
      }
    }
    case 'UPDATE_SENTENCE': {
      const list = state.sentences[action.collectionId] ?? []
      return {
        ...state,
        sentences: {
          ...state.sentences,
          [action.collectionId]: list.map(s => s.id === action.id ? { ...s, ...action.data } : s),
        },
      }
    }
    case 'DELETE_SENTENCE': {
      const list = state.sentences[action.collectionId] ?? []
      return {
        ...state,
        sentences: {
          ...state.sentences,
          [action.collectionId]: list.filter(s => s.id !== action.id),
        },
      }
    }
    case 'SET_SETTINGS':
      return { ...state, settings: action.settings }
    case 'SET_PROGRESS':
      return { ...state, progress: action.progress }
    case 'SET_PLAYBACK':
      return { ...state, playback: { ...state.playback, ...action.playback } }
    case 'STOP_PLAYBACK':
      return { ...state, playback: DEFAULT_PLAYBACK }
    case 'SET_LOADING':
      return { ...state, loading: action.loading }
    case 'SET_TOAST':
      return { ...state, toast: action.toast }
    default:
      return state
  }
}

interface AppContextValue {
  state: AppState
  dispatch: React.Dispatch<Action>
  loadCollections: () => Promise<void>
  loadSentences: (collectionId: string) => () => void
  createCollection: (data: Omit<Collection, 'id'>) => Promise<Collection>
  updateCollection: (id: string, data: Partial<Collection>) => Promise<void>
  deleteCollection: (id: string) => Promise<void>
  createSentence: (data: Omit<Sentence, 'id'>, autoTranslate?: boolean, autoNarrate?: boolean) => Promise<Sentence>
  updateSentence: (id: string, collectionId: string, data: Partial<Sentence>) => Promise<void>
  deleteSentence: (id: string, collectionId: string) => Promise<void>
  translateSentence: (id: string, collectionId: string) => Promise<void>
  generateAudio: (id: string, collectionId: string, lang: 'en' | 'gr') => Promise<string>
  setLearningStatus: (id: string, collectionId: string, status: LearningStatus) => Promise<void>
  recordQuizResult: (id: string, collectionId: string, result: QuizResult) => Promise<void>
  saveSettings: (s: Settings) => Promise<void>
  showToast: (msg: string, ms?: number) => void
  startPlayback: (collectionId: string, queue: string[], opts: { order: PlaybackOrder; gapSeconds: number; view: PlayerView; greekSpeed: GreekSpeed; loopList?: boolean; sentenceRepeat?: number }) => void
  stopPlayback: () => void
  pauseResume: () => void
  nextSentence: () => void
  prevSentence: () => void
  setGreekSpeed: (speed: GreekSpeed) => void
  setPlaybackOrder: (order: PlaybackOrder) => void
  setGapSeconds: (gapSeconds: number) => void
}

const AppContext = createContext<AppContextValue>(null!)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    collections: [],
    sentences: {},
    settings: DEFAULT_SETTINGS,
    progress: DEFAULT_PROGRESS,
    playback: DEFAULT_PLAYBACK,
    loading: true,
    toast: null,
  })

  const audioRef = useRef<HTMLAudioElement>(new Audio())
  // Tracks the current Object URL so we can revoke it before creating the next one
  const objectUrlRef = useRef<string | null>(null)
  const gapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The action to run after the current gap finishes (plays the next audio nugget).
  // Kept in a ref so pause/resume can re-arm the same gap regardless of what comes next.
  const nextStepRef = useRef<(() => void) | null>(null)
  const playbackRef = useRef<PlaybackState>(DEFAULT_PLAYBACK)
  playbackRef.current = state.playback

  useEffect(() => {
    if (!isFirebaseConfigured) {
      dispatch({ type: 'SET_LOADING', loading: false })
      return
    }

    let dataUnsubs: Array<() => void> = []

    // Subscribe to data only while signed in; tear down on sign-out. This also
    // ensures the auth token is present so locked-down rules don't reject reads.
    const unsubAuth = subscribeAuth(user => {
      dataUnsubs.forEach(u => u())
      dataUnsubs = []

      if (!user) {
        dispatch({ type: 'SET_COLLECTIONS', collections: [] })
        dispatch({ type: 'SET_ALL_SENTENCES', byCollection: {} })
        dispatch({ type: 'SET_LOADING', loading: false })
        return
      }

      dataUnsubs.push(subscribeCollections(collections => {
        dispatch({ type: 'SET_COLLECTIONS', collections })
        dispatch({ type: 'SET_LOADING', loading: false })
      }))

      // Keep every collection's sentences (and thus Library counts) in sync globally,
      // so counts are correct without having to open each collection first.
      dataUnsubs.push(subscribeAllSentences(byCollection => {
        dispatch({ type: 'SET_ALL_SENTENCES', byCollection })
      }))

      dataUnsubs.push(subscribeSettings(settings => {
        // Merge over defaults so fields missing from an older settings doc
        // (e.g. autoTranslate / autoNarrate) don't read back as `undefined`.
        if (settings) dispatch({ type: 'SET_SETTINGS', settings: { ...DEFAULT_SETTINGS, ...settings } })
      }))

      dataUnsubs.push(subscribeProgress(progress => {
        dispatch({ type: 'SET_PROGRESS', progress: { ...DEFAULT_PROGRESS, ...progress } })
      }))
    })

    return () => { unsubAuth(); dataUnsubs.forEach(u => u()) }
  }, [])

  const showToast = useCallback((msg: string, ms = 3000) => {
    dispatch({ type: 'SET_TOAST', toast: msg })
    setTimeout(() => dispatch({ type: 'SET_TOAST', toast: null }), ms)
  }, [])

  const loadCollections = useCallback(async () => {
    // collections are now kept in sync via onSnapshot subscription — no-op
  }, [])

  const loadSentences = useCallback((collectionId: string) => {
    return subscribeSentences(collectionId, sentences => {
      dispatch({ type: 'SET_SENTENCES', collectionId, sentences })
    })
  }, [])

  const createCollection = useCallback(async (data: Omit<Collection, 'id'>) => {
    const col = await db.createCollection(data)
    // onSnapshot will add it to state; dispatch here only if not yet present
    dispatch({ type: 'ADD_COLLECTION', collection: col })
    return col
  }, [])

  const updateCollection = useCallback(async (id: string, data: Partial<Collection>) => {
    dispatch({ type: 'UPDATE_COLLECTION', id, data })
    db.updateCollection(id, data).catch(e => console.error('updateCollection:', e))
  }, [])

  const deleteCollection = useCallback(async (id: string) => {
    dispatch({ type: 'DELETE_COLLECTION', id })
    db.deleteCollection(id).catch(e => console.error('deleteCollection:', e))
  }, [])

  const createSentence = useCallback(async (
    data: Omit<Sentence, 'id'>,
    autoTranslate = false,
    autoNarrate = false,
  ) => {
    const sentence = await db.createSentence(data)
    // onSnapshot will deliver the sentence; dispatch here as immediate optimistic add
    dispatch({ type: 'ADD_SENTENCE', sentence })

    if (autoTranslate) {
      dispatch({ type: 'UPDATE_SENTENCE', id: sentence.id, collectionId: sentence.collectionId, data: { translating: true } })
      showToast('Saved · translating…')
      try {
        const gr = await translateToGreek(sentence.en)
        await db.updateSentence(sentence.id, { gr, translating: false })
        dispatch({ type: 'UPDATE_SENTENCE', id: sentence.id, collectionId: sentence.collectionId, data: { gr, translating: false } })

        // Background: pre-translate each word so taps are instant & work offline later
        precacheWords(gr)

        if (autoNarrate && state.settings.enVoiceId && state.settings.grVoiceId) {
          const [enBlob, grBlob] = await Promise.all([
            generateSpeech(sentence.en, state.settings.enVoiceId),
            generateSpeech(gr, state.settings.grVoiceId),
          ])
          const [enAudioUrl, grAudioUrl] = await Promise.all([
            uploadAudio(sentence.id, 'en', enBlob),
            uploadAudio(sentence.id, 'gr', grBlob),
          ])
          await db.updateSentence(sentence.id, { enAudioUrl, grAudioUrl })
          dispatch({ type: 'UPDATE_SENTENCE', id: sentence.id, collectionId: sentence.collectionId, data: { enAudioUrl, grAudioUrl } })
          showToast('Translation & audio ready')
        } else {
          showToast('Translation ready')
        }
      } catch (e) {
        dispatch({ type: 'UPDATE_SENTENCE', id: sentence.id, collectionId: sentence.collectionId, data: { translating: false } })
        showToast('Translation failed')
      }
    }
    return sentence
  }, [state.settings, showToast])

  const updateSentence = useCallback(async (id: string, collectionId: string, data: Partial<Sentence>) => {
    await db.updateSentence(id, data)
    dispatch({ type: 'UPDATE_SENTENCE', id, collectionId, data })
  }, [])

  const deleteSentence = useCallback(async (id: string, collectionId: string) => {
    await db.deleteSentence(id)
    dispatch({ type: 'DELETE_SENTENCE', id, collectionId })
    // Best-effort cleanup of the audio blobs in Storage (ignore if they don't exist)
    db.deleteAudio(id, 'en').catch(() => {})
    db.deleteAudio(id, 'gr').catch(() => {})
  }, [])

  const translateSentence = useCallback(async (id: string, collectionId: string) => {
    const sentences = state.sentences[collectionId] ?? []
    const sentence = sentences.find(s => s.id === id)
    if (!sentence) return
    dispatch({ type: 'UPDATE_SENTENCE', id, collectionId, data: { translating: true } })
    try {
      const gr = await translateToGreek(sentence.en)
      await db.updateSentence(id, { gr, translating: false })
      dispatch({ type: 'UPDATE_SENTENCE', id, collectionId, data: { gr, translating: false } })
      precacheWords(gr) // background pre-translate each word for offline taps
    } catch {
      dispatch({ type: 'UPDATE_SENTENCE', id, collectionId, data: { translating: false } })
      showToast('Translation failed')
    }
  }, [state.sentences, showToast])

  const generateAudio = useCallback(async (id: string, collectionId: string, lang: 'en' | 'gr'): Promise<string> => {
    const sentences = state.sentences[collectionId] ?? []
    const sentence = sentences.find(s => s.id === id)
    if (!sentence) throw new Error('Sentence not found')
    const text = lang === 'en' ? sentence.en : sentence.gr
    if (!text) throw new Error('No text to narrate')
    const voiceId = lang === 'en' ? state.settings.enVoiceId : state.settings.grVoiceId
    if (!voiceId) throw new Error('No voice configured')
    const blob = await generateSpeech(text, voiceId)
    const url = await uploadAudio(id, lang, blob)
    // Seed IndexedDB cache immediately — we already have the blob, no need to re-fetch later
    cacheAudioBlob(url, blob).catch(() => {})
    const field = lang === 'en' ? 'enAudioUrl' : 'grAudioUrl'
    await db.updateSentence(id, { [field]: url })
    dispatch({ type: 'UPDATE_SENTENCE', id, collectionId, data: { [field]: url } })
    return url
  }, [state.sentences, state.settings])

  const setLearningStatus = useCallback(async (id: string, collectionId: string, status: LearningStatus) => {
    const sentences = state.sentences[collectionId] ?? []
    const sentence = sentences.find(s => s.id === id)
    if (!sentence) return

    const data: Partial<Sentence> = { learningStatus: status }
    const wasMastered = getLearningStatus(sentence) === 'mastered'

    if (status === 'mastered' && !wasMastered) {
      const now = Date.now()
      data.lastMasteredDate = now
      if (!sentence.masteryPointsAwarded) {
        const points = calcMasteryPoints(countWords(sentence.gr ?? sentence.en ?? ''))
        data.masteryPointsAwarded = true
        data.masteryPointsValue = points
        data.firstMasteredDate = sentence.firstMasteredDate ?? now
        if (points > 0) {
          incrementLifetimeMasteryPoints(points).catch(e => console.error('incrementLifetimeMasteryPoints:', e))
          dispatch({ type: 'SET_PROGRESS', progress: { ...state.progress, lifetimeMasteryPoints: state.progress.lifetimeMasteryPoints + points } })
          showToast(`+${points} Mastery Point${points !== 1 ? 's' : ''}`)
        }
      }
    }

    await db.updateSentence(id, data)
    dispatch({ type: 'UPDATE_SENTENCE', id, collectionId, data })
  }, [state.sentences, state.progress, showToast])

  const recordQuizResult = useCallback(async (id: string, collectionId: string, result: QuizResult) => {
    const sentences = state.sentences[collectionId] ?? []
    const sentence = sentences.find(s => s.id === id)
    if (!sentence) return

    const data: Partial<Sentence> = {
      lastQuizDate: Date.now(),
      lastQuizResult: result,
      quizAttempts: (sentence.quizAttempts ?? 0) + 1,
      quizCorrect: (sentence.quizCorrect ?? 0) + (result === 'correct' ? 1 : 0),
      quizAlmost: (sentence.quizAlmost ?? 0) + (result === 'almost' ? 1 : 0),
      quizIncorrect: (sentence.quizIncorrect ?? 0) + (result === 'incorrect' ? 1 : 0),
    }

    await db.updateSentence(id, data)
    dispatch({ type: 'UPDATE_SENTENCE', id, collectionId, data })
  }, [state.sentences])

  const saveSettings = useCallback(async (settings: Settings) => {
    dispatch({ type: 'SET_SETTINGS', settings })
    db.saveSettings(settings).catch(e => console.error('saveSettings:', e))
  }, [])

  // Playback engine
  const getPhasesForOrder = (order: PlaybackOrder): Array<'en' | 'gr'> => {
    if (order === 'en') return ['en']
    if (order === 'gr') return ['gr']
    if (order === 'en-gr') return ['en', 'gr']
    return ['gr', 'en']
  }

  const getSentenceById = (id: string): Sentence | undefined => {
    for (const list of Object.values(state.sentences)) {
      const s = list.find(s => s.id === id)
      if (s) return s
    }
    return undefined
  }

  const playPhase = useCallback(async (sentenceId: string, lang: 'en' | 'gr', collectionId: string) => {
    const pb = playbackRef.current
    let sentence = getSentenceById(sentenceId)
    if (!sentence) return

    let storageUrl = lang === 'en' ? sentence.enAudioUrl : sentence.grAudioUrl
    if (!storageUrl) {
      try {
        storageUrl = await generateAudio(sentenceId, collectionId, lang)
      } catch {
        advancePhase()
        return
      }
    }

    // Revoke the previous Object URL to free memory
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }

    // Prefer a cached blob from IndexedDB (works offline, bypasses the SW and iOS Safari's
    // 206 Partial Content requirement). If it isn't cached yet, fall back to the direct
    // Storage URL so online playback always works, and warm the cache in the background.
    let playUrl = storageUrl
    const cachedUrl = await getCachedObjectUrl(storageUrl)
    if (cachedUrl) {
      playUrl = cachedUrl
      objectUrlRef.current = cachedUrl
    } else {
      fetchAndCache(storageUrl) // background; needs CORS on the bucket
    }

    // Update lock-screen / Now Playing metadata
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: sentence.en,
        artist: lang === 'gr' ? 'Ελληνικά' : 'English',
        album: 'Protasi',
      })
    }

    const audio = audioRef.current
    audio.src = playUrl
    audio.playbackRate = lang === 'gr' ? pb.greekSpeed : 1.0
    audio.onended = () => advancePhase()
    audio.play().catch(() => advancePhase())
  }, [generateAudio])

  // Run `fn` after the configured gap. The gap is the standard pause between every
  // audio nugget — between EN and GR of the same sentence, between repeats, and
  // between sentences. `fn` is stashed so pause/resume can re-arm the same step.
  const scheduleAfterGap = useCallback((fn: () => void, gapMs: number) => {
    if (gapMs <= 0) { fn(); return }
    nextStepRef.current = fn
    dispatch({ type: 'SET_PLAYBACK', playback: { inGap: true } })
    gapTimerRef.current = setTimeout(() => {
      nextStepRef.current = null
      fn()
    }, gapMs)
  }, [])

  const advancePhase = useCallback(() => {
    const pb = playbackRef.current
    if (!pb.active || pb.paused) return
    const phases = getPhasesForOrder(pb.order)
    const nextPhaseIdx = pb.phaseIdx + 1
    const gapMs = pb.gapSeconds * 1000

    if (nextPhaseIdx < phases.length) {
      // Gap, then next phase (e.g. EN → GR) of the same sentence
      scheduleAfterGap(() => {
        dispatch({ type: 'SET_PLAYBACK', playback: { phaseIdx: nextPhaseIdx, inGap: false } })
        const p = playbackRef.current
        playPhase(p.queue[p.qpos], phases[nextPhaseIdx], p.collectionId!)
      }, gapMs)
      return
    }

    // All phases done — check sentence repeat
    const shouldRepeat = pb.sentenceRepeat === 0 || pb.sentencePlayCount + 1 < pb.sentenceRepeat
    if (shouldRepeat) {
      scheduleAfterGap(() => {
        const p = playbackRef.current
        dispatch({ type: 'SET_PLAYBACK', playback: { phaseIdx: 0, sentencePlayCount: p.sentencePlayCount + 1, inGap: false } })
        playPhase(p.queue[p.qpos], phases[0], p.collectionId!)
      }, gapMs)
      return
    }

    // Move to next sentence
    const nextPos = pb.qpos + 1
    if (nextPos >= pb.queue.length) {
      if (pb.loopList) {
        scheduleAfterGap(() => {
          dispatch({ type: 'SET_PLAYBACK', playback: { qpos: 0, phaseIdx: 0, sentencePlayCount: 0, inGap: false } })
          const p = playbackRef.current
          playPhase(p.queue[0], phases[0], p.collectionId!)
        }, gapMs)
      } else {
        dispatch({ type: 'STOP_PLAYBACK' })
      }
      return
    }
    scheduleAfterGap(() => {
      dispatch({ type: 'SET_PLAYBACK', playback: { qpos: nextPos, phaseIdx: 0, sentencePlayCount: 0, inGap: false } })
      const p = playbackRef.current
      playPhase(p.queue[nextPos], phases[0], p.collectionId!)
    }, gapMs)
  }, [playPhase, scheduleAfterGap])

  const startPlayback = useCallback((
    collectionId: string,
    queue: string[],
    opts: { order: PlaybackOrder; gapSeconds: number; view: PlayerView; greekSpeed: GreekSpeed; loopList?: boolean; sentenceRepeat?: number }
  ) => {
    audioRef.current.pause()
    if (gapTimerRef.current) clearTimeout(gapTimerRef.current)
    const pb: PlaybackState = {
      active: true,
      queue,
      qpos: 0,
      order: opts.order,
      phaseIdx: 0,
      inGap: false,
      paused: false,
      loopList: opts.loopList ?? false,
      sentenceRepeat: opts.sentenceRepeat ?? 1,
      sentencePlayCount: 0,
      view: opts.view,
      collectionId,
      gapSeconds: opts.gapSeconds,
      greekSpeed: opts.greekSpeed,
    }
    dispatch({ type: 'SET_PLAYBACK', playback: pb })
    playbackRef.current = pb  // sync ref immediately so playPhase reads correct greekSpeed

    // Register lock-screen media session controls
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => {
        audioRef.current.play()
        dispatch({ type: 'SET_PLAYBACK', playback: { paused: false } })
      })
      navigator.mediaSession.setActionHandler('pause', () => {
        audioRef.current.pause()
        dispatch({ type: 'SET_PLAYBACK', playback: { paused: true } })
      })
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        const p = playbackRef.current
        audioRef.current.pause()
        if (gapTimerRef.current) clearTimeout(gapTimerRef.current)
        const prevPos = Math.max(p.qpos - 1, 0)
        const ph = getPhasesForOrder(p.order)
        dispatch({ type: 'SET_PLAYBACK', playback: { qpos: prevPos, phaseIdx: 0, inGap: false } })
        playPhase(p.queue[prevPos], ph[0], p.collectionId!)
      })
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        const p = playbackRef.current
        audioRef.current.pause()
        if (gapTimerRef.current) clearTimeout(gapTimerRef.current)
        const nextPos = Math.min(p.qpos + 1, p.queue.length - 1)
        const ph = getPhasesForOrder(p.order)
        dispatch({ type: 'SET_PLAYBACK', playback: { qpos: nextPos, phaseIdx: 0, inGap: false } })
        playPhase(p.queue[nextPos], ph[0], p.collectionId!)
      })
    }

    const phases = getPhasesForOrder(opts.order)
    playPhase(queue[0], phases[0], collectionId)
  }, [playPhase])

  const stopPlayback = useCallback(() => {
    audioRef.current.pause()
    if (gapTimerRef.current) clearTimeout(gapTimerRef.current)
    dispatch({ type: 'STOP_PLAYBACK' })
  }, [])

  const pauseResume = useCallback(() => {
    const pb = playbackRef.current
    if (pb.paused) {
      if (pb.inGap && nextStepRef.current) {
        // Resume by re-arming the pending gap step (next nugget/sentence)
        const fn = nextStepRef.current
        gapTimerRef.current = setTimeout(() => {
          nextStepRef.current = null
          fn()
        }, pb.gapSeconds * 1000)
      } else {
        audioRef.current.play()
      }
      dispatch({ type: 'SET_PLAYBACK', playback: { paused: false } })
    } else {
      audioRef.current.pause()
      if (gapTimerRef.current) clearTimeout(gapTimerRef.current)
      dispatch({ type: 'SET_PLAYBACK', playback: { paused: true } })
    }
  }, [])

  const nextSentence = useCallback(() => {
    const pb = playbackRef.current
    audioRef.current.pause()
    if (gapTimerRef.current) clearTimeout(gapTimerRef.current)
    const nextPos = Math.min(pb.qpos + 1, pb.queue.length - 1)
    const phases = getPhasesForOrder(pb.order)
    dispatch({ type: 'SET_PLAYBACK', playback: { qpos: nextPos, phaseIdx: 0, inGap: false } })
    playPhase(pb.queue[nextPos], phases[0], pb.collectionId!)
  }, [playPhase])

  const prevSentence = useCallback(() => {
    const pb = playbackRef.current
    audioRef.current.pause()
    if (gapTimerRef.current) clearTimeout(gapTimerRef.current)
    const prevPos = Math.max(pb.qpos - 1, 0)
    const phases = getPhasesForOrder(pb.order)
    dispatch({ type: 'SET_PLAYBACK', playback: { qpos: prevPos, phaseIdx: 0, inGap: false } })
    playPhase(pb.queue[prevPos], phases[0], pb.collectionId!)
  }, [playPhase])

  // Change Greek speed during playback — applies to the current audio immediately if Greek is playing
  const setGreekSpeed = useCallback((speed: GreekSpeed) => {
    const pb = playbackRef.current
    dispatch({ type: 'SET_PLAYBACK', playback: { greekSpeed: speed } })
    const phases = getPhasesForOrder(pb.order)
    if (!pb.inGap && phases[pb.phaseIdx] === 'gr') {
      audioRef.current.playbackRate = speed
    }
  }, [])

  // Change playback order (EN / GR / EN→GR / GR→EN) mid-playback; takes effect from the next nugget
  const setPlaybackOrder = useCallback((order: PlaybackOrder) => {
    dispatch({ type: 'SET_PLAYBACK', playback: { order } })
  }, [])

  // Change the pause between sentences mid-playback; takes effect from the next gap
  const setGapSeconds = useCallback((gapSeconds: number) => {
    dispatch({ type: 'SET_PLAYBACK', playback: { gapSeconds } })
  }, [])

  return (
    <AppContext.Provider value={{
      state, dispatch,
      loadCollections, loadSentences,
      createCollection, updateCollection, deleteCollection,
      createSentence, updateSentence, deleteSentence,
      translateSentence, generateAudio,
      setLearningStatus, recordQuizResult,
      saveSettings, showToast,
      startPlayback, stopPlayback, pauseResume, nextSentence, prevSentence,
      setGreekSpeed, setPlaybackOrder, setGapSeconds,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
