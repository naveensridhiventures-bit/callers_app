import { useMemo, useState } from 'react'
import { useApp } from '../store'
import { CORP_COLORS, HUBS, hubsForArea, hubOfArea } from '../hubs'

const key = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

/* Selling areas shown hub by hub. Picking one fixes the lead's area and hub. */
export default function AreaPicker({ value, hub, onChange }) {
  const { leads } = useApp()
  const [q, setQ] = useState(value || '')
  const [open, setOpen] = useState(false)
  const [hubSel, setHubSel] = useState(0)
  const exact = hubOfArea(value)
  const hubNo = exact?.hub || Number(hub) || hubsForArea(value)[0]?.hub || null

  const filled = useMemo(() => new Set(leads.filter((l) => l.type !== 'number' && l.area).map((l) => key(l.area))), [leads])

  const groups = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/[^a-z0-9 ]/g, '')
    const exactTyped = exact && key(q) === key(value)
    return HUBS.filter((h) => !hubSel || h.n === hubSel).map((h) => {
      const areas = h.areas.filter((a) => !s || exactTyped || a.a.toLowerCase().replace(/[^a-z0-9 ]/g, '').includes(s) || `hub ${h.n}` === s || h.near.toLowerCase().includes(s))
      return { h, areas }
    }).filter((g) => g.areas.length)
  }, [q, hubSel, exact, value])

  const pick = (h, a) => { onChange(a.a, h.n); setQ(a.a); setOpen(false) }
  const typed = (v) => { setQ(v); setOpen(true); const h = hubOfArea(v); onChange(v, h ? h.hub : '') }

  return (
    <div className="field area-pick">
      <span>Selling area (Bengaluru) · pick by hub</span>
      <input value={q} onChange={(e) => typed(e.target.value)} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)} placeholder="Search the area or hub number" autoComplete="off" />
      {open && (
        <div className="area-list" onMouseDown={(e) => e.preventDefault()}>
          <div className="area-hubs">
            <button type="button" className={!hubSel ? 'on' : ''} onClick={() => setHubSel(0)}>All hubs</button>
            {HUBS.map((h) => <button type="button" key={h.n} className={hubSel === h.n ? 'on' : ''} style={{ '--c': CORP_COLORS[h.corp] }} onClick={() => setHubSel(h.n)}>Hub {h.n}</button>)}
          </div>
          {groups.map(({ h, areas }) => (
            <div key={h.n} className="area-grp">
              <div className="area-gh" style={{ '--c': CORP_COLORS[h.corp] }}><i>{h.n}</i><b>Hub {h.n}</b><small>near {h.near.replace(/^near /, '')} · {h.corp}</small></div>
              {areas.map((a) => (
                <button type="button" key={a.a} className={`area-row ${key(a.a) === key(value) ? 'sel' : ''}`} onClick={() => pick(h, a)}>
                  <b>{a.a}</b>
                  {filled.has(key(a.a)) ? <small className="got">✓ has distributor</small> : <small className="need">needed</small>}
                </button>
              ))}
            </div>
          ))}
          {!groups.length && <p>No such area in the hub plan. Keep typing to use it as “Other”.</p>}
        </div>
      )}
      {value && (hubNo
        ? <em className="area-hub ok">📍 Hub {hubNo}{exact ? ` · near ${exact.near}` : ''}</em>
        : <em className="area-hub warn">Not in the hub plan. Pick the exact area from the list so this lead gets a hub.</em>)}
    </div>
  )
}
