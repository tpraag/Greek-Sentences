import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'pwa-install-dismissed'

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as unknown as Record<string, unknown>).MSStream
}

function isInStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIOSHint, setShowIOSHint] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Already installed — never show
    if (isInStandaloneMode()) return
    // Already dismissed this session
    if (sessionStorage.getItem(DISMISSED_KEY)) return

    if (isIOS()) {
      // On iOS, show a manual hint after a short delay
      const t = setTimeout(() => {
        setShowIOSHint(true)
        setVisible(true)
      }, 3000)
      return () => clearTimeout(t)
    }

    // Android/Chrome: wait for the native install prompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    sessionStorage.setItem(DISMISSED_KEY, '1')
    setVisible(false)
  }

  async function install() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setVisible(false)
    else dismiss()
    setDeferredPrompt(null)
  }

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 'calc(86px + env(safe-area-inset-bottom, 0px) + 8px)',
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'calc(100% - 32px)',
      maxWidth: 398,
      background: 'var(--dark-bar)',
      color: '#fff',
      borderRadius: 14,
      padding: '12px 14px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      zIndex: 250,
      boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
    }}>
      <img src="/apple-touch-icon-180x180.png" alt="" style={{ width: 40, height: 40, borderRadius: 9, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.3 }}>Add Protasi to Home Screen</div>
        {showIOSHint ? (
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 3, lineHeight: 1.4 }}>
            Tap <strong style={{ opacity: 1 }}>Share</strong> then <strong style={{ opacity: 1 }}>Add to Home Screen</strong> for offline access
          </div>
        ) : (
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 3 }}>Install for offline access</div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignSelf: 'center' }}>
        {!showIOSHint && (
          <button
            onClick={install}
            style={{
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Install
          </button>
        )}
        <button
          onClick={dismiss}
          style={{
            background: 'transparent',
            color: 'rgba(255,255,255,0.6)',
            border: 'none',
            borderRadius: 8,
            padding: '6px 8px',
            fontSize: 13,
            cursor: 'pointer',
          }}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
