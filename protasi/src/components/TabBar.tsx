import styles from './TabBar.module.css'

type Tab = 'library' | 'settings'

interface Props {
  active: Tab
  onTab: (t: Tab) => void
  onAdd: () => void
}

export default function TabBar({ active, onTab, onAdd }: Props) {
  return (
    <div className={styles.bar}>
      <button
        className={`${styles.tab} ${active === 'library' ? styles.active : ''}`}
        onClick={() => onTab('library')}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
        <span>Library</span>
      </button>

      <button className={styles.addBtn} onClick={onAdd} aria-label="Quick add">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      <button
        className={`${styles.tab} ${active === 'settings' ? styles.active : ''}`}
        onClick={() => onTab('settings')}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
        </svg>
        <span>Settings</span>
      </button>
    </div>
  )
}
