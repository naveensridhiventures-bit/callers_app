import { useState } from 'react'
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

/**
 * "Why they stopped" panel. Sits right above the map in the visit card and the location popup,
 * so the field person reads the reason BEFORE walking in.
 */
export function WhyBox({ lead, tip = true, compact = false }) {
  const [open, setOpen] = useState(false)
  const ids = reasonsOf(lead.stopReason)
  const main = REASON[ids[0]]
  const none = ids[0] === 'none'
  return (
    <div className={`wy ${compact ? 'compact' : ''} ${none ? 'none' : ''}`} style={{ '--tc': main.color, '--tb': main.bg }}>
      <div className="wy-h">
        <span className="wy-l">⚠️ Why they stopped</span>
        <span className="wy-r">
          {lead.lastOrderOn && <small>🕒 Last order {lead.lastOrderOn}</small>}
          <KgBadge lead={lead} big />
        </span>
      </div>
      <ReasonChips text={lead.stopReason} big limit={4} />
      {lead.stopReason && <p className="wy-q">“{lead.stopReason}”</p>}
      {none && <p className="wy-ask">Nobody noted the reason. Ask the owner politely and record it in your remark.</p>}
      {tip && main.tip && (
        <>
          <button type="button" className="wy-tipb" onClick={() => setOpen((o) => !o)}>{open ? '▾' : '▸'} 💡 How to win them back</button>
          {open && <p className="wy-tip">{main.tip}</p>}
        </>
      )}
    </div>
  )
}
