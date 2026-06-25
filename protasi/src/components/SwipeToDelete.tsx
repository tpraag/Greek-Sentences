import { useRef, useState } from 'react'
import styles from './SwipeToDelete.module.css'

interface Props {
  onDelete: () => void
  children: React.ReactNode
}

const THRESHOLD = 72  // px to swipe before delete is revealed

export default function SwipeToDelete({ onDelete, children }: Props) {
  const [offset, setOffset] = useState(0)
  const [swiped, setSwiped] = useState(false)
  const startX = useRef<number | null>(null)
  const startY = useRef<number | null>(null)
  const isDragging = useRef(false)

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    isDragging.current = false
  }

  function onTouchMove(e: React.TouchEvent) {
    if (startX.current === null || startY.current === null) return
    const dx = e.touches[0].clientX - startX.current
    const dy = e.touches[0].clientY - startY.current

    // Only activate on horizontal swipe
    if (!isDragging.current) {
      if (Math.abs(dx) < Math.abs(dy)) return  // vertical scroll — ignore
      isDragging.current = true
    }

    if (dx > 0 && !swiped) return  // don't allow swipe right when closed
    if (dx > 0 && swiped) {
      // swiping back right
      const newOffset = Math.min(0, -THRESHOLD + dx)
      setOffset(newOffset)
      return
    }

    const newOffset = Math.max(-THRESHOLD, swiped ? -THRESHOLD + dx : dx)
    setOffset(newOffset)
    e.preventDefault()
  }

  function onTouchEnd() {
    if (!isDragging.current) return
    if (offset < -THRESHOLD * 0.5) {
      setOffset(-THRESHOLD)
      setSwiped(true)
    } else {
      setOffset(0)
      setSwiped(false)
    }
    startX.current = null
  }

  function close() {
    setOffset(0)
    setSwiped(false)
  }

  function handleDelete() {
    setOffset(-300)
    setTimeout(onDelete, 200)
  }

  return (
    <div className={styles.wrapper}>
      <div
        className={styles.content}
        style={{ transform: `translateX(${offset}px)`, transition: isDragging.current ? 'none' : 'transform .2s ease' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={swiped ? close : undefined}
      >
        {children}
      </div>
      <div
        className={styles.deleteBtn}
        style={{ opacity: Math.min(1, Math.abs(offset) / THRESHOLD) }}
        onClick={handleDelete}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14H6L5 6"/>
          <path d="M10 11v6M14 11v6"/>
          <path d="M9 6V4h6v2"/>
        </svg>
        Delete
      </div>
    </div>
  )
}
