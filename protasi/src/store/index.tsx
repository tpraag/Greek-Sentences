import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react'
import type {
  Collection, Sentence, Settings, PlaybackState, PlaybackOrder, PlayerView, GreekSpeed,
} from '../types'
import * as db from '../lib/db'
import { subscribeCollections, subscribeSettings, subscribeSentences } from '../lib/db'
import { isFirebaseConfigured } from '../lib/firebase'
import { translateToGreek, generateSpeech } from '../lib/api'
import { uploadAudio } from '../lib/db'

const DEFAULT_SETTINGS: Settings = {
  enVoiceId: '',
  grVoiceId: '',
  savedVoices: [],
  order: 'en-gr',
  gapSeconds: 3,
  greekSpeed: 1.0,
  defaultPlayerView: 'compact',
  autoTranslate: true,
  autoNarrate: true,
}

const DEFAULT_PLAYBACK: PlaybackState = {
  active: false,
  queue: [],
  qpos: 0,
  order: 'en-gr',
  phaseIdx: 0,
  inGap: false,
  paused: false,
  loop: false,
  view: 'compact',
  collectionId: null,
  gapSeconds: 3,
  greekSpeed: 1.0,
}

interface AppState {
  collections: Collection[]
  sentences: Record<string, Sentence[]>  // keyed by collectionId
  settings: Settings
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
  | { type: 'ADD_SENTENCE'; sentence: Sentence }
  | { type: 'UPDATE_SENTENCE'; id: string; collectionId: string; data: Partial<Sentence> }
  | { type: 'DELETE_SENTENCE'; id: string; collectionId: string }
  | { type: 'SET_SETTINGS'; settings: Settings }
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
    case 'SET_SENTENCES':
      return { ...state, sentences: { ...state.sentences, [action.collectionId]: action.sentences } }
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
  saveSettings: (s: Settings) => Promise<void>
  showToast: (msg: string, ms?: number) => void
  startPlayback: (collectionId: string, queue: string[], opts: { order: PlaybackOrder; gapSeconds: number; view: PlayerView; greekSpeed: GreekSpeed }) => void
  stopPlayback: () => void
  pauseResume: () => void
  nextSentence: () => void
  prevSentence: () => void
}

const AppContext = createContext<AppContextValue>(null!)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    collections: [],
    sentences: {},
    settings: DEFAULT_SETTINGS,
    playback: DEFAULT_PLAYBACK,
    loading: true,
    toast: null,
  })

  const audioRef = useRef<HTMLAudioElement>(new Audio())
  const gapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playbackRef = useRef<PlaybackState>(DEFAULT_PLAYBACK)
  playbackRef.current = state.playback

  useEffect(() => {
    if (!isFirebaseConfigured) {
      dispatch({ type: 'SET_LOADING', loading: false })
      return
    }

    const unsubCols = subscribeCollections(collections => {
      dispatch({ type: 'SET_COLLECTIONS', collections })
      dispatch({ type: 'SET_LOADING', loading: false })
    })

    const unsubSettings = subscribeSettings(settings => {
      if (settings) dispatch({ type: 'SET_SETTINGS', settings })
    })

    return () => { unsubCols(); unsubSettings() }
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
    const field = lang === 'en' ? 'enAudioUrl' : 'grAudioUrl'
    await db.updateSentence(id, { [field]: url })
    dispatch({ type: 'UPDATE_SENTENCE', id, collectionId, data: { [field]: url } })
    return url
  }, [state.sentences, state.settings])

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

    let url = lang === 'en' ? sentence.enAudioUrl : sentence.grAudioUrl
    if (!url) {
      try {
        url = await generateAudio(sentenceId, collectionId, lang)
      } catch {
        // skip this phase
        advancePhase()
        return
      }
    }

    const audio = audioRef.current
    audio.src = url
    audio.playbackRate = lang === 'gr' ? pb.greekSpeed : 1.0
    audio.onended = () => advancePhase()
    audio.play().catch(() => advancePhase())
  }, [generateAudio])

  const advancePhase = useCallback(() => {
    const pb = playbackRef.current
    if (!pb.active || pb.paused) return
    const phases = getPhasesForOrder(pb.order)
    const nextPhaseIdx = pb.phaseIdx + 1

    if (nextPhaseIdx < phases.length) {
      // Next phase of same sentence
      dispatch({ type: 'SET_PLAYBACK', playback: { phaseIdx: nextPhaseIdx } })
      const sentenceId = pb.queue[pb.qpos]
      playPhase(sentenceId, phases[nextPhaseIdx], pb.collectionId!)
    } else if (pb.loop) {
      // Loop this sentence
      dispatch({ type: 'SET_PLAYBACK', playback: { phaseIdx: 0 } })
      const sentenceId = pb.queue[pb.qpos]
      playPhase(sentenceId, phases[0], pb.collectionId!)
    } else {
      // Move to next sentence after gap
      const nextPos = pb.qpos + 1
      if (nextPos >= pb.queue.length) {
        dispatch({ type: 'STOP_PLAYBACK' })
        return
      }
      dispatch({ type: 'SET_PLAYBACK', playback: { inGap: true } })
      gapTimerRef.current = setTimeout(() => {
        dispatch({ type: 'SET_PLAYBACK', playback: { qpos: nextPos, phaseIdx: 0, inGap: false } })
        const sentenceId = playbackRef.current.queue[nextPos]
        playPhase(sentenceId, phases[0], playbackRef.current.collectionId!)
      }, pb.gapSeconds * 1000)
    }
  }, [playPhase])

  const startPlayback = useCallback((
    collectionId: string,
    queue: string[],
    opts: { order: PlaybackOrder; gapSeconds: number; view: PlayerView; greekSpeed: GreekSpeed }
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
      loop: false,
      view: opts.view,
      collectionId,
      gapSeconds: opts.gapSeconds,
      greekSpeed: opts.greekSpeed,
    }
    dispatch({ type: 'SET_PLAYBACK', playback: pb })
    playbackRef.current = pb  // sync ref immediately so playPhase reads correct greekSpeed
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
      if (pb.inGap) {
        // resume gap timer
        gapTimerRef.current = setTimeout(() => {
          const phases = getPhasesForOrder(playbackRef.current.order)
          const nextPos = playbackRef.current.qpos + 1
          dispatch({ type: 'SET_PLAYBACK', playback: { qpos: nextPos, phaseIdx: 0, inGap: false, paused: false } })
          playPhase(playbackRef.current.queue[nextPos], phases[0], playbackRef.current.collectionId!)
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
  }, [playPhase])

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

  return (
    <AppContext.Provider value={{
      state, dispatch,
      loadCollections, loadSentences,
      createCollection, updateCollection, deleteCollection,
      createSentence, updateSentence, deleteSentence,
      translateSentence, generateAudio,
      saveSettings, showToast,
      startPlayback, stopPlayback, pauseResume, nextSentence, prevSentence,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
