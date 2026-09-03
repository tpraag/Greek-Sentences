import { useState } from 'react'
import { signOutUser } from '../lib/auth'
import styles from './Login.module.css'

interface Props {
  email: string | null
  onCheckAgain: () => Promise<void>
}

export default function PendingApproval({ email, onCheckAgain }: Props) {
  const [checking, setChecking] = useState(false)

  async function handleCheck() {
    setChecking(true)
    await onCheckAgain()
    setChecking(false)
  }

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <img src="/apple-touch-icon-180x180.png" alt="" className={styles.logo} />
        <h1 className={styles.title}>Almost there</h1>
        <p className={styles.sub}>
          {email ? `${email} is` : 'Your account is'} waiting to be approved. You'll be able to get in as soon as that happens — no need to sign up again.
        </p>

        <button className="btn-accent" onClick={handleCheck} disabled={checking}>
          {checking ? 'Checking…' : 'Check again'}
        </button>

        <button className={styles.toggle} onClick={signOutUser}>
          Sign out
        </button>
      </div>
    </div>
  )
}
