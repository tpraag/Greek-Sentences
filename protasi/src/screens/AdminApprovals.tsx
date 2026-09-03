import { useEffect, useState } from 'react'
import { listAccounts, updateAccount, type AccountSummary } from '../lib/api'
import styles from './AdminApprovals.module.css'

interface Props {
  onBack: () => void
}

export default function AdminApprovals({ onBack }: Props) {
  const [pending, setPending] = useState<AccountSummary[] | null>(null)
  const [active, setActive] = useState<AccountSummary[] | null>(null)
  const [busyUid, setBusyUid] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function load() {
    try {
      const { pending, active } = await listAccounts()
      setPending(pending)
      setActive(active)
    } catch {
      setError('Could not load accounts')
    }
  }

  useEffect(() => { load() }, [])

  async function handle(uid: string, action: 'approve' | 'reject' | 'delete') {
    setBusyUid(uid)
    setError('')
    try {
      await updateAccount(uid, action)
      setPending(p => p?.filter(s => s.uid !== uid) ?? null)
      setActive(a => a?.filter(s => s.uid !== uid) ?? null)
    } catch {
      setError('That action failed — try again')
    } finally {
      setBusyUid(null)
    }
  }

  function handleReject(uid: string) {
    if (!confirm('Reject and permanently delete this sign-up?')) return
    handle(uid, 'reject')
  }

  // Deleting an active account destroys real content — require typing the email back,
  // not just an OK/Cancel click, since this one can't be undone.
  function handleDelete(s: AccountSummary) {
    const typed = prompt(
      `This permanently deletes ${s.email}'s account and everything in it — sentences, collections, progress, audio. This cannot be undone.\n\nType their email to confirm:`
    )
    if (typed !== s.email) {
      if (typed !== null) alert("That didn't match — nothing was deleted.")
      return
    }
    handle(s.uid, 'delete')
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
        <h1 className={styles.title}>Accounts</h1>
      </div>

      <div className="screen-scroll" style={{ paddingTop: 0 }}>
        <div className={styles.body}>
          {error && <p className={styles.error}>{error}</p>}

          <div className="label" style={{ marginBottom: 8 }}>Pending approval</div>
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
                    <button className={styles.reject} disabled={busyUid === s.uid} onClick={() => handleReject(s.uid)}>
                      Reject
                    </button>
                    <button className={styles.approve} disabled={busyUid === s.uid} onClick={() => handle(s.uid, 'approve')}>
                      Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="label" style={{ margin: '24px 0 8px' }}>Active accounts</div>
          {active === null && !error ? (
            <p className={styles.empty}>Loading…</p>
          ) : active && active.length === 0 ? (
            <p className={styles.empty}>No active accounts yet.</p>
          ) : (
            <div className={styles.list}>
              {active?.map(s => (
                <div key={s.uid} className={`card ${styles.row}`}>
                  <div className={styles.info}>
                    <span className={styles.email}>{s.email ?? '(no email)'}</span>
                    <span className={styles.date}>Joined {new Date(s.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className={styles.actions}>
                    <button className={styles.reject} disabled={busyUid === s.uid} onClick={() => handleDelete(s)}>
                      Delete
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
