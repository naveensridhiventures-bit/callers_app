import { useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../store'
import { Icon } from '../ui'
import { areaInfo } from '../chennai'
import { WhyBox } from '../components/ReasonChips'
import AdminHotelEditor from '../components/AdminHotelEditor'
import { REASONS, reasonsOf } from '../cancelled'
import { coordsFromLink, download, hotelPoint, km, fmtKm } from '../utils'

const CHENNAI = { lat: 13.0827, lng: 80.2707 }
const NOM = 'https://nominatim.openstreetmap.org/search'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const gSearch = (l) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([l.name, l.address, l.area, 'Chennai'].filter(Boolean).join(', '))}`
const embed = (p) => `https://maps.google.com/maps?q=${p.lat},${p.lng}&z=17&output=embed`
const hasPin = (l) => !!hotelPoint(l)
// a closed hotel needs no map pin: say so from the reason or the last visit
const isClosed = (l) => l.lastOutcome === 'Hotel Closed' || reasonsOf(l.stopReason).includes('closed')
// pinned (exact location) | closed (no pin needed) | need (still area centre only)
const stateOf = (l) => (hasPin(l) ? 'pinned' : isClosed(l) ? 'closed' : 'need')

/** "13.0418, 80.2341"  or any Google Maps link that carries coordinates */
export function parsePin(text) {
  const t = String(text || '').trim()
  if (!t) return null
  const m = t.match(/^\(?\s*(-?\d{1,2}\.\d+)\s*[,;\s]\s*(-?\d{1,3}\.\d+)\s*\)?$/)
  if (m) return { lat: Number(m[1]), lng: Number(m[2]) }
  let dec = t
  try { dec = decodeURIComponent(t) } catch { /* keep raw */ }
  return coordsFromLink(t) || coordsFromLink(dec)
}
const inChennai = (p) => km(CHENNAI, p) <= 60

/** OpenStreetMap search (free, no key). Candidates are ranked by distance from the hotel's area centre. */
async function findPlaces(l) {
  const base = { format: 'jsonv2', countrycodes: 'in', limit: '5', viewbox: '79.95,13.35,80.45,12.70', bounded: '1' }
  const centre = areaInfo(l.area)
  for (const q of [[l.name, l.area, 'Chennai'], [l.name, 'Chennai']].map((a) => a.filter(Boolean).join(', '))) {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 9000)
    try {
      const r = await fetch(`${NOM}?${new URLSearchParams({ ...base, q })}`, { headers: { Accept: 'application/json' }, signal: ctl.signal })
      if (!r.ok) throw new Error(`Search service said ${r.status}`)
      const j = await r.json()
      if (j.length) {
        return j.map((x) => {
          const p = { lat: Number(x.lat), lng: Number(x.lon) }
          return { ...p, title: x.name || String(x.display_name).split(',')[0], addr: String(x.display_name).split(',').slice(0, 4).join(','), d: centre ? km(centre, p) : null }
        }).sort((a, b) => (a.d ?? 1e9) - (b.d ?? 1e9))
      }
    } finally { clearTimeout(to) }
    await sleep(1100)
  }
  return []
}

export default function AdminLocations() {
  const { allLeads, saveLead, toast, go, resolveMapLink, removeLead } = useApp()
  const hotels = useMemo(() => allLeads.filter((l) => l.type === 'hotel'), [allLeads])
  const [tab, setTab] = useState('missing')
  const [why, setWhy] = useState('all')
  const [area, setArea] = useState('all')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null)
  const [delId, setDelId] = useState(null)
  const [open, setOpen] = useState(null)
  const [paste, setPaste] = useState({})
  const [cands, setCands] = useState({})      // id -> [candidates]
  const [busy, setBusy] = useState(null)      // id being searched
  const [batch, setBatch] = useState(null)    // { done, total } while auto-finding all
  const [bulk, setBulk] = useState('')
  const [showBulk, setShowBulk] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const stop = useRef(false)
  const [reading, setReading] = useState(null) // id whose short link is being read
  const isShort = (t) => /(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)\/\S{4,}/i.test(String(t))

  // short link -> coordinates (the Sheet script follows the redirect), then fill the box
  const readLink = async (l, text) => {
    setReading(l.id)
    const r = await resolveMapLink(text)
    setReading(null)
    if (r.error) return toast(r.error, 'warn')
    setPaste((p) => ({ ...p, [l.id]: `${r.lat.toFixed(6)}, ${r.lng.toFixed(6)}` }))
    toast('📍 Location read from the link. Check the map, then save.')
  }
  const onType = (l, v) => {
    setPaste((p) => ({ ...p, [l.id]: v }))
    if (isShort(v) && !parsePin(v) && reading !== l.id && /\S{25,}/.test(v)) readLink(l, v)
  }

  const withPin = hotels.filter((l) => stateOf(l) === 'pinned').length
  const nNeed = hotels.filter((l) => stateOf(l) === 'need').length
  const nClosed = hotels.filter((l) => stateOf(l) === 'closed').length
  const live = withPin + nNeed // closed hotels are not counted against you
  const pct = live ? Math.round((withPin / live) * 100) : 100
  const inTab = (l) => tab === 'all' || stateOf(l) === ({ missing: 'need', done: 'pinned', closed: 'closed' })[tab]
  const areas = useMemo(() => {
    const m = new Map()
    hotels.filter(inTab).forEach((l) => { const a = (l.area || '').trim() || '(no area)'; m.set(a, (m.get(a) || 0) + 1) })
    return [...m].sort((a, b) => b[1] - a[1])
  }, [hotels, tab])
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return hotels.filter((l) => inTab(l) && (why === 'all' || reasonsOf(l.stopReason).includes(why))
      && (area === 'all' || ((l.area || '').trim() || '(no area)') === area)
      && (!s || `${l.name} ${l.phone} ${l.area}`.toLowerCase().includes(s))).sort((a, b) => (a.area || '~').localeCompare(b.area || '~') || a.name.localeCompare(b.name))
  }, [hotels, tab, area, q, why])

  const pin = (l, p, note = '') => {
    if (!inChennai(p)) return toast('That point is outside Chennai. Check the link.', 'warn')
    const lat = p.lat.toFixed(6), lng = p.lng.toFixed(6)
    saveLead({ ...l, lat, lng, mapUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` })
    setCands((c) => { const n = { ...c }; delete n[l.id]; return n })
    setPaste((c) => { const n = { ...c }; delete n[l.id]; return n })
    toast(`📍 Pin saved for ${l.name}${note}`)
  }

  const markClosed = (l) => {
    saveLead({ ...l, status: 'Not Interested', lastOutcome: 'Hotel Closed', stopReason: /closed/i.test(l.stopReason || '') ? l.stopReason : [l.stopReason, 'Closed'].filter(Boolean).join(' / ') })
    toast(`🏚️ ${l.name} marked closed. No pin needed.`)
  }
  const reopen = (l) => {
    const stopReason = String(l.stopReason || '').split(/\s*\/\s*/).filter((x) => !/^closed$/i.test(x)).join(' / ')
    saveLead({ ...l, status: 'Contacted', lastOutcome: l.lastOutcome === 'Hotel Closed' ? 'Revisit Needed' : l.lastOutcome, stopReason })
    toast(`${l.name} is open again`)
  }

  const find = async (l, quiet = false) => {
    setBusy(l.id)
    try {
      const r = await findPlaces(l)
      setCands((c) => ({ ...c, [l.id]: r }))
      if (!quiet) { setOpen(l.id); toast(r.length ? `Found ${r.length} possible match${r.length > 1 ? 'es' : ''}. Check the map, then tap Use.` : 'Not found on OpenStreetMap. Use Google Maps and paste the link.', r.length ? 'ok' : 'warn') }
      return r
    } catch (e) {
      if (!quiet) toast(`Auto-find failed: ${e.message || 'no internet'}`, 'warn')
      return null
    } finally { setBusy(null) }
  }

  const findAll = async () => {
    const todo = list.filter((l) => stateOf(l) === 'need' && !cands[l.id])
    if (!todo.length) return toast('Nothing to search in this list', 'warn')
    stop.current = false
    setBatch({ done: 0, total: todo.length })
    for (let i = 0; i < todo.length; i++) {
      if (stop.current) break
      const r = await find(todo[i], true)
      setBatch({ done: i + 1, total: todo.length })
      if (r === null) { await sleep(2500) } else await sleep(1100) // be polite to the free service
    }
    setBatch(null)
    toast('Auto-find finished. Review the green suggestions and accept them.')
  }

  // suggestions that sit close to the area centre are the safe ones to accept in one go
  const safe = hotels.filter((l) => stateOf(l) === 'need' && cands[l.id]?.[0] && cands[l.id][0].d != null && cands[l.id][0].d <= 4)
  const acceptSafe = () => { safe.forEach((l) => pin(l, cands[l.id][0])); toast(`✅ ${safe.length} pins saved`) }

  const applyBulk = async () => {
    let ok = 0, bad = 0
    const byName = new Map(hotels.map((l) => [l.name.trim().toLowerCase(), l]))
    const byPhone = new Map(hotels.filter((l) => l.phone).map((l) => [String(l.phone).replace(/\D/g, '').slice(-10), l]))
    for (const row of bulk.split('\n').map((r) => r.trim()).filter(Boolean)) {
      // first cell = hotel name or phone (may be quoted); everything after it = the location
      let first, tail
      const qm = row.match(/^"((?:[^"]|"")*)"\s*[,\t]?(.*)$/)
      if (qm) { first = qm[1].replace(/""/g, '"'); tail = qm[2] } else { const i = row.search(/[,\t]/); first = i < 0 ? row : row.slice(0, i); tail = i < 0 ? '' : row.slice(i + 1) }
      first = first.trim()
      const l = byName.get(first.toLowerCase()) || (first.replace(/\D/g, '').length >= 10 ? byPhone.get(first.replace(/\D/g, '').slice(-10)) : null)
      const m = tail.match(/(-?\d{1,2}\.\d{3,})\s*[,;\s]\s*(-?\d{2,3}\.\d{3,})/)
      let p = parsePin(tail.replace(/^"|"$/g, '')) || coordsFromLink(tail) || (m ? { lat: +m[1], lng: +m[2] } : null)
      if (!p && l && isShort(tail)) { const r = await resolveMapLink(tail); if (!r.error) p = r }
      if (l && p && inChennai(p)) { pin(l, p); ok++ } else bad++
    }
    toast(`${ok} pin${ok === 1 ? '' : 's'} saved${bad ? ` · ${bad} row${bad === 1 ? '' : 's'} not matched` : ''}`, bad && !ok ? 'warn' : 'ok')
    if (ok) setBulk('')
  }

  const exportMissing = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = [['hotel name', 'area', 'phone', 'google maps search link', 'paste lat,lng or maps link here'], ...hotels.filter((l) => stateOf(l) === 'need').map((l) => [l.name, l.area || '', l.phone || '', gSearch(l), ''])]
    download('hotels-need-location.csv', '\ufeff' + rows.map((r) => r.map(esc).join(',')).join('\n'), 'text/csv')
    toast('Downloaded. Fill the last column, then paste the rows in Bulk paste.')
  }

  const C = 2 * Math.PI * 34
  return (
    <div className="page adm lc">
      <div className="page-h">
        <h1>Hotel locations</h1>
        <button className="btn-soft sm" onClick={() => go('hotels')}>← Hotels</button>
      </div>

      <section className="card lc-hero">
        <div className="lc-ring">
          <svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" className="bg" /><motion.circle cx="40" cy="40" r="34" className="fg" strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - pct / 100) }} transition={{ duration: 0.8 }} /></svg>
          <b>{pct}%</b>
        </div>
        <div className="lc-hero-t">
          <h3>{withPin} of {live} hotels have an exact location</h3>
          <p>{nNeed ? `${nNeed} still use the area centre, so “nearest first” is only approximate for them.` : 'Every open hotel is pinned. Navigation is exact.'}{nClosed ? ` ${nClosed} closed hotel${nClosed > 1 ? 's are' : ' is'} skipped.` : ''}</p>
        </div>
        <div className="lc-stats">
          <button className={tab === 'done' ? 'on' : ''} onClick={() => { setTab('done'); setArea('all') }}><b>{withPin}</b><span>✅ Exact pin</span></button>
          <button className={`need ${tab === 'missing' ? 'on' : ''}`} onClick={() => { setTab('missing'); setArea('all') }}><b>{nNeed}</b><span>⚠️ Need pin</span></button>
          <button className={`shut ${tab === 'closed' ? 'on' : ''}`} onClick={() => { setTab('closed'); setArea('all') }}><b>{nClosed}</b><span>🏚️ Closed · skip</span></button>
        </div>
        <div className="lc-hero-b">
          {batch
            ? <button className="btn-soft" onClick={() => { stop.current = true }}>⏹ Stop · {batch.done}/{batch.total}</button>
            : <button className="btn3d lime" onClick={findAll}>✨ Auto-find {list.filter((l) => stateOf(l) === 'need').length || ''} in this list</button>}
          <button className="btn-soft" onClick={() => setShowBulk((s) => !s)}>📋 Bulk paste</button>
          <button className="btn-soft" onClick={exportMissing}><Icon name="download" size={16} /> Missing list</button>
        </div>
        {batch && <div className="lc-prog"><i style={{ width: `${(batch.done / batch.total) * 100}%` }} /></div>}
        {safe.length > 0 && <button className="lc-safe" onClick={acceptSafe}>✅ Accept {safe.length} suggestion{safe.length > 1 ? 's' : ''} that sit within 4 km of the area centre</button>}
      </section>

      {showBulk && (
        <motion.section className="card lc-bulk" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
          <h4>Bulk paste</h4>
          <p>One hotel per line: <b>hotel name or phone, then lat,lng or a Google Maps link</b>. Short Google links are read automatically. Works straight from Excel or the missing-list CSV.</p>
          <textarea rows={5} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={'Hotel Saravana, 13.1143, 80.1548\n9876543210, https://www.google.com/maps/@13.04,80.23,17z'} />
          <button className="btn3d" disabled={!bulk.trim() || bulkBusy} onClick={async () => { setBulkBusy(true); await applyBulk(); setBulkBusy(false) }}>{bulkBusy ? 'Reading links…' : 'Save pins'}</button>
        </motion.section>
      )}

      <div className="fp-tabs" role="tablist">
        {[['missing', 'Need pin', nNeed], ['done', 'Pinned', withPin], ['closed', 'Closed', nClosed], ['all', 'All', hotels.length]].map(([id, t, n]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => { setTab(id); setArea('all'); setWhy('all') }}>{t}<b>{n}</b></button>
        ))}
      </div>
      <div className="search"><Icon name="search" size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search hotel, phone, area…" />{q && <button onClick={() => setQ('')}><Icon name="x" size={16} /></button>}</div>
      <div className="chips scroll">
        <button className={`chip ${area === 'all' ? 'on' : ''}`} onClick={() => setArea('all')}>All areas</button>
        {areas.map(([a, n]) => <button key={a} className={`chip ${area === a ? 'on' : ''}`} onClick={() => setArea(area === a ? 'all' : a)}>{a} <b>{n}</b></button>)}
      </div>

      <div className="chips scroll lc-why">
        <span className="lc-why-l">Why they stopped:</span>
        <button className={`chip ${why === 'all' ? 'on' : ''}`} onClick={() => setWhy('all')}>All</button>
        {REASONS.filter((r) => hotels.some((l) => inTab(l) && reasonsOf(l.stopReason).includes(r.id))).map((r) => (
          <button key={r.id} className={`chip ${why === r.id ? 'on' : ''}`} onClick={() => setWhy(why === r.id ? 'all' : r.id)}>{r.icon} {r.label} <b>{hotels.filter((l) => inTab(l) && reasonsOf(l.stopReason).includes(r.id)).length}</b></button>
        ))}
      </div>

      {list.slice(0, 60).map((l) => {
        const cur = hotelPoint(l)
        const st = stateOf(l)
        const cs = cands[l.id]
        const top = !cur && cs?.[0]
        const typed = paste[l.id] ?? ''
        const parsed = parsePin(typed)
        const isOpen = open === l.id
        return (
          <section key={l.id} className={`card lc-card ${st}`}>
            <div className="lc-top" onClick={() => setOpen(isOpen ? null : l.id)}>
              <div className="lc-name"><b>{l.name}</b><small>📍 {l.area || 'Area not given'}{l.phone ? ` · ${l.phone}` : ''}</small></div>
              <span className={`lc-st ${st}`}>{st === 'pinned' ? '✅ Exact pin' : st === 'closed' ? '🏚️ Closed · no pin needed' : '≈ Area only'}</span>
            </div>

            <WhyBox lead={l} compact tip={false} ask={false} />
            {(l.lastOutcome || l.lastRemark) && <p className="lc-last"><b>Last visit:</b> {[l.lastOutcome, l.lastRemark].filter(Boolean).join(' · ')}</p>}
            {st === 'closed' && <p className="lc-shut">This hotel is closed, so you do not need to add a map location.</p>}

            {top && st === 'need' && !isOpen && (
              <div className="lc-sug">
                <div><small>Suggested by OpenStreetMap</small><b>{top.title}</b><span>{top.addr}{top.d != null ? ` · ${fmtKm(top.d)} from area centre` : ''}</span></div>
                <button className="btn-soft sm" onClick={() => setOpen(l.id)}>Check</button>
                <button className="btn3d sm" onClick={() => pin(l, top)}>Use</button>
              </div>
            )}
            {cs && !cs.length && !isOpen && <p className="lc-none">Not on OpenStreetMap. Use Google Maps below.</p>}

            {st === 'closed' ? (
              <div className="lc-act two">
                <button className="hr-b main" onClick={() => reopen(l)}>↩ Hotel is open</button>
                <button className="hr-b" onClick={() => setOpen(isOpen ? null : l.id)}>{isOpen ? 'Close' : '✏️ Add pin anyway'}</button>
              </div>
            ) : (
              <>
                <div className="lc-act">
                  <button className="hr-b main" disabled={busy === l.id} onClick={() => find(l)}>{busy === l.id ? 'Searching…' : '🔎 Auto-find'}</button>
                  <a className="hr-b" href={gSearch(l)} target="_blank" rel="noreferrer">🗺 Google Maps ↗</a>
                  <button className="hr-b" onClick={() => setOpen(isOpen ? null : l.id)}>{isOpen ? 'Close' : '✏️ Enter pin'}</button>
                </div>
                {st === 'need' && <button type="button" className="lc-closebtn" onClick={() => markClosed(l)}>🏚️ This hotel is closed. No pin needed</button>}
              </>
            )}

            <div className="lc-admin">
              <button type="button" className={l.area ? '' : 'need'} onClick={() => setEditing(l)}>{l.area ? '✏️ Edit hotel · remark · area' : '➕ Add area · edit hotel'}</button>
              {delId === l.id
                ? <span className="lc-delq">Delete {l.name}? <button type="button" onClick={() => setDelId(null)}>Keep</button><button type="button" className="red" onClick={() => { removeLead(l.id); setDelId(null); toast(`🗑 ${l.name} deleted`) }}>Delete</button></span>
                : <button type="button" className="red" onClick={() => setDelId(l.id)}>🗑 Delete</button>}
            </div>

            {isOpen && (
              <div className="lc-edit">
                {cs?.length > 0 && !cur && (
                  <>
                    <h5>Matches found (nearest to the area first)</h5>
                    {cs.map((c, i) => (
                      <div key={i} className="lc-cand">
                        <div><b>{c.title}</b><small>{c.addr}</small></div>
                        <span>{c.d != null ? fmtKm(c.d) : ''}</span>
                        <button className="btn-soft sm" onClick={() => setPaste((p) => ({ ...p, [l.id]: `${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}` }))}>Preview</button>
                        <button className="btn3d sm" onClick={() => pin(l, c)}>Use</button>
                      </div>
                    ))}
                  </>
                )}
                <h5>{cur ? 'Change the pin' : 'Paste the exact location'}</h5>
                <ol className="lc-how">
                  <li>Tap <b>Google Maps ↗</b> and open the right hotel.</li>
                  <li>Tap <b>Share → Copy link</b> (or long-press the pin and copy the numbers).</li>
                  <li>Paste it here. Short links are read for you and the map confirms it before you save.</li>
                </ol>
                <input value={typed} onChange={(e) => onType(l, e.target.value)} placeholder="Paste the Google Maps link (short links work) or 13.0418, 80.2341" />
                {reading === l.id && <p className="lc-ok">⏳ Reading the link…</p>}
                {typed && !parsed && reading !== l.id && (isShort(typed)
                  ? <button type="button" className="btn-soft" onClick={() => readLink(l, typed)}>🔗 Read this short link</button>
                  : <p className="lc-err">No coordinates found in this text.</p>)}
                {parsed && (
                  <>
                    <div className="lc-prev"><iframe title="Preview" src={embed(parsed)} loading="lazy" /></div>
                    <p className="lc-ok">📍 {parsed.lat.toFixed(5)}, {parsed.lng.toFixed(5)}{areaInfo(l.area) ? ` · ${fmtKm(km(areaInfo(l.area), parsed))} from ${l.area} centre` : ''}</p>
                    <button className="btn3d big" onClick={() => pin(l, parsed)}><Icon name="check" /> Save this pin</button>
                  </>
                )}
                {cur && <div className="lc-prev"><iframe title="Current pin" src={embed(cur)} loading="lazy" /></div>}
              </div>
            )}
          </section>
        )
      })}
      {list.length > 60 && <p className="mini-note">Showing 60 of {list.length}. Filter by area to see the rest.</p>}
      {!list.length && <div className="card empty"><div className="empty-ico">{tab === 'missing' ? '🎉' : '🔎'}</div><h3>{tab === 'missing' ? 'Every open hotel here has an exact pin' : 'Nothing matches'}</h3></div>}
      {editing && <AdminHotelEditor key={editing.id} lead={editing} onClose={() => setEditing(null)} />}
      <p className="mini-note">Auto-find uses OpenStreetMap, which does not list every small hotel. Always check the map before you accept. Google Maps itself cannot be scraped, so use the Google Maps button and paste the link (short links are read for you).</p>
    </div>
  )
}
