import { useState } from 'react'
import { signIn, signUp } from '../lib/auth'
import styles from './Login.module.css'

type Mode = 'signin' | 'signup'

export default function Login() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const canSubmit = email.trim() && password && (mode === 'signin' || inviteCode.trim())

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || busy) return
    setBusy(true)
    setError('')
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password)
      } else {
        await signUp(email.trim(), password, inviteCode.trim())
      }
      // On success, the auth listener in App swaps to the app automatically.
    } catch (err) {
      setError(mode === 'signin' ? 'Incorrect email or password' : (err as Error).message || 'Sign up failed')
      setBusy(false)
    }
  }

  function toggleMode() {
    setMode(m => m === 'signin' ? 'signup' : 'signin')
    setError('')
  }

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <img src="/apple-touch-icon-180x180.png" alt="" className={styles.logo} />
        <h1 className={styles.title}>Protasi</h1>
        <p className={styles.sub}>
          {mode === 'signin' ? 'Sign in to continue' : 'Create your account'}
        </p>

        <form onSubmit={submit} className={styles.form}>
          <input
            className={styles.input}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoFocus
          />
          <input
            className={styles.input}
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          {mode === 'signup' && (
            <input
              className={styles.input}
              type="text"
              autoComplete="off"
              placeholder="Invite code"
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value)}
            />
          )}
          {error && <div className={styles.error}>{error}</div>}
          <button className="btn-accent" type="submit" disabled={busy || !canSubmit}>
            {busy ? (mode === 'signin' ? 'Signing in…' : 'Creating account…') : (mode === 'signin' ? 'Sign in' : 'Sign up')}
          </button>
        </form>

        <button className={styles.toggle} onClick={toggleMode}>
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}
