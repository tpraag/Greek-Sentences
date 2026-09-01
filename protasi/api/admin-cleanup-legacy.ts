import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { getAdminApp } from './_lib/firebaseAdmin.js'

// One-off internal tool, not linked from any UI — deletes the app's original flat,
// unscoped data (collections/, sentences/, app/settings, app/progress, and the
// audio/ Storage prefix) now that everything lives under users/{uid}/... and no
// migration of the old data is happening. Runs via the Admin SDK, which bypasses
// security rules entirely, so it works regardless of what the rules currently allow.
// Gated by ADMIN_SECRET, same as admin-grant.ts.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { secret } = req.body as { secret?: string }
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const app = getAdminApp()
  const db = getFirestore(app)
  const deleted = { collections: 0, sentences: 0, settings: false, progress: false, audioFiles: 0 }

  const colSnap = await db.collection('collections').get()
  for (const d of colSnap.docs) { await d.ref.delete(); deleted.collections++ }

  const sentSnap = await db.collection('sentences').get()
  for (const d of sentSnap.docs) { await d.ref.delete(); deleted.sentences++ }

  const settingsRef = db.doc('app/settings')
  if ((await settingsRef.get()).exists) { await settingsRef.delete(); deleted.settings = true }
  const progressRef = db.doc('app/progress')
  if ((await progressRef.get()).exists) { await progressRef.delete(); deleted.progress = true }

  try {
    // getStorage(app).bucket() with no argument guesses the default <project-id>.appspot.com
    // bucket name, which doesn't match this project's actual bucket.
    const bucket = getStorage(app).bucket('protasi-eu.firebasestorage.app')
    const [files] = await bucket.getFiles({ prefix: 'audio/' })
    await Promise.all(files.map(f => f.delete().catch(() => {})))
    deleted.audioFiles = files.length
  } catch (e) {
    console.error('audio cleanup failed:', e)
  }

  res.json({ ok: true, deleted })
}
