import { useState } from 'react'
import { COLOR_PALETTE, ICON_GROUPS, type IconName, type CollectionColor } from '../types'
import CollectionIcon from './CollectionIcon'
import styles from './NewCollectionPanel.module.css'

interface Props {
  onSave: (name: string, icon: IconName, color: CollectionColor) => void
  onCancel?: () => void
}

export default function NewCollectionPanel({ onSave }: Props) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState<IconName>('book')
  const [color, setColor] = useState<CollectionColor>(COLOR_PALETTE[0])

  return (
    <div className={`card ${styles.panel}`}>
      <div className={styles.inputRow}>
        <input
          className={styles.input}
          placeholder="Collection name"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
        />
        <button
          className={styles.addBtn}
          disabled={!name.trim()}
          onClick={() => name.trim() && onSave(name.trim(), icon, color)}
        >
          Add
        </button>
      </div>

      {/* Color row */}
      <div className={styles.colorRow}>
        {COLOR_PALETTE.map((c, i) => (
          <button
            key={i}
            className={`${styles.colorBtn} ${color === c ? styles.colorSelected : ''}`}
            style={{ background: c.accent }}
            onClick={() => setColor(c)}
          />
        ))}
      </div>

      {/* Icon grid grouped by category */}
      <div className={styles.iconScroll}>
        {ICON_GROUPS.map(group => (
          <div key={group.label} className={styles.iconGroup}>
            <span className={styles.groupLabel}>{group.label}</span>
            <div className={styles.iconGrid}>
              {group.icons.map(i => (
                <button
                  key={i}
                  className={`${styles.iconBtn} ${icon === i ? styles.iconSelected : ''}`}
                  style={{
                    background: icon === i ? color.bg : 'transparent',
                    borderColor: icon === i ? color.accent : 'transparent',
                  }}
                  onClick={() => setIcon(i)}
                  title={i}
                >
                  <CollectionIcon icon={i} accent={icon === i ? color.accent : 'var(--ink-muted)'} size={20} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
