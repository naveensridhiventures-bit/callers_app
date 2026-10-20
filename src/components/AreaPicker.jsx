import { useMemo, useState } from 'react'
import { AREA_OPTIONS, CORP_COLORS, hubsForArea, hubOfArea } from '../hubs'

/* Exact selling area from the hub plan. Picking one also fixes the lead's hub. */
export default function AreaPicker({ value, hub, onChange }) {
  const [q, setQ] = useState(value || '')
  const [open, setOpen] = useState(false)
  const exact = hubOfArea(value)
  const hubNo = exact?.hub || Number(hub) || hubsForArea(value)[0]?.hub || null
  const res = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/[^a-z0-9 ]/g, '')
    if (!s) return AREA_OPTIONS.slice(0, 40)
    return AREA_OPTIONS.filter((o) => o.label.toLowerCase().replace(/[^a-z0-9 ]/g, '').includes(s) || `hub ${o.hub}` === s || o.near.toLowerCase().includes(s)).slice(0, 40)
  }, [q])

  const pick = (o) => { onChange(o.label, o.hub); setQ(o.label); setOpen(false) }
  const typed = (v) => { setQ(v); setOpen(true); const h = hubOfArea(v); onChange(v, h ? h.hub : '') }

  return (
    <label className="field area-pick" onClick={(e) => e.preventDefault()}>
      <span>Selling area (Bengaluru)</span>
      <input value={q} onChange={(e) => typed(e.target.value)} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 180)} placeholder="Search the area, e.g. Whitefield" autoComplete="off" />
      {open && (
        <div className="area-list">
          {res.map((o) => (
            <button type="button" key={o.label} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o)}>
              <b>{o.label}</b><i style={{ background: CORP_COLORS[o.corp] }}>Hub {o.hub}</i><small>near {o.near}</small>
            </button>
          ))}
          {!res.length && <p>No such area in the hub plan. Keep typing to use it as “Other”.</p>}
        </div>
      )}
      {value && (hubNo
        ? <em className="area-hub ok">📍 Hub {hubNo}{exact ? ` · near ${exact.near}` : ''}</em>
        : <em className="area-hub warn">Not in the hub plan. Pick the exact area from the list so this lead gets a hub.</em>)}
    </label>
  )
}
