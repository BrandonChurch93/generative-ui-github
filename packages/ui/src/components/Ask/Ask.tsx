import styles from './Ask.module.css'

/** A suggested question, phrased the way a person would type it. The selected one is tinted; the rest are muted until hover. */
export function Ask({ label, ask, selected, onAsk }: { label: string; ask: string; selected?: boolean; onAsk?: (ask: string) => void }) {
  return (
    <button
      type="button"
      className={styles.chip}
      aria-current={selected ? 'true' : undefined}
      data-piece="Ask"
      data-chip=""
      onClick={() => onAsk?.(ask)}
    >
      {label}
    </button>
  )
}

export function AskRow({ asks, selected, onAsk }: { asks: { label: string; ask: string }[]; selected?: string; onAsk?: (ask: string) => void }) {
  return (
    <div className={styles.row}>
      {asks.map(a => (
        <Ask key={a.ask} label={a.label} ask={a.ask} selected={a.ask === selected} onAsk={onAsk} />
      ))}
    </div>
  )
}
