import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  increment,
  type Unsubscribe,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage, firebaseAuthReady } from './firebase'
import type { Collection, Sentence, Settings, UserProgress } from '../types'

// Every document lives under users/{uid}/... — each function takes the current user's
// uid explicitly rather than reading some ambient "current user" here, so this module
// stays a plain data layer with no auth-state awareness of its own.
const collectionsPath = (uid: string) => collection(db, 'users', uid, 'collections')
const sentencesPath = (uid: string) => collection(db, 'users', uid, 'sentences')
const settingsDoc = (uid: string) => doc(db, 'users', uid, 'app', 'settings')
const progressDoc = (uid: string) => doc(db, 'users', uid, 'app', 'progress')

// Real-time listener — calls onData immediately from cache, then again when server responds
export function subscribeCollections(uid: string, onData: (cols: Collection[]) => void): Unsubscribe {
  const q = query(collectionsPath(uid), orderBy('createdAt', 'asc'))
  return onSnapshot(q, snap => {
    onData(snap.docs.map(d => ({ id: d.id, ...d.data() } as Collection)))
  }, () => {
    // index not ready — fallback without orderBy
    onSnapshot(collectionsPath(uid), snap => {
      onData(snap.docs.map(d => ({ id: d.id, ...d.data() } as Collection)))
    })
  })
}

export function subscribeSentences(uid: string, collectionId: string, onData: (sentences: Sentence[]) => void): Unsubscribe {
  const q = query(
    sentencesPath(uid),
    where('collectionId', '==', collectionId),
    orderBy('createdAt', 'desc')
  )
  return onSnapshot(q, snap => {
    onData(snap.docs.map(d => ({ id: d.id, ...d.data() } as Sentence)))
  }, () => {
    // composite index not ready — fallback without orderBy
    onSnapshot(
      query(sentencesPath(uid), where('collectionId', '==', collectionId)),
      snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() } as Sentence)))
    )
  })
}

// Listen to every sentence at once, grouped by collectionId — powers Library counts
// without having to open each collection first.
export function subscribeAllSentences(uid: string, onData: (byCollection: Record<string, Sentence[]>) => void): Unsubscribe {
  const group = (docs: Array<{ id: string; data: () => any }>) => {
    const grouped: Record<string, Sentence[]> = {}
    docs.forEach(d => {
      const s = { id: d.id, ...d.data() } as Sentence
      ;(grouped[s.collectionId] ??= []).push(s)
    })
    onData(grouped)
  }
  const q = query(sentencesPath(uid), orderBy('createdAt', 'desc'))
  return onSnapshot(q, snap => group(snap.docs), () => {
    // composite index not ready — fallback without orderBy
    onSnapshot(sentencesPath(uid), snap => group(snap.docs))
  })
}

export function subscribeSettings(uid: string, onData: (s: Settings | null) => void): Unsubscribe {
  return onSnapshot(settingsDoc(uid), snap => {
    onData(snap.exists() ? (snap.data() as Settings) : null)
  }, () => onData(null))
}

// Writes — fire and don't wait for server confirmation (offline cache handles it)
export async function createCollection(uid: string, data: Omit<Collection, 'id'>): Promise<Collection> {
  const docRef = await addDoc(collectionsPath(uid), { ...data, createdAt: Date.now() })
  return { id: docRef.id, ...data }
}

export async function updateCollection(uid: string, id: string, data: Partial<Collection>): Promise<void> {
  await updateDoc(doc(db, 'users', uid, 'collections', id), data)
}

export async function deleteCollection(uid: string, id: string): Promise<void> {
  // get sentences via a one-shot read so we can delete them
  const { getDocs } = await import('firebase/firestore')
  const snap = await getDocs(query(sentencesPath(uid), where('collectionId', '==', id)))
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)))
  await deleteDoc(doc(db, 'users', uid, 'collections', id))
}

export async function createSentence(uid: string, data: Omit<Sentence, 'id'>): Promise<Sentence> {
  const docRef = await addDoc(sentencesPath(uid), { ...data, createdAt: Date.now() })
  return { id: docRef.id, ...data }
}

export async function updateSentence(uid: string, id: string, data: Partial<Sentence>): Promise<void> {
  await updateDoc(doc(db, 'users', uid, 'sentences', id), data)
}

export async function deleteSentence(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'sentences', id))
}

export async function uploadAudio(uid: string, sentenceId: string, lang: 'en' | 'gr', blob: Blob): Promise<string> {
  await firebaseAuthReady // ensure the auth token is attached before Storage rules are checked
  const storageRef = ref(storage, `users/${uid}/audio/${sentenceId}/${lang}.mp3`)
  await uploadBytes(storageRef, blob)
  return getDownloadURL(storageRef)
}

export async function deleteAudio(uid: string, sentenceId: string, lang: 'en' | 'gr'): Promise<void> {
  try {
    await deleteObject(ref(storage, `users/${uid}/audio/${sentenceId}/${lang}.mp3`))
  } catch { /* file may not exist */ }
}

export async function saveSettings(uid: string, data: Settings): Promise<void> {
  await setDoc(settingsDoc(uid), data)
}

export function subscribeProgress(uid: string, onData: (p: UserProgress | null) => void): Unsubscribe {
  return onSnapshot(progressDoc(uid), snap => {
    onData(snap.exists() ? (snap.data() as UserProgress) : null)
  }, () => onData(null))
}

// Atomic increment so double-tapping Mastered can't double-award points.
export async function incrementLifetimeMasteryPoints(uid: string, points: number): Promise<void> {
  await setDoc(progressDoc(uid), { lifetimeMasteryPoints: increment(points) }, { merge: true })
}
