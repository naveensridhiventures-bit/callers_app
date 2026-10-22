import { useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../store'
import { Counter, Icon } from '../ui'
import { hotelPoint, parseCSV, rowsToHotels } from '../utils'
import MapButton from '../components/MapPopup'
import { STATUSES } from '../constants'
import { KG_BANDS, REASONS, isCancelled, kgBandOf, kgOf, mainReason, readUpload, reasonsOf } from '../cancelled'
import { KgBadge, ReasonChips } from '../components/ReasonChips'

const isHotelish = (l) => l.type === 'hotel' || /hotel|restaurant/i.test(l.bizType || '')

/** HR: import lapsed hotels, bulk-assign them to a caller + a field person, watch the win-back funnel. */
export default function AdminHotels() {
  const { allLeads, callers, importHotels, assignHotels, toast, go } = useApp()
  const [scope, setScope] = useState('unassigned')
  const [area, setArea] = useState('all')
  const [status, setStatus] = useState('all')
  const [reason, setReason] = useState('all')
  const [band, setBand] = useState('all')
  const [report, setReport] = useState(null)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(() => new Set())
  const [caller, setCaller] = useState('')
  const [field, setField] = useState('')
  const [paste, setPaste] = useState('')
  const [busy, setBusy] = useState(false)
  const file = useRef()

  const callerList = callers.filter((c) => c.role !== 'field' && c.active !== false)
  const fieldList = callers.filter((c) => c.role === 'field' && c.active !== false)
  const nm = useMemo(() => new Map(callers.map((c) => [c.id, c.name])), [callers])
  const hotels = useMemo(() => allLeads.filter((l) => l.type === 'hotel'), [allLeads])
  const areas = useMemo(() => [...new Set(allLeads.filter(isHotelish).map((l) => l.area).filter(Boolean))].sort(), [allLeads])

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return allLeads.filter((l) => {
      if (scope === 'convert' ? l.type === 'hotel' || !isHotelish(l) : l.type !== 'hotel') return false
      if (scope === 'unassigned' && (l.assignedTo || l.fieldId)) return false
      if (scope === 'cancelled' && !isCancelled(l)) return false
      if (reason !== 'all' && !reasonsOf(l.stopReason).includes(reason)) return false
      if (band !== 'all' && kgBandOf(l) !== band) return false
      if (area !== 'all' && l.area !== area) return false
      if (status !== 'all' && l.status !== status) return false
      return !s || `${l.name} ${l.phone} ${l.area} ${l.address}`.toLowerCase().includes(s)
    })
  }, [allLeads, scope, area, status, q, reason, band])

  const k = {
    total: hotels.length,
    unassigned: hotels.filter((l) => !l.assignedTo && !l.fieldId).length,
    visited: hotels.filter((l) => (l.calls || []).some((c) => c.mode === 'visit' && c.outcome !== 'Checked In')).length,
    won: hotels.filter((l) => l.status === 'Reactivated').length,
    cancelled: hotels.filter(isCancelled).length,
    kg: hotels.filter(isCancelled).reduce((n, l) => n + kgOf(l), 0),
  }
  const toggle = (id) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

  const showReport = (res) => {
    const { leads, rows, merged } = res
    const { added, skipped } = importHotels(leads)
    const by = {}
    leads.forEach((l) => { const r = mainReason(l); by[r] = (by[r] || 0) + 1 })
    setReport({ rows, merged, added, skipped, kg: leads.reduce((n, l) => n + kgOf(l), 0), noArea: leads.filter((l) => !l.area).length, noPhone: leads.filter((l) => !l.phone).length, by })
    setScope('cancelled')
    toast(`${added} hotel${added === 1 ? '' : 's'} imported from Excel ✓`)
  }

  // Excel (.xlsx) or CSV: the cancelled-order list, or any hotel table with a "Hotel name" column
  const pickFile = async (f) => {
    setBusy(true)
    try {
      const res = await readUpload(f)
      if (res.kind === 'cancelled') showReport(res)
      else doImport(res.text)
    } catch (e) {
      console.error('Upload failed', e)
      toast(`Could not read that file${e?.message ? `: ${String(e.message).slice(0, 80)}` : ''}`, 'warn')
    } finally { setBusy(false) }
  }

  const doImport = (text) => {
    const arr = rowsToHotels(parseCSV(text))
    if (!arr.length) return toast('Need a header row with “Hotel name”. Phone and map link are optional.', 'warn')
    const { added, skipped } = importHotels(arr)
    toast(`${added} hotel${added === 1 ? '' : 's'} imported${skipped ? ` · ${skipped} duplicates skipped` : ''} ✓`)
    setPaste('')
  }

  const assign = async () => {
    const ids = sel.size ? [...sel] : []
    if (!ids.length) return toast('Tick the hotels first (or “Select all”)', 'warn')
    if (!caller && !field) return toast('Choose a caller and/or a field person', 'warn')
    setBusy(true)
    const n = await assignHotels(ids, { callerId: caller ? (caller === 'none' ? '' : caller) : undefined, fieldId: field ? (field === 'none' ? '' : field) : undefined })
    setBusy(false); setSel(new Set())
    toast(`${n} hotel${n === 1 ? '' : 's'} assigned${caller && caller !== 'none' ? ` → caller ${nm.get(caller)}` : ''}${field && field !== 'none' ? ` → field ${nm.get(field)}` : ''} ✓`)
  }

  return (
    <div className="page adm">
      {(() => { const miss = hotels.filter((l) => !hotelPoint(l)).length; return hotels.length > 0 && (
        <button type="button" className={`lc-banner ${miss ? '' : 'ok'}`} onClick={() => go('locations')}>
          <em>📍</em>
          <span><b>{miss ? `${miss} hotel${miss > 1 ? 's' : ''} need an exact map pin` : 'All hotels have exact pins'}</b><small>{miss ? 'Auto-find, paste a Google Maps link, or bulk upload' : 'Tap to review or change a pin'}</small></span>
          <i>›</i>
        </button>
      ) })()}
      <div className="page-h"><h1>Lapsed hotels</h1></div>
      <div className="kpis">
        <div className="kpi"><em>🏨</em><b><Counter value={k.total} /></b><span>Hotels</span></div>
        <div className="kpi"><em>📭</em><b><Counter value={k.unassigned} /></b><span>Unassigned</span></div>
        <div className="kpi"><em>📍</em><b><Counter value={k.visited} /></b><span>Visited</span></div>
        <div className="kpi"><em>🚫</em><b><Counter value={k.cancelled} /></b><span>Cancelled · {k.kg} kg</span></div>
        <div className="kpi"><em>🎉</em><b><Counter value={k.won} /></b><span>Won back{k.total ? ` · ${Math.round((k.won / k.total) * 100)}%` : ''}</span></div>
      </div>

      <section className="card form">
        <h3>📥 Import hotels that stopped ordering</h3>
        <p className="mini-note">Paste or upload columns with a header row: <b>Hotel name</b>, phone, contact person, area, address, <b>map link</b>, last order, reason. Phone and map link are optional. A pasted Google Maps link gives the exact pin.</p>
        <input ref={file} type="file" accept=".xlsx,.csv,.txt,.tsv,text/csv" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) await pickFile(f); e.target.value = '' }} />
        <button className="btn-soft" disabled={busy} onClick={() => file.current.click()}><Icon name="upload" /> {busy ? 'Reading…' : 'Choose Excel (.xlsx) or CSV file'}</button>
        <p className="mini-note">Cancelled-order Excel: every sheet is read. Columns: customer name, location, mobile number, KG, remark. The same mobile on several sheets is merged into one hotel.</p>
        {report && (
          <div className="imp-report">
            <b>✅ {report.added} new hotels added{report.skipped ? ` · ${report.skipped} already in the app` : ''}</b>
            <small>{report.rows} rows read · {report.merged} duplicates merged · {report.kg} kg in total</small>
            <div className="rc-row">{REASONS.filter((r) => report.by[r.id]).map((r) => <span key={r.id} className="rc" style={{ background: r.bg, color: r.color }}><em>{r.icon}</em>{r.label} {report.by[r.id]}</span>)}</div>
            {(report.noArea > 0 || report.noPhone > 0) && <small className="warn">⚠️ {report.noArea} without a location and {report.noPhone} without a mobile number. Fix them with Edit so the field team can filter and call them.</small>}
          </div>
        )}
        <textarea rows={3} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'Hotel name, Phone, Area, Map link, Last order\nSri Sagar, 9845012345, Indiranagar, https://maps.app.goo.gl/…, 12 Aug'} />
        {paste.trim() && <button className="btn3d" onClick={() => doImport(paste)}>Import pasted rows</button>}
      </section>

      <section className="card form">
        <h3>🎯 Pick hotels</h3>
        <div className="grid2">
          <label className="field"><span>Show</span>
            <select value={scope} onChange={(e) => { setScope(e.target.value); setSel(new Set()) }}>
              <option value="unassigned">Unassigned hotels</option><option value="all">All hotels</option><option value="cancelled">Cancelled-order hotels</option><option value="convert">Existing leads that are hotels (convert)</option>
            </select>
          </label>
          <label className="field"><span>Area</span><select value={area} onChange={(e) => setArea(e.target.value)}><option value="all">All areas</option>{areas.map((a) => <option key={a}>{a}</option>)}</select></label>
          <label className="field"><span>Status</span><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All</option>{STATUSES.map((s) => <option key={s.id}>{s.id}</option>)}</select></label>
          <label className="field"><span>Reason</span><select value={reason} onChange={(e) => setReason(e.target.value)}><option value="all">All reasons</option>{REASONS.map((r) => <option key={r.id} value={r.id}>{r.icon} {r.label}</option>)}</select></label>
          <label className="field"><span>KG</span><select value={band} onChange={(e) => setBand(e.target.value)}><option value="all">Any KG</option>{KG_BANDS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select></label>
          <label className="field"><span>Search</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Hotel, phone, area…" /></label>
        </div>
        <div className="sel-bar">
          <b>{list.length} match</b>
          <button className="btn-soft sm" onClick={() => setSel(new Set(list.map((l) => l.id)))}>Select all {list.length}</button>
          {sel.size > 0 && <button className="btn-soft sm" onClick={() => setSel(new Set())}>Clear ({sel.size})</button>}
        </div>
        <div className="alist">
          {list.slice(0, 80).map((l) => (
            <label key={l.id} className={`arow ${sel.has(l.id) ? 'on' : ''}`}>
              <input type="checkbox" checked={sel.has(l.id)} onChange={() => toggle(l.id)} />
              <div><b>{l.name}</b><small>{l.phone || 'No contact'} · {l.area || l.address || 'No area'}</small>
                <small>📞 {nm.get(l.assignedTo) || '—'} · 🚶 {nm.get(l.fieldId) || '—'}</small>
                {(l.stopReason || kgOf(l) > 0) && <div className="arow-why"><ReasonChips text={l.stopReason} limit={3} /><KgBadge lead={l} /></div>}</div>
              {(l.mapUrl || l.lat || l.address) && <MapButton lead={l} className="round map sm" />}
            </label>
          ))}
          {list.length > 80 && <p className="mini-note">Showing 80. “Select all” selects all {list.length}.</p>}
          {!list.length && <p className="empty-s">No hotels match.</p>}
        </div>
      </section>

      <section className="card form">
        <h3>👥 Bulk assign {sel.size || ''} selected</h3>
        <div className="grid2">
          <label className="field"><span>📞 Caller (follow-up calls)</span>
            <select value={caller} onChange={(e) => setCaller(e.target.value)}><option value="">Don’t change</option>{callerList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}<option value="none">— Remove —</option></select>
          </label>
          <label className="field"><span>🚶 Field person (visits)</span>
            <select value={field} onChange={(e) => setField(e.target.value)}><option value="">Don’t change</option>{fieldList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}<option value="none">— Remove —</option></select>
          </label>
        </div>
        {!fieldList.length && <p className="mini-note">No field person yet. Add one in <b>Callers → Add</b> and choose the role “Field person”.</p>}
        <motion.button whileTap={{ scale: 0.97, y: 3 }} className="btn3d" disabled={busy} onClick={assign}><Icon name="check" /> {busy ? 'Assigning…' : 'Assign to both'}</motion.button>
      </section>
    </div>
  )
}
