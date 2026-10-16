import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useApp } from '../store'
import { Avatar, Counter, Icon, Segmented, StatusPill } from '../ui'
import { STATUSES, OUTCOMES } from '../constants'
import { fmtWhen, nameOf, nowISO, parseCSV, rowsToLeads, sameDay, uid } from '../utils'

const rndPin = () => String(Math.floor(1000 + Math.random() * 9000))

/* ---------------- Callers ---------------- */
function Callers() {
  const { callers, allLeads, saveCaller, deleteCaller, toast } = useApp()
  const [name, setName] = useState('')
  const [pin, setPin] = useState(rndPin())
  const [show, setShow] = useState({})
  const [busy, setBusy] = useState(false)

  const counts = useMemo(() => {
    const m = {}
    allLeads.forEach((l) => { if (l.assignedTo) m[l.assignedTo] = (m[l.assignedTo] || 0) + 1 })
    return m
  }, [allLeads])

  const add = async (e) => {
    e.preventDefault()
    if (!name.trim()) return toast('Enter the caller name', 'warn')
    if (!/^\d{4}$/.test(pin)) return toast('PIN must be 4 digits', 'warn')
    setBusy(true)
    const ok = await saveCaller({ id: uid(), name: name.trim(), pin, active: true, createdAt: nowISO() })
    setBusy(false)
    if (ok) { toast(`${name.trim()} added ✓  PIN ${pin}`); setName(''); setPin(rndPin()) }
    else toast('Could not save. Check internet / Apps Script v2', 'warn')
  }

  return (
    <div className="sub">
      <form className="card form" onSubmit={add}>
        <h3>➕ Add a caller</h3>
        <div className="grid2">
          <label className="field"><span>Caller name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya" /></label>
          <label className="field"><span>4-digit PIN</span>
            <div className="pin-in">
              <input inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
              <button type="button" className="btn-soft sm" onClick={() => setPin(rndPin())}><Icon name="refresh" size={16} /></button>
            </div>
          </label>
        </div>
        <motion.button whileTap={{ scale: 0.97, y: 3 }} className="btn3d" disabled={busy}><Icon name="plus" /> {busy ? 'Saving…' : 'Add caller'}</motion.button>
        <small className="hint">Tell the caller her name and PIN. She signs in with these on her phone and sees only the numbers you assign to her.</small>
      </form>

      <AnimatePresence initial={false}>
        {callers.map((c, i) => (
          <motion.div key={c.id} layout className="crow card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ delay: i * 0.04 }}>
            <Avatar name={c.name} size={46} />
            <div className="crow-main">
              <b>{c.name}</b>
              <small>{counts[c.id] || 0} leads assigned</small>
            </div>
            <button className="pin-chip" onClick={() => setShow((s) => ({ ...s, [c.id]: !s[c.id] }))}>{show[c.id] ? `PIN ${c.pin}` : 'PIN ••••'}</button>
            <button className="icon-btn danger" aria-label="Remove" onClick={async () => {
              if (confirm(`Remove ${c.name}? Her ${counts[c.id] || 0} leads become unassigned.`)) { await deleteCaller(c.id); toast('Caller removed') }
            }}><Icon name="trash" size={18} /></button>
          </motion.div>
        ))}
      </AnimatePresence>
      {!callers.length && <div className="card empty"><div className="empty-ico">👥</div><h3>No callers yet</h3><p>Add your first caller above. Until then the app stays in single-user mode.</p></div>}
    </div>
  )
}

/* ---------------- Assign ---------------- */
function Assign() {
  const { allLeads, callers, assignMany, importLeads, toast } = useApp()
  const [scope, setScope] = useState('unassigned')
  const [status, setStatus] = useState('all')
  const [area, setArea] = useState('all')
  const [type, setType] = useState('all')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(() => new Set())
  const [target, setTarget] = useState('')
  const [pool, setPool] = useState(() => new Set())
  const [mode, setMode] = useState('area')
  const [busy, setBusy] = useState(false)
  const [paste, setPaste] = useState('')
  const [impTo, setImpTo] = useState('')
  const file = useRef()

  const areas = useMemo(() => [...new Set(allLeads.map((l) => l.area).filter(Boolean))].sort(), [allLeads])
  const names = useMemo(() => new Map(callers.map((c) => [c.id, c.name])), [callers])

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return allLeads.filter((l) => {
      if (scope === 'unassigned' && l.assignedTo) return false
      if (scope !== 'unassigned' && scope !== 'all' && l.assignedTo !== scope) return false
      if (status !== 'all' && l.status !== status) return false
      if (area !== 'all' && l.area !== area) return false
      if (type !== 'all' && l.type !== type) return false
      if (s && !(`${l.name} ${l.phone} ${l.company} ${l.area}`.toLowerCase().includes(s))) return false
      return true
    })
  }, [allLeads, scope, status, area, type, q])

  const toggle = (id) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selectAll = () => setSel(new Set(list.map((l) => l.id)))
  const togglePool = (id) => setPool((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

  const assignSel = async () => {
    if (!sel.size) return toast('Select some leads first', 'warn')
    if (target === '') return toast('Choose who to assign to', 'warn')
    setBusy(true)
    const n = await assignMany([...sel].map((id) => [id, target === 'none' ? '' : target]))
    setBusy(false)
    setSel(new Set())
    toast(`${n} lead${n > 1 ? 's' : ''} ${target === 'none' ? 'unassigned' : `assigned to ${names.get(target)}`} ✓`)
  }

  const distribute = async () => {
    const who = callers.filter((c) => pool.has(c.id))
    const src = sel.size ? list.filter((l) => sel.has(l.id)) : list
    if (!who.length) return toast('Pick the callers to share between', 'warn')
    if (!src.length) return toast('No leads to distribute', 'warn')
    if (!confirm(`Split ${src.length} leads between ${who.map((c) => c.name).join(', ')} (${mode === 'area' ? 'area-wise' : 'one by one'})?`)) return
    setBusy(true)
    const arr = mode === 'area' ? [...src].sort((a, b) => (a.area || '').localeCompare(b.area || '')) : src
    const pairs = []
    if (mode === 'area') {
      const per = Math.ceil(arr.length / who.length)
      arr.forEach((l, i) => pairs.push([l.id, who[Math.min(who.length - 1, Math.floor(i / per))].id]))
    } else arr.forEach((l, i) => pairs.push([l.id, who[i % who.length].id]))
    const n = await assignMany(pairs)
    setBusy(false)
    setSel(new Set())
    toast(`${n} leads shared between ${who.length} callers ✓`)
  }

  const doImport = (text) => {
    const arr = rowsToLeads(parseCSV(text))
    if (!arr.length) return toast('No rows found. Need columns: name, phone, area…', 'warn')
    const { added, skipped } = importLeads(arr, impTo === 'none' ? '' : impTo)
    toast(`Imported ${added}${skipped ? ` · ${skipped} duplicates skipped` : ''}${impTo && impTo !== 'none' ? ` → ${names.get(impTo)}` : ''} ✓`)
    setPaste('')
  }
  const onFile = async (e) => {
    const f = e.target.files?.[0]
    if (f) doImport(await f.text())
    e.target.value = ''
  }

  const unassigned = allLeads.filter((l) => !l.assignedTo).length

  return (
    <div className="sub">
      <div className="kpis">
        <div className="kpi"><em>📋</em><b><Counter value={allLeads.length} /></b><span>Total leads</span></div>
        <div className="kpi"><em>📭</em><b><Counter value={unassigned} /></b><span>Unassigned</span></div>
      </div>

      <section className="card form">
        <h3>🎯 Pick leads</h3>
        <div className="grid2">
          <label className="field"><span>Show</span>
            <select value={scope} onChange={(e) => { setScope(e.target.value); setSel(new Set()) }}>
              <option value="unassigned">Unassigned only</option>
              <option value="all">All leads</option>
              {callers.map((c) => <option key={c.id} value={c.id}>Assigned to {c.name}</option>)}
            </select>
          </label>
          <label className="field"><span>Area</span>
            <select value={area} onChange={(e) => setArea(e.target.value)}><option value="all">All areas</option>{areas.map((a) => <option key={a}>{a}</option>)}</select>
          </label>
          <label className="field"><span>Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All status</option>{STATUSES.map((s) => <option key={s.id}>{s.id}</option>)}</select>
          </label>
          <label className="field"><span>Type</span>
            <select value={type} onChange={(e) => setType(e.target.value)}><option value="all">All</option><option value="distributor">Distributor</option><option value="sales">Sales</option></select>
          </label>
        </div>
        <div className="search"><Icon name="search" size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, shop…" /></div>
        <div className="sel-bar">
          <b>{list.length} match</b>
          <button className="btn-soft sm" onClick={selectAll}>Select all {list.length}</button>
          {sel.size > 0 && <button className="btn-soft sm" onClick={() => setSel(new Set())}>Clear ({sel.size})</button>}
        </div>
        <div className="alist">
          {list.slice(0, 60).map((l) => (
            <label key={l.id} className={`arow ${sel.has(l.id) ? 'on' : ''}`}>
              <input type="checkbox" checked={sel.has(l.id)} onChange={() => toggle(l.id)} />
              <div><b>{nameOf(l)}</b><small>{l.type === 'number' ? 'Number only' : l.phone} · {l.area || 'Bengaluru'}{l.company ? ` · ${l.company}` : ''}</small></div>
              <span className="who-tag">{l.assignedTo ? names.get(l.assignedTo) || '—' : 'Unassigned'}</span>
            </label>
          ))}
          {list.length > 60 && <p className="mini-note">Showing first 60. “Select all” still selects all {list.length}.</p>}
          {!list.length && <p className="empty-s">No leads match these filters.</p>}
        </div>
      </section>

      <section className="card form">
        <h3>👤 Assign selected</h3>
        <label className="field"><span>Assign {sel.size || 'selected'} lead{sel.size === 1 ? '' : 's'} to</span>
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Choose caller…</option>
            {callers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="none">— Unassign —</option>
          </select>
        </label>
        <motion.button whileTap={{ scale: 0.97, y: 3 }} className="btn3d" disabled={busy} onClick={assignSel}><Icon name="check" /> {busy ? 'Assigning…' : `Assign ${sel.size || ''}`}</motion.button>
      </section>

      <section className="card form">
        <h3>⚖️ Auto-distribute</h3>
        <p className="mini-note">Shares {sel.size ? `the ${sel.size} selected` : `all ${list.length} listed`} leads between the callers you tick.</p>
        <div className="chips">
          {callers.map((c) => <button key={c.id} type="button" className={`chip ${pool.has(c.id) ? 'on' : ''}`} onClick={() => togglePool(c.id)}>{c.name}</button>)}
        </div>
        <Segmented id="ad-mode" value={mode} onChange={setMode} options={[{ value: 'area', label: '📍 Area-wise' }, { value: 'rr', label: '🔁 One by one' }]} />
        <motion.button whileTap={{ scale: 0.97, y: 3 }} className="btn3d" disabled={busy} onClick={distribute}><Icon name="users" /> Distribute</motion.button>
      </section>

      <section className="card form">
        <h3>📥 Import numbers / data &amp; assign</h3>
        <p className="mini-note">Paste <b>just phone numbers, one per line</b>: the caller sees only the number, speaks first, then fills in the person's details. Or paste <b>name, phone, area</b> columns for full leads.</p>
        <label className="field"><span>Assign imported numbers to</span>
          <select value={impTo} onChange={(e) => setImpTo(e.target.value)}>
            <option value="">Keep unassigned</option>
            {callers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <input ref={file} type="file" accept=".csv,text/csv,.txt,.tsv" hidden onChange={onFile} />
        <button className="btn-soft" onClick={() => file.current.click()}><Icon name="upload" /> Choose CSV file</button>
        <textarea rows={3} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'Paste numbers, one per line:\n9876543210\n9845012345\n\n…or name, phone, area columns'} />
        {paste.trim() && <button className="btn3d" onClick={() => doImport(paste)}>Import pasted rows</button>}
      </section>
    </div>
  )
}

/* ---------------- Team ---------------- */
function Team() {
  const { callers, allLeads } = useApp()
  const rows = useMemo(() => {
    const now = new Date()
    const week = new Date(); week.setDate(week.getDate() - 6); week.setHours(0, 0, 0, 0)
    return callers.map((c) => {
      const mine = allLeads.filter((l) => l.assignedTo === c.id)
      const calls = mine.flatMap((l) => l.calls || [])
      const isConn = (x) => OUTCOMES.find((o) => o.id === x.outcome)?.connected
      return {
        c, assigned: mine.length,
        fresh: mine.filter((l) => !l.callCount).length,
        today: calls.filter((x) => sameDay(x.at, now)).length,
        week: calls.filter((x) => new Date(x.at) >= week).length,
        connected: calls.filter((x) => new Date(x.at) >= week && isConn(x)).length,
        interested: mine.filter((l) => ['Interested', 'Meeting Fixed', 'Documentation'].includes(l.status)).length,
        won: mine.filter((l) => l.status === 'Onboarded').length,
        overdue: mine.filter((l) => l.nextFollowUp && !['Onboarded', 'Not Interested'].includes(l.status) && new Date(l.nextFollowUp) < now).length,
      }
    })
  }, [callers, allLeads])
  const max = Math.max(1, ...rows.map((r) => r.week))

  return (
    <div className="sub">
      {rows.map((r, i) => (
        <motion.div key={r.c.id} className="card team" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
          <div className="team-h"><Avatar name={r.c.name} size={42} /><b>{r.c.name}</b><span className="tag">{r.assigned} assigned</span></div>
          <div className="team-grid">
            <div><b>{r.today}</b><small>Calls today</small></div>
            <div><b>{r.week}</b><small>Calls 7 days</small></div>
            <div><b>{r.interested}</b><small>Interested</small></div>
            <div><b>{r.won}</b><small>Onboarded</small></div>
            <div><b>{r.fresh}</b><small>Not called</small></div>
            <div className={r.overdue ? 'bad' : ''}><b>{r.overdue}</b><small>Overdue</small></div>
          </div>
          <div className="meter"><motion.i initial={{ width: 0 }} animate={{ width: `${(r.week / max) * 100}%` }} transition={{ duration: 0.8 }} /></div>
        </motion.div>
      ))}
      {!rows.length && <div className="card empty"><div className="empty-ico">📊</div><h3>No callers yet</h3><p>Add callers in the Callers tab.</p></div>}
    </div>
  )
}

/* ---------------- Delete requests ---------------- */
function Requests() {
  const { allLeads, removeLead, saveLead, openLead, toast } = useApp()
  const list = allLeads.filter((l) => l.delReq === '1')
  return (
    <div className="sub">
      <AnimatePresence initial={false}>
        {list.map((l) => (
          <motion.div key={l.id} layout className="card req-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -40 }}>
            <div className="req-top" onClick={() => openLead(l.id)}>
              <Avatar name={nameOf(l)} icon={l.type === 'number' || !l.name} size={42} />
              <div><b>{nameOf(l)}</b><small>{l.phone} · {l.area || 'Bengaluru'}</small></div>
            </div>
            <p className="req-note">Requested by <b>{l.delReqBy || 'caller'}</b>{l.delReqAt ? ` · ${fmtWhen(l.delReqAt)}` : ''}{l.delReqNote ? <><br />“{l.delReqNote}”</> : null}</p>
            <div className="done-actions" style={{ justifyContent: 'flex-start' }}>
              <button className="btn-soft danger" onClick={() => { removeLead(l.id); toast('Lead deleted') }}><Icon name="trash" /> Approve &amp; delete</button>
              <button className="btn-soft" onClick={() => { saveLead({ ...l, delReq: '', delReqBy: '', delReqAt: '', delReqNote: '' }); toast('Request rejected, lead kept') }}>Keep lead</button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      {!list.length && <div className="card empty"><div className="empty-ico">✅</div><h3>No delete requests</h3><p>When a caller asks to delete a lead, it shows up here for your approval.</p></div>}
    </div>
  )
}

/* ---------------- page ---------------- */
export default function Admin() {
  const { session, logout, scriptVersion, allLeads } = useApp()
  const reqCount = allLeads.filter((l) => l.delReq === '1').length
  const [tab, setTab] = useState('callers')
  if (session?.role !== 'admin') return <div className="card empty"><h3>Admin only</h3></div>
  const C = { callers: Callers, assign: Assign, team: Team, requests: Requests }[tab]
  return (
    <div className="sub">
      <div className="admin-bar">
        <span>🛡 HR admin mode{scriptVersion && scriptVersion < 3 ? ` · script v${scriptVersion} (update to v3)` : ''}</span>
        <button className="btn-soft sm" onClick={logout}>Exit admin</button>
      </div>
      <Segmented id="adm-tab" value={tab} onChange={setTab} options={[{ value: 'callers', label: '👥 Callers' }, { value: 'assign', label: '📤 Assign' }, { value: 'team', label: '📊 Team' }, { value: 'requests', label: `🗑 Requests${reqCount ? ` (${reqCount})` : ''}` }]} />
      <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}><C /></motion.div>
    </div>
  )
}
