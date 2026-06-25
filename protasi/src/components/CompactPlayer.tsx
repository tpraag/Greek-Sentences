import { useApp } from '../store'
import styles from './CompactPlayer.module.css'

export default function CompactPlayer() {
  const { state, pauseResume, nextSentence, prevSentence, stopPlayback } = useApp()
  const { playback } = state

  if (!playback.active || playback.view !== 'compact') return null

  const sentences = playback.collectionId ? (state.sentences[playback.collectionId] ?? []) : []
  const current = sentences.find(s => s.id === playback.queue[playback.qpos])
  const phases = playback.order === 'en' ? ['en'] : playback.order === 'gr' ? ['gr'] : playback.order === 'en-gr' ? ['en','gr'] : ['gr','en']
  const currentLang = playback.inGap ? '—' : (phases[playback.phaseIdx] === 'en' ? 'English' : 'Ελληνικά')
  const progress = playback.queue.length > 0 ? (playback.qpos / playback.queue.length) : 0

  return (
    <div className={styles.bar}>
      <div className={styles.progress} style={{ width: `${progress * 100}%` }} />
      <div className={styles.meta}>
        <span className={styles.nowLabel}>Now · {playback.qpos + 1} of {playback.queue.length} · {currentLang}</span>
      </div>
      {current && <div className={styles.title}>{current.en}</div>}
      <div className={styles.controls}>
        <button className={styles.ctrl} onClick={prevSentence}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5" stroke="white" strokeWidth="2"/>
          </svg>
        </button>
        <button className={styles.playPause} onClick={pauseResume}>
          {playback.paused ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          )}
        </button>
        <button className={styles.ctrl} onClick={nextSentence}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19" stroke="white" strokeWidth="2"/>
          </svg>
        </button>
        <button className={styles.close} onClick={stopPlayback}>✕</button>
      </div>
    </div>
  )
}
