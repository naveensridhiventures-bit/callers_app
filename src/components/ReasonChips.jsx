import { REASON, kgOf, reasonsOf } from '../cancelled'

/** colour-coded reason tags for a remark, so every remark is readable at a glance */
export function ReasonChips({ text, big = false, limit = 4 }) {
  const ids = reasonsOf(text)
  return (
    <span className={`rc-row ${big ? 'big' : ''}`}>
      {ids.slice(0, limit).map((id) => {
        const r = REASON[id]
        return <span key={id} className="rc" style={{ background: r.bg, color: r.color }}><em>{r.icon}</em>{r.label}</span>
      })}
    </span>
  )
}

export function KgBadge({ lead, big = false }) {
  const kg = kgOf(lead)
  if (!kg) return big ? <span className="kgb none">KG ?</span> : null
  return <span className={`kgb ${big ? 'big' : ''}`}><b>{kg}</b> kg</span>
}
