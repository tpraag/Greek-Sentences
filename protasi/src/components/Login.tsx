import { useState } from 'react'
import { signInWithPassword } from '../lib/auth'
import styles from './Login.module.css'

export default function Login() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!password || busy) return
    setBusy(true)
    setError('')
    try {
      await signInWithPassword(password)
      // On success, the auth listener in App swaps to the app automatically.
    } catch {
      setError('Incorrect password')
      setBusy(false)
    }
  }

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <img src="/apple-touch-icon-180x180.png" alt="" className={styles.logo} />
        <h1 className={styles.title}>Protasi</h1>
        <p className={styles.sub}>Enter your password to continue</p>

        <form onSubmit={submit} className={styles.form}>
          <input
            className={styles.input}
            type="password"
            inputMode="text"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
          />
          {error && <div className={styles.error}>{error}</div>}
          <button className="btn-accent" type="submit" disabled={busy || !password}>
            {busy ? 'Signing in…' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  )
}
