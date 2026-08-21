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
  type Unsubscribe,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage, firebaseAuthReady } from './firebase'
import type { Collection, Sentence, Settings } from '../types'

// Real-time listener — calls onData immediately from cache, then again when server responds
export function subscribeCollections(onData: (cols: Collection[]) => void): Unsubscribe {
  const q = query(collection(db, 'collections'), orderBy('createdAt', 'asc'))
  return onSnapshot(q, snap => {
    onData(snap.docs.map(d => ({ id: d.id, ...d.data() } as Collection)))
  }, () => {
    // index not ready — fallback without orderBy
    onSnapshot(collection(db, 'collections'), snap => {
      onData(snap.docs.map(d => ({ id: d.id, ...d.data() } as Collection)))
    })
  })
}

export function subscribeSentences(collectionId: string, onData: (sentences: Sentence[]) => void): Unsubscribe {
  const q = query(
    collection(db, 'sentences'),
    where('collectionId', '==', collectionId),
    orderBy('createdAt', 'desc')
  )
  return onSnapshot(q, snap => {
    onData(snap.docs.map(d => ({ id: d.id, ...d.data() } as Sentence)))
  }, () => {
    // composite index not ready — fallback without orderBy
    onSnapshot(
      query(collection(db, 'sentences'), where('collectionId', '==', collectionId)),
      snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() } as Sentence)))
    )
  })
}

// Listen to every sentence at once, grouped by collectionId — powers Library counts
// without having to open each collection first.
export function subscribeAllSentences(onData: (byCollection: Record<string, Sentence[]>) => void): Unsubscribe {
  const group = (docs: Array<{ id: string; data: () => any }>) => {
    const grouped: Record<string, Sentence[]> = {}
    docs.forEach(d => {
      const s = { id: d.id, ...d.data() } as Sentence
      ;(grouped[s.collectionId] ??= []).push(s)
    })
    onData(grouped)
  }
  const q = query(collection(db, 'sentences'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, snap => group(snap.docs), () => {
    // composite index not ready — fallback without orderBy
    onSnapshot(collection(db, 'sentences'), snap => group(snap.docs))
  })
}

export function subscribeSettings(onData: (s: Settings | null) => void): Unsubscribe {
  return onSnapshot(doc(db, 'app', 'settings'), snap => {
    onData(snap.exists() ? (snap.data() as Settings) : null)
  }, () => onData(null))
}

// Writes — fire and don't wait for server confirmation (offline cache handles it)
export async function createCollection(data: Omit<Collection, 'id'>): Promise<Collection> {
  const docRef = await addDoc(collection(db, 'collections'), { ...data, createdAt: Date.now() })
  return { id: docRef.id, ...data }
}

export async function updateCollection(id: string, data: Partial<Collection>): Promise<void> {
  await updateDoc(doc(db, 'collections', id), data)
}

export async function deleteCollection(id: string): Promise<void> {
  // get sentences via a one-shot read so we can delete them
  const { getDocs } = await import('firebase/firestore')
  const snap = await getDocs(query(collection(db, 'sentences'), where('collectionId', '==', id)))
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)))
  await deleteDoc(doc(db, 'collections', id))
}

export async function createSentence(data: Omit<Sentence, 'id'>): Promise<Sentence> {
  const docRef = await addDoc(collection(db, 'sentences'), { ...data, createdAt: Date.now() })
  return { id: docRef.id, ...data }
}

export async function updateSentence(id: string, data: Partial<Sentence>): Promise<void> {
  await updateDoc(doc(db, 'sentences', id), data)
}

export async function deleteSentence(id: string): Promise<void> {
  await deleteDoc(doc(db, 'sentences', id))
}

export async function uploadAudio(sentenceId: string, lang: 'en' | 'gr', blob: Blob): Promise<string> {
  await firebaseAuthReady // ensure anonymous auth is ready so Storage rules allow the write
  const storageRef = ref(storage, `audio/${sentenceId}/${lang}.mp3`)
  await uploadBytes(storageRef, blob)
  return getDownloadURL(storageRef)
}

export async function deleteAudio(sentenceId: string, lang: 'en' | 'gr'): Promise<void> {
  try {
    await deleteObject(ref(storage, `audio/${sentenceId}/${lang}.mp3`))
  } catch { /* file may not exist */ }
}

export async function saveSettings(data: Settings): Promise<void> {
  await setDoc(doc(db, 'app', 'settings'), data)
}
