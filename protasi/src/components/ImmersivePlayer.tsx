import { useApp } from '../store'
import styles from './ImmersivePlayer.module.css'

export default function ImmersivePlayer() {
  const { state, pauseResume, nextSentence, prevSentence, stopPlayback } = useApp()
  const { playback } = state

  if (!playback.active || playback.view !== 'immersive') return null

  const col = state.collections.find(c => c.id === playback.collectionId)
  const sentences = playback.collectionId ? (state.sentences[playback.collectionId] ?? []) : []
  const current = sentences.find(s => s.id === playback.queue[playback.qpos])

  const phases = playback.order === 'en' ? ['en'] : playback.order === 'gr' ? ['gr'] : playback.order === 'en-gr' ? ['en','gr'] : ['gr','en']
  const langLabel = playback.inGap ? 'Pausing' : (phases[playback.phaseIdx] === 'en' ? 'English' : 'Ελληνικά')
  const showEn = !playback.inGap && phases[playback.phaseIdx] === 'en'

  return (
    <div className={styles.screen}>
      <button className={styles.dismiss} onClick={stopPlayback}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="18 15 12 9 6 15"/>
        </svg>
      </button>

      <div className={styles.colName}>{col?.name}</div>

      {/* Progress dots */}
      <div className={styles.dots}>
        {playback.queue.map((_, i) => (
          <div
            key={i}
            className={`${styles.dot} ${i <= playback.qpos ? styles.dotFilled : ''}`}
          />
        ))}
      </div>

      <div className={styles.langLabel}>{langLabel} · now playing</div>

      {current && (
        <div className={styles.textArea}>
          {showEn ? (
            <p className={`${styles.primary} serif`}>{current.en}</p>
          ) : current.gr ? (
            <p className={`${styles.primary} serif`}>{current.gr}</p>
          ) : (
            <p className={styles.primary}>{current.en}</p>
          )}
          {current.gr && !showEn && (
            <p className={styles.secondary}>{current.en}</p>
          )}
          {showEn && current.gr && (
            <p className={`${styles.secondary} serif`}>{current.gr}</p>
          )}
        </div>
      )}

      <div className={styles.transport}>
        <button className={styles.transportBtn} onClick={prevSentence}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
            <polygon points="19 20 9 12 19 4 19 20"/>
            <line x1="5" y1="19" x2="5" y2="5" stroke="white" strokeWidth="2"/>
          </svg>
        </button>
        <button className={styles.bigPlay} onClick={pauseResume}>
          {playback.paused ? (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          )}
        </button>
        <button className={styles.transportBtn} onClick={nextSentence}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
            <polygon points="5 4 15 12 5 20 5 4"/>
            <line x1="19" y1="5" x2="19" y2="19" stroke="white" strokeWidth="2"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
