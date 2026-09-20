interface Props {
  title: string
  message: string
  confirmLabel: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

// In-app replacement for window.confirm — native dialogs are blocked or skipped in some
// browsers and installed-app contexts, which makes a confirm-gated button silently do nothing.
export default function ConfirmSheet({ title, message, confirmLabel, destructive, onConfirm, onCancel }: Props) {
  return (
    <div className="sheet-overlay" onClick={onCancel}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>{title}</h3>
        <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--ink-soft)', marginBottom: 20 }}>{message}</p>
        <button
          className="btn-accent"
          style={destructive ? { background: 'var(--destructive)', boxShadow: 'none' } : undefined}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
        <button className="btn-outline" style={{ marginTop: 10, width: '100%' }} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
