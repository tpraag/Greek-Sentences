import { useState, useEffect, useCallback } from 'react'
import type { User } from 'firebase/auth'
import { AppProvider, useApp } from './store'
import { isFirebaseConfigured } from './lib/firebase'
import { subscribeAuth, getUserClaims, type UserClaims } from './lib/auth'
import Login from './components/Login'
import PendingApproval from './components/PendingApproval'
import Library from './screens/Library'
import CollectionView from './screens/CollectionView'
import SentenceDetail from './screens/SentenceDetail'
import QuickAdd from './screens/QuickAdd'
import Settings from './screens/Settings'
import Progress from './screens/Progress'
import TabBar from './components/TabBar'
import CompactPlayer from './components/CompactPlayer'
import ImmersivePlayer from './components/ImmersivePlayer'
import InstallPrompt from './components/InstallPrompt'
import OfflineBanner from './components/OfflineBanner'

type Tab = 'library' | 'settings'

interface Nav {
  tab: Tab
  collectionId: string | null
  sentenceId: string | null
  screen: 'progress' | null
}

function AppInner() {
  const { state } = useApp()
  const [nav, setNav] = useState<Nav>({ tab: 'library', collectionId: null, sentenceId: null, screen: null })
  const [quickAdd, setQuickAdd] = useState(false)

  // Auth gate: undefined = still checking, null = signed out, User = signed in
  const [authUser, setAuthUser] = useState<User | null | undefined>(undefined)
  const [claims, setClaims] = useState<UserClaims | null>(null)
  useEffect(() => {
    if (!isFirebaseConfigured) { setAuthUser(null); return }
    return subscribeAuth(u => setAuthUser(u))
  }, [])

  const refreshClaims = useCallback(async (forceRefresh = false) => {
    if (!authUser) return
    setClaims(await getUserClaims(authUser, forceRefresh))
  }, [authUser])

  useEffect(() => {
    if (authUser) refreshClaims()
    else setClaims(null)
  }, [authUser, refreshClaims])

  // While auth state is unknown, render nothing (avoids a login-screen flash on reload)
  if (isFirebaseConfigured && authUser === undefined) return null
  // Signed out → show the password screen
  if (isFirebaseConfigured && !authUser) return <Login />
  // Signed in but not yet approved by an admin — no app data is reachable until then anyway
  if (isFirebaseConfigured && authUser && claims && !claims.approved) {
    return <PendingApproval email={authUser.email} onCheckAgain={() => refreshClaims(true)} />
  }

  function goToCollection(id: string) {
    setNav({ tab: 'library', collectionId: id, sentenceId: null, screen: null })
  }
  function goToSentence(id: string) {
    setNav(n => ({ ...n, sentenceId: id }))
  }
  function goBackToLibrary() {
    setNav({ tab: 'library', collectionId: null, sentenceId: null, screen: null })
  }
  function goBackToCollection() {
    setNav(n => ({ ...n, sentenceId: null }))
  }
  function goToProgress() {
    setNav(n => ({ ...n, screen: 'progress' }))
  }

  const showTabBar = !quickAdd && !nav.screen && !(state.playback.active && state.playback.view === 'immersive')

  return (
    <>
      {nav.screen === 'progress' ? (
        <Progress onBack={goBackToLibrary} />
      ) : nav.sentenceId && nav.collectionId ? (
        <SentenceDetail
          sentenceId={nav.sentenceId}
          collectionId={nav.collectionId}
          onBack={goBackToCollection}
        />
      ) : nav.collectionId ? (
        <CollectionView
          collectionId={nav.collectionId}
          onBack={goBackToLibrary}
          onSentence={goToSentence}
        />
      ) : nav.tab === 'library' ? (
        <Library onOpen={goToCollection} onProgress={goToProgress} />
      ) : (
        <Settings isAdmin={claims?.admin ?? false} />
      )}

      {quickAdd && (
        <QuickAdd
          defaultCollectionId={nav.collectionId}
          onClose={() => setQuickAdd(false)}
          onSaved={(colId) => {
            setQuickAdd(false)
            goToCollection(colId)
          }}
        />
      )}

      <ImmersivePlayer />
      {!nav.screen && <CompactPlayer />}

      {showTabBar && (
        <TabBar
          active={nav.tab}
          onTab={t => setNav({ tab: t, collectionId: null, sentenceId: null, screen: null })}
          onAdd={() => setQuickAdd(true)}
        />
      )}

      {state.toast && <div className="toast">{state.toast}</div>}

      <InstallPrompt />
      <OfflineBanner />

      {!isFirebaseConfigured && (
        <div style={{
          position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 430, background: '#C9A24B', color: '#fff',
          padding: '10px 16px', fontSize: 13, fontWeight: 500, textAlign: 'center',
          zIndex: 300,
        }}>
          Firebase not configured — add .env to enable data sync
        </div>
      )}
    </>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  )
}
