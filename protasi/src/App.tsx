import { useState } from 'react'
import { AppProvider, useApp } from './store'
import { isFirebaseConfigured } from './lib/firebase'
import Library from './screens/Library'
import CollectionView from './screens/CollectionView'
import SentenceDetail from './screens/SentenceDetail'
import QuickAdd from './screens/QuickAdd'
import Settings from './screens/Settings'
import TabBar from './components/TabBar'
import CompactPlayer from './components/CompactPlayer'
import ImmersivePlayer from './components/ImmersivePlayer'

type Tab = 'library' | 'settings'

interface Nav {
  tab: Tab
  collectionId: string | null
  sentenceId: string | null
}

function AppInner() {
  const { state } = useApp()
  const [nav, setNav] = useState<Nav>({ tab: 'library', collectionId: null, sentenceId: null })
  const [quickAdd, setQuickAdd] = useState(false)

  function goToCollection(id: string) {
    setNav({ tab: 'library', collectionId: id, sentenceId: null })
  }
  function goToSentence(id: string) {
    setNav(n => ({ ...n, sentenceId: id }))
  }
  function goBackToLibrary() {
    setNav({ tab: 'library', collectionId: null, sentenceId: null })
  }
  function goBackToCollection() {
    setNav(n => ({ ...n, sentenceId: null }))
  }

  const showTabBar = !quickAdd && !(state.playback.active && state.playback.view === 'immersive')

  return (
    <>
      {nav.sentenceId && nav.collectionId ? (
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
        <Library onOpen={goToCollection} />
      ) : (
        <Settings />
      )}

      {quickAdd && (
        <QuickAdd
          onClose={() => setQuickAdd(false)}
          onSaved={(colId) => {
            setQuickAdd(false)
            goToCollection(colId)
          }}
        />
      )}

      <ImmersivePlayer />
      <CompactPlayer />

      {showTabBar && (
        <TabBar
          active={nav.tab}
          onTab={t => setNav({ tab: t, collectionId: null, sentenceId: null })}
          onAdd={() => setQuickAdd(true)}
        />
      )}

      {state.toast && <div className="toast">{state.toast}</div>}

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
