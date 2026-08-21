import { useState, useEffect } from 'react'

export default function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const online = () => setOffline(false)
    const offline = () => setOffline(true)
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
    }
  }, [])

  if (!offline) return null

  return (
    <div style={{
      position: 'fixed',
      top: 'env(safe-area-inset-top, 0px)',
      left: '50%',
      transform: 'translateX(-50%)',
      marginTop: 8,
      background: 'var(--dark-bar)',
      color: 'rgba(255,255,255,0.85)',
      padding: '5px 14px',
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 500,
      zIndex: 400,
      pointerEvents: 'none',
      letterSpacing: '0.01em',
    }}>
      Offline — changes will sync when reconnected
    </div>
  )
}
