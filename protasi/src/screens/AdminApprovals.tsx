import { useEffect, useState } from 'react'
import { listPendingSignups, approveSignup, type PendingSignup } from '../lib/api'
import styles from './AdminApprovals.module.css'

interface Props {
  onBack: () => void
}

export default function AdminApprovals({ onBack }: Props) {
  const [pending, setPending] = useState<PendingSignup[] | null>(null)
  const [busyUid, setBusyUid] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function load() {
    try {
      setPending(await listPendingSignups())
    } catch {
      setError('Could not load pending sign-ups')
    }
  }

  useEffect(() => { load() }, [])

  async function handle(uid: string, action: 'approve' | 'reject') {
    if (action === 'reject' && !confirm('Reject and permanently delete this sign-up?')) return
    setBusyUid(uid)
    try {
      await approveSignup(uid, action)
      setPending(p => p?.filter(s => s.uid !== uid) ?? null)
    } catch {
      setError('That action failed — try again')
    } finally {
      setBusyUid(null)
    }
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.back} onClick={onBack}>
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="7 1 1 7 7 13" />
          </svg>
          Settings
        </button>
        <h1 className={styles.title}>Pending sign-ups</h1>
      </div>

      <div className="screen-scroll" style={{ paddingTop: 0 }}>
        <div className={styles.body}>
          {error && <p className={styles.error}>{error}</p>}
          {pending === null && !error ? (
            <p className={styles.empty}>Loading…</p>
          ) : pending && pending.length === 0 ? (
            <p className={styles.empty}>No pending sign-ups.</p>
          ) : (
            <div className={styles.list}>
              {pending?.map(s => (
                <div key={s.uid} className={`card ${styles.row}`}>
                  <div className={styles.info}>
                    <span className={styles.email}>{s.email ?? '(no email)'}</span>
                    <span className={styles.date}>{new Date(s.createdAt).toLocaleString()}</span>
                  </div>
                  <div className={styles.actions}>
                    <button
                      className={styles.reject}
                      disabled={busyUid === s.uid}
                      onClick={() => handle(s.uid, 'reject')}
                    >
                      Reject
                    </button>
                    <button
                      className={styles.approve}
                      disabled={busyUid === s.uid}
                      onClick={() => handle(s.uid, 'approve')}
                    >
                      Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
