import { useMemo, useState } from 'react'
import { CHENNAI_AREAS, areaInfo } from '../chennai'

/** Chennai locality picker for hotels: type to search, or enter any other locality. */
export default function ChennaiAreaPicker({ value, onChange }) {
  const [q, setQ] = useState(value || '')
  const [open, setOpen] = useState(false)
  const s = q.trim().toLowerCase()
  const list = useMemo(() => CHENNAI_AREAS.filter((a) => !s || a.a.toLowerCase().includes(s)).slice(0, 40), [s])
  const known = areaInfo(q)
  const pick = (a) => { setQ(a); setOpen(false); onChange(a) }
  return (
    <div className="field area-pick">
      <span>Area (Chennai)</span>
      <input
        value={q} placeholder="Search Chennai area" autoComplete="off"
        onChange={(e) => { setQ(e.target.value); setOpen(true); onChange(e.target.value) }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 180)}
      />
      {open && list.length > 0 && (
        <div className="area-list">
          {list.map((a) => (
            <button type="button" key={a.a} className="area-row" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(a.a)}>
              <b>{a.a}</b>
            </button>
          ))}
        </div>
      )}
      {q.trim() && <em className={`area-hub ${known ? 'ok' : 'warn'}`}>{known ? `📍 ${known.a}, Chennai` : 'Other Chennai locality · add the Google Maps link for exact location'}</em>}
    </div>
  )
}
