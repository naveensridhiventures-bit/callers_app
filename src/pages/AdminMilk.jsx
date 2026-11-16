import { useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../store'
import { Counter, Icon } from '../ui'
import MapButton from '../components/MapPopup'
import { MILK_SEED } from '../milkSeed'
import { areaBoard, brandsOf, isMilk, isOwn, rowsToMilk, seedLeads } from '../milk'
import { fieldStatusOf } from '../fieldStatus'
import { readUpload } from '../cancelled'
import { bucket, download, fmtWhen, hotelPoint, parseCSV, toCSV } from '../utils'

const COLS = ['Name', 'Phone', 'Area', 'Brands', 'Owner', 'Address', 'Map Link', 'Notes', 'Source', 'Assigned To', 'Status', 'Last Visit']

/** HR: load / update the Chennai milk distributor list, hand it to a field person, see what the field person found herself. */
export default function AdminMilk() {
  const { allLeads, callers, importMilk, assignField, reviewLocation, removeLead, openLead, toast } = useApp()
  const [scope, setScope] = useState('all')
  const [area, setArea] = useState('all')
  const [who, setWho] = useState('all')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(() => new Set())
  const [field, setField] = useState('')
  const [target, setTarget] = useState('') // who receives an import
  const [paste, setPaste] = useState('')
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState(null)
  const [delId, setDelId] = useState(null)
  const file = useRef()

  const fieldList = callers.filter((c) => c.role === 'field' && c.active !== false)
  const nm = useMemo(() => new Map(callers.map((c) => [c.id, c.name])), [callers])
  const milk = useMemo(() => allLeads.filter(isMilk), [allLeads])
  const board = useMemo(() => areaBoard(milk, null).filter((b) => b.n > 0).sort((a, b) => b.n - a.n || a.area.localeCompare(b.area)), [milk])
  const seeded = useMemo(() => { const have = new Set(milk.map((l) => l.id)); return MILK_SEED.filter((r) => have.has(r.key)).length }, [milk])

  const k = {
    total: milk.length,
    admin: milk.filter((l) => !isOwn(l)).length,
    own: milk.filter(isOwn).length,
    unassigned: milk.filter((l) => !l.fieldId).length,
    done: milk.filter((l) => ['visited', 'notint'].includes(fieldStatusOf(l).id)).length,
    due: milk.filter((l) => ['overdue', 'today'].includes(bucket(l))).length,
    review: milk.filter((l) => l.locReview === 'new').length,
  }

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return milk.filter((l) => {
      if (scope === 'admin' && isOwn(l)) return false
      if (scope === 'own' && !isOwn(l)) return false
      if (scope === 'unassigned' && l.fieldId) return false
      if (scope === 'review' && l.locReview !== 'new') return false
      if (area !== 'all' && l.area !== area) return false
      if (who !== 'all' && l.fieldId !== who) return false
      return !s || `${l.name} ${l.phone} ${l.area} ${l.company} ${l.contactName}`.toLowerCase().includes(s)
    }).sort((a, b) => (a.area || '').localeCompare(b.area || '') || (a.name || '').localeCompare(b.name || ''))
  }, [milk, scope, area, who, q])

  const toggle = (id) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const field1 = target || (fieldList.length === 1 ? fieldList[0].id : '')

  const report = (r, what) => {
    setRes({ ...r, what })
    toast(`${r.added} added · ${r.updated} updated${r.same ? ` · ${r.same} unchanged` : ''} ✓`)
  }
  const loadSeed = () => report(importMilk(seedLeads(), field1), 'your Excel list')
  const doImport = (text) => {
    const arr = rowsToMilk(parseCSV(text))
    if (!arr.length) return toast('Need a header row with “Name” or “Phone”. Area, brands and map link are optional.', 'warn')
    report(importMilk(arr, field1), 'the uploaded list')
    setPaste('')
  }
  const pickFile = async (f) => {
    setBusy(true)
    try { const r = await readUpload(f); doImport(r.kind === 'csv' ? r.text : '') }
    catch (e) { toast(`Could not read that file${e?.message ? `: ${String(e.message).slice(0, 80)}` : ''}`, 'warn') }
    finally { setBusy(false) }
  }

  const assign = async () => {
    if (!sel.size) return toast('Tick the distributors first (or “Select all”)', 'warn')
    if (!field) return toast('Choose a field person', 'warn')
    setBusy(true)
    const n = await assignField([...sel], field === 'none' ? '' : field)
    setBusy(false); setSel(new Set())
    toast(`${n} distributor${n === 1 ? '' : 's'} ${field === 'none' ? 'unassigned' : `assigned to ${nm.get(field)}`} ✓`)
  }

  const exportList = () => {
    const rows = milk.map((l) => {
      const p = hotelPoint(l)
      return {
        Name: l.name, Phone: l.phone, Area: l.area, Brands: brandsOf(l).join(', '), Owner: l.contactName || '', Address: l.address || '',
        'Map Link': p ? `https://www.google.com/maps?q=${p.lat},${p.lng}` : '', Notes: l.notes || '', Source: isOwn(l) ? 'Own source' : 'Admin list',
        'Assigned To': nm.get(l.fieldId) || '', Status: fieldStatusOf(l).label, 'Last Visit': l.lastCall ? fmtWhen(l.lastCall) : '',
      }
    })
    download('chennai-milk-distributors.csv', '﻿' + toCSV(rows, COLS), 'text/csv')
  }

  return (
    <div className="page adm">
      <div className="page-h"><h1>Milk distributors <small>Chennai</small></h1>
        <button className="btn-soft sm" onClick={exportList} disabled={!milk.length}><Icon name="download" size={15} /> Download list</button>
      </div>

      <div className="kpis">
        <div className="kpi"><em>🥛</em><b><Counter value={k.total} /></b><span>Distributors</span></div>
        <div className="kpi"><em>🏢</em><b><Counter value={k.admin} /></b><span>Admin list</span></div>
        <div className="kpi"><em>🧭</em><b><Counter value={k.own} /></b><span>Found by field</span></div>
        <div className="kpi"><em>📭</em><b><Counter value={k.unassigned} /></b><span>Unassigned</span></div>
        <div className="kpi"><em>✅</em><b><Counter value={k.done} /></b><span>Visited{k.total ? ` · ${Math.round((k.done / k.total) * 100)}%` : ''}</span></div>
        <div className="kpi"><em>⏰</em><b><Counter value={k.due} /></b><span>Follow-up due</span></div>
      </div>

      <section className="card form">
        <h3>📥 Load or update the distributor list</h3>
        <label className="field"><span>Give the list to (field person)</span>
          <select value={target || field1} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Nobody yet (assign later)</option>
            {fieldList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        {!fieldList.length && <p className="mini-note">No field person yet. Add one in <b>Callers → Add</b> with the role “Field person”. You can still load the list and assign it later.</p>}

        <div className="mk-seed">
          <div>
            <b>Your Excel: Milk Distributors ({MILK_SEED.length})</b>
            <small>Area-wise Chennai list with phone, brands, last visit and exact map pins. {seeded >= MILK_SEED.length ? `All ${seeded} are already loaded.` : seeded ? `${seeded} already loaded.` : 'Not loaded yet.'}</small>
          </div>
          <motion.button whileTap={{ scale: 0.96, y: 3 }} className="btn3d lime" disabled={busy} onClick={loadSeed}><Icon name="download" size={18} /> {seeded >= MILK_SEED.length ? 'Reload / assign' : 'Load list'}</motion.button>
        </div>

        <input ref={file} type="file" accept=".xlsx,.csv,.txt,.tsv,text/csv" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) await pickFile(f); e.target.value = '' }} />
        <button className="btn-soft" disabled={busy} onClick={() => file.current.click()}><Icon name="upload" /> {busy ? 'Reading…' : 'Upload a new / updated Excel (.xlsx) or CSV'}</button>
        <p className="mini-note">Columns: <b>Name</b>, <b>Phone</b>, Area, Brands, Owner, Address, <b>Map Link</b>, Notes, Visit Date. A phone number already in the app is <b>updated</b> (name, area, brands, pin) and keeps its visit history. New numbers are added. The area spelling is matched to the Chennai area list.</p>
        <textarea rows={3} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'Name, Phone, Area, Brands, Map Link\nSri Murugan Milk, 9840012345, Adyar, Aavin, https://www.google.com/maps?q=13.0012,80.2565'} />
        {paste.trim() && <button className="btn3d" onClick={() => doImport(paste)}>Import pasted rows</button>}
        {res && (
          <div className="imp-report">
            <b>✅ {res.added} added · {res.updated} updated{res.same ? ` · ${res.same} unchanged` : ''}</b>
            <small>From {res.what}. {field1 ? `Assigned to ${nm.get(field1)}.` : 'Not assigned to a field person yet: tick them below and assign.'}</small>
          </div>
        )}
      </section>

      {board.length > 0 && (
        <section className="card">
          <h3 className="card-t">🗺 Area-wise <small className="mini-note">{board.length} areas have distributors</small></h3>
          <div className="mk-areas">
            {board.map((b) => (
              <button key={b.area} type="button" className={`mk-ar ${area === b.area ? 'on' : ''}`} onClick={() => { setArea(area === b.area ? 'all' : b.area); setSel(new Set()) }}>
                <b>{b.area}</b>
                <span>{b.n}</span>
                <small>{b.admin ? `🏢${b.admin}` : ''}{b.own ? ` 🧭${b.own}` : ''}{b.follow ? ` ⏰${b.follow}` : ''}</small>
                <i style={{ width: `${b.pct}%` }} />
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="card form">
        <h3>🎯 Pick distributors</h3>
        <div className="grid2">
          <label className="field"><span>Show</span>
            <select value={scope} onChange={(e) => { setScope(e.target.value); setSel(new Set()) }}>
              <option value="all">All distributors</option><option value="admin">🏢 Admin list</option><option value="own">🧭 Found by field (own source)</option>
              <option value="unassigned">📭 Unassigned</option><option value="review">📱 New pins to review{k.review ? ` (${k.review})` : ''}</option>
            </select>
          </label>
          <label className="field"><span>Area</span><select value={area} onChange={(e) => { setArea(e.target.value); setSel(new Set()) }}><option value="all">All areas</option>{board.map((b) => <option key={b.area} value={b.area}>{b.area} ({b.n})</option>)}</select></label>
          <label className="field"><span>Field person</span><select value={who} onChange={(e) => setWho(e.target.value)}><option value="all">Anyone</option>{fieldList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="field"><span>Search</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, phone, brand, area…" /></label>
        </div>
        <div className="sel-bar">
          <b>{list.length} match</b>
          <button className="btn-soft sm" onClick={() => setSel(new Set(list.map((l) => l.id)))}>Select all {list.length}</button>
          {sel.size > 0 && <button className="btn-soft sm" onClick={() => setSel(new Set())}>Clear ({sel.size})</button>}
        </div>
        <div className="alist">
          {list.slice(0, 80).map((l) => (
            <div key={l.id} className="arow-wrap">
              <label className={`arow ${sel.has(l.id) ? 'on' : ''}`}>
                <input type="checkbox" checked={sel.has(l.id)} onChange={() => toggle(l.id)} />
                <div>
                  <b>{l.name} <span className={`mk-src ${isOwn(l) ? 'own' : 'adm'}`}>{isOwn(l) ? '🧭 Own' : '🏢 Admin'}</span></b>
                  <small>{l.phone || 'No phone'} · 📍 {l.area || 'No area'}{brandsOf(l).length ? ` · 🥛 ${brandsOf(l).join(', ')}` : ''}</small>
                  <small>🚶 {nm.get(l.fieldId) || 'Unassigned'} · {fieldStatusOf(l).icon} {fieldStatusOf(l).label}{l.lastCall ? ` · last ${fmtWhen(l.lastCall)}` : ''}</small>
                  {l.lastRemark && <small className="arow-loc">💬 {l.lastRemark}</small>}
                  {l.locReview === 'new' && <small className="arow-loc">📱 Pin added by {l.locBy || 'field'} (±{l.locAcc || '?'} m)</small>}
                </div>
                <MapButton lead={l} className="round map sm" />
              </label>
              <div className="arow-tools">
                <button type="button" onClick={() => openLead(l.id, { tab: 'details' })}>✏️ Open / edit</button>
                {l.locReview === 'new' && <button type="button" onClick={() => { reviewLocation(l, 'ok'); toast('Pin approved ✓') }}>✅ Pin looks right</button>}
                {l.fieldId && <button type="button" className="warn" disabled={busy} onClick={() => assignField([l.id], '').then(() => toast('Unassigned'))}>✖ Field</button>}
                {delId === l.id
                  ? <span className="delq">Delete {l.name}? <button type="button" onClick={() => setDelId(null)}>Keep</button><button type="button" className="red" onClick={() => { removeLead(l.id); setDelId(null); setSel((p) => { const n = new Set(p); n.delete(l.id); return n }); toast(`🗑 ${l.name} deleted`) }}>Delete</button></span>
                  : <button type="button" className="red" onClick={() => setDelId(l.id)}>🗑 Delete</button>}
              </div>
            </div>
          ))}
          {list.length > 80 && <p className="mini-note">Showing 80. “Select all” selects all {list.length}.</p>}
          {!list.length && <p className="empty-s">{milk.length ? 'No distributors match.' : 'No distributors yet. Load your Excel list above.'}</p>}
        </div>
      </section>

      <section className="card form">
        <h3>👥 Assign {sel.size || ''} selected to a field person</h3>
        <label className="field"><span>🚶 Field person</span>
          <select value={field} onChange={(e) => setField(e.target.value)}><option value="">Choose…</option>{fieldList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}<option value="none">— Take back (unassign) —</option></select>
        </label>
        <motion.button whileTap={{ scale: 0.97, y: 3 }} className="btn3d" disabled={busy} onClick={assign}><Icon name="check" /> {busy ? 'Assigning…' : 'Assign'}</motion.button>
        <p className="mini-note">Tip: pick an area above, press “Select all”, then assign. The field person sees them area-wise and sends visit remarks back here.</p>
      </section>
    </div>
  )
}
