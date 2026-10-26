import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../store'
import { Icon, Sheet } from '../ui'
import { areaInfo } from '../chennai'
import { ADMIN_CONTACT } from '../constants'
import { ago } from '../analytics'
import { fmtKm, hotelPoint, km, mapDirections } from '../utils'
import { accLabel, bestFix, embedAt, findHotelPlaces, gSearchUrl, inChennai, isShortLink, parsePin, searchPlaces, srcOf } from '../location'

const TABS = [
  { id: 'gps', ico: '📡', t: 'I’m here', s: 'Use GPS' },
  { id: 'online', ico: '🔎', t: 'Find online', s: 'Search maps' },
  { id: 'link', ico: '🔗', t: 'Paste link', s: 'Google Maps' },
]

/** the three ways to give a hotel an exact location */
export default function LocationSheet({ lead, initialTab = 'gps', onClose, onSaved }) {
  const { saveLocation, toast } = useApp()
  const cur = hotelPoint(lead)
  const [tab, setTab] = useState(initialTab)
  const [saved, setSaved] = useState(null)

  const commit = (p, source, acc = 0) => {
    if (!inChennai(p)) return toast('That point is outside Chennai. Check it and try again.', 'warn')
    saveLocation(lead, p, source, acc)
    navigator.vibrate?.(40)
    setSaved({ p, updated: !!cur })
    onSaved?.()
  }

  const who = lead.locBy ? `${lead.locBy}${lead.locAt ? ` · ${ago(lead.locAt)}` : ''}` : ''
  const src = srcOf(lead)
  const area = [lead.area, 'Chennai'].filter(Boolean).join(' · ')

  if (saved) {
    return (
      <Sheet onClose={onClose}>
        <div className="ls ls-done">
          <motion.div className="ls-check" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }}><Icon name="check" size={40} /></motion.div>
          <h2>{saved.updated ? 'Location updated' : 'Location saved'}</h2>
          <p><b>{lead.name}</b> now has an exact map pin. The map is unlocked for you, and HR can see who added it.</p>
          <div className="ls-map ls-map-s"><iframe title="Saved location" src={embedAt(saved.p)} loading="lazy" /></div>
          <div className="ls-actions">
            <a className="ls-btn blue" href={mapDirections({ lat: String(saved.p.lat), lng: String(saved.p.lng) })} target="_blank" rel="noreferrer"><Icon name="send" size={18} /> Navigate here</a>
            <button type="button" className="ls-btn ghost" onClick={onClose}>Done</button>
          </div>
        </div>
      </Sheet>
    )
  }

  const adminNum = String(ADMIN_CONTACT || '').replace(/\D/g, '')
  const msg = `Hi, I could not find the exact map location of "${lead.name}"${lead.area ? ` (${lead.area})` : ''}, Chennai. Please add it from HR → Locations.`

  return (
    <Sheet onClose={onClose}>
      <div className="ls">
        <header className="ls-head">
          <span className="ls-pin">{cur ? '📍' : '🧭'}</span>
          <div>
            <small>{cur ? 'Update location' : 'Add location'}</small>
            <h2>{lead.name}</h2>
            <p>{area}</p>
          </div>
          <button type="button" className="ls-x" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </header>

        <div className={`ls-state ${cur ? 'ok' : 'none'}`}>
          {cur
            ? <><i>✅</i><div><b>Has an exact pin</b><small>{src ? `${src.icon} ${src.label}` : 'Added by HR'}{who ? ` · ${who}` : ''}{lead.locAcc ? ` · ±${lead.locAcc} m` : ''}. Update it only if it is wrong.</small></div></>
            : <><i>⚠️</i><div><b>No exact pin yet</b><small>The map shows the middle of {lead.area || 'the area'}. Add the real spot so Navigate takes you to the door.</small></div></>}
        </div>

        <div className="ls-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
              {tab === t.id && <motion.span layoutId="ls-tab" className="ls-tab-bg" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
              <em>{t.ico}</em><b>{t.t}</b><small>{t.s}</small>
            </button>
          ))}
        </div>

        <div className="ls-body">
          {tab === 'gps' && <GpsPanel lead={lead} cur={cur} onSave={commit} />}
          {tab === 'online' && <OnlinePanel lead={lead} cur={cur} onSave={commit} goLink={() => setTab('link')} />}
          {tab === 'link' && <LinkPanel lead={lead} cur={cur} onSave={commit} />}
        </div>

        <div className="ls-ask">
          <span>Cannot do it now?</span>
          {adminNum && <a href={`tel:+${adminNum}`}><Icon name="phone" size={15} /> Call admin</a>}
          <a href={`https://wa.me/${adminNum}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"><Icon name="whatsapp" size={15} /> Ask admin</a>
        </div>
      </div>
    </Sheet>
  )
}

/* ---------- 1. I am at the hotel: GPS ---------- */
function GpsPanel({ lead, cur, onSave }) {
  const [st, setSt] = useState('idle') // idle | busy | got | err
  const [fix, setFix] = useState(null)
  const [err, setErr] = useState('')
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const centre = areaInfo(lead.area)

  const run = async () => {
    setSt('busy'); setErr(''); setFix(null)
    try {
      const f = await bestFix({ ms: 11000, good: 12, onUpdate: (b) => alive.current && setFix(b) })
      if (!alive.current) return
      setFix(f); setSt('got')
    } catch (e) {
      if (!alive.current) return
      setErr(e?.message || 'Could not read your location'); setSt('err')
    }
  }

  if (st === 'idle' || st === 'err') {
    return (
      <div className="ls-gps">
        <div className="ls-radar idle"><i /><i /><span>📡</span></div>
        <h3>Standing at the hotel right now?</h3>
        <p>Stop at the hotel entrance, then tap the button. Your phone’s GPS becomes the hotel’s exact location.</p>
        {st === 'err' && <p className="ls-err">⚠️ {err}</p>}
        <button type="button" className="ls-btn lime big" onClick={run}><Icon name="target" size={20} /> {st === 'err' ? 'Try again' : 'Use my current location'}</button>
        <small className="ls-fine">Only do this at the hotel. A wrong pin sends the next person to the wrong place.</small>
      </div>
    )
  }

  if (st === 'busy') {
    const a = fix ? Math.round(fix.acc) : null
    return (
      <div className="ls-gps">
        <div className="ls-radar"><i /><i /><i /><span>📡</span></div>
        <h3>Finding your exact spot…</h3>
        <p>{a == null ? 'Waiting for the GPS signal. Stay still near the entrance.' : `Accuracy ±${a} m. Getting sharper…`}</p>
        <div className="ls-acc"><motion.i animate={{ width: a == null ? '8%' : `${Math.max(12, Math.min(100, 100 - a))}%` }} /></div>
      </div>
    )
  }

  // got a reading
  const lab = accLabel(fix.acc)
  const dCur = cur ? km(fix, cur) : null
  const dCentre = centre ? km(fix, centre) : null
  const weak = fix.acc > 150
  return (
    <div className="ls-gps got">
      <div className="ls-map"><iframe title="Your spot" src={embedAt(fix)} loading="lazy" /></div>
      <div className="ls-facts">
        <div className="ls-fact" style={{ '--c': lab.c }}><i>🎯</i><b>±{Math.round(fix.acc)} m</b><small>{lab.t} accuracy</small></div>
        {dCur != null
          ? <div className={`ls-fact ${dCur > 0.3 ? 'warn' : ''}`}><i>📏</i><b>{fmtKm(dCur)}</b><small>from current pin</small></div>
          : dCentre != null && <div className={`ls-fact ${dCentre > 8 ? 'warn' : ''}`}><i>🗺</i><b>{fmtKm(dCentre)}</b><small>from {lead.area} centre</small></div>}
      </div>
      {dCur != null && dCur > 0.3 && <p className="ls-note warn">You are {fmtKm(dCur)} away from the current pin. Update only if you are really at the hotel.</p>}
      {dCur == null && dCentre != null && dCentre > 8 && <p className="ls-note warn">This is far from {lead.area}. Check that you are at the right hotel.</p>}
      {weak && <p className="ls-note warn">GPS signal is weak. Step outside or near a window and try again.</p>}
      <button type="button" className="ls-btn lime big" disabled={weak} onClick={() => onSave(fix, 'gps', fix.acc)}><Icon name="check" size={20} /> Save as hotel location</button>
      <button type="button" className="ls-btn ghost" onClick={run}>Read again</button>
    </div>
  )
}

/* ---------- 2. Find it online ---------- */
function OnlinePanel({ lead, cur, onSave, goLink }) {
  const [q, setQ] = useState([lead.name, lead.area].filter(Boolean).join(' '))
  const [res, setRes] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [pick, setPick] = useState(0)
  const first = useRef(true)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  const run = async (auto = false) => {
    setBusy(true); setMsg('')
    try {
      const r = auto && q === [lead.name, lead.area].filter(Boolean).join(' ')
        ? await findHotelPlaces(lead)
        : await searchPlaces([`${q}, Chennai`], { area: lead.area })
      if (!alive.current) return
      setRes(r); setPick(0)
      if (!r.length) setMsg('Nothing found. Try the hotel’s short name, or search on Google Maps and paste the link.')
    } catch (e) {
      if (!alive.current) return
      setRes([]); setMsg(navigator.onLine === false ? 'You are offline. Connect to the internet and try again.' : `Search failed (${String(e.message || e).slice(0, 40)}). Try again in a moment.`)
    } finally { if (alive.current) setBusy(false) }
  }
  useEffect(() => { if (first.current) { first.current = false; run(true) } }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const chosen = res?.[pick]
  return (
    <div className="ls-online">
      <form className="ls-search" onSubmit={(e) => { e.preventDefault(); run(false) }}>
        <Icon name="search" size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Hotel name and area" enterKeyHint="search" />
        <button type="submit" disabled={busy || !q.trim()}>{busy ? '…' : 'Search'}</button>
      </form>

      {busy && <div className="ls-skel"><i /><i /><i /></div>}
      {!busy && msg && <p className="ls-note">{msg}</p>}

      {!busy && res?.length > 0 && (
        <>
          <p className="ls-cap">Tap the right place, check the map, then save</p>
          <div className="ls-res">
            {res.map((r, i) => (
              <button key={`${r.lat}-${r.lng}-${i}`} type="button" className={`ls-r ${pick === i ? 'on' : ''}`} onClick={() => setPick(i)}>
                <i>{pick === i ? '◉' : '○'}</i>
                <span><b>{r.title}</b><small>{r.addr}</small></span>
                {r.d != null && <em>{fmtKm(r.d)}</em>}
              </button>
            ))}
          </div>
          {chosen && (
            <>
              <div className="ls-map"><iframe title="Chosen place" src={embedAt(chosen)} loading="lazy" /></div>
              {cur && <p className="ls-note">This is {fmtKm(km(chosen, cur))} from the current pin.</p>}
              <button type="button" className="ls-btn lime big" onClick={() => onSave(chosen, 'search', 0)}><Icon name="check" size={20} /> Use this location</button>
            </>
          )}
        </>
      )}

      <div className="ls-alt">
        <span>Not on this list? Small hotels are often missing.</span>
        <a href={gSearchUrl(lead)} target="_blank" rel="noreferrer">🗺 Search on Google Maps ↗</a>
        <button type="button" onClick={goLink}>Then paste the link →</button>
      </div>
    </div>
  )
}

/* ---------- 3. Paste a Google Maps link or the numbers ---------- */
function LinkPanel({ lead, cur, onSave }) {
  const { resolveMapLink, toast } = useApp()
  const [text, setText] = useState('')
  const [reading, setReading] = useState(false)
  const parsed = parsePin(text)

  const read = async (t) => {
    setReading(true)
    const r = await resolveMapLink(t)
    setReading(false)
    if (r.error) return toast(r.error, 'warn')
    setText(`${r.lat.toFixed(6)}, ${r.lng.toFixed(6)}`)
    toast('📍 Location read from the link. Check the map, then save.')
  }
  const onType = (v) => {
    setText(v)
    if (isShortLink(v) && !parsePin(v) && !reading && /\S{25,}/.test(v)) read(v)
  }
  const fromClip = async () => {
    try { const t = await navigator.clipboard.readText(); if (!t) return toast('Nothing copied yet', 'warn'); onType(t.trim()) } catch { toast('Long-press the box and choose Paste', 'warn') }
  }

  return (
    <div className="ls-link">
      <ol className="ls-how">
        <li><i>1</i><span>Open <a href={gSearchUrl(lead)} target="_blank" rel="noreferrer">Google Maps ↗</a> and find the hotel</span></li>
        <li><i>2</i><span>Tap <b>Share → Copy link</b></span></li>
        <li><i>3</i><span>Come back and paste it below</span></li>
      </ol>
      <div className="ls-paste">
        <input value={text} onChange={(e) => onType(e.target.value)} placeholder="Paste the link or 13.0418, 80.2341" inputMode="url" autoComplete="off" />
        <button type="button" onClick={fromClip}>📋 Paste</button>
      </div>
      {reading && <p className="ls-note">⏳ Reading the link…</p>}
      {text && !parsed && !reading && (isShortLink(text)
        ? <button type="button" className="ls-btn ghost" onClick={() => read(text)}>🔗 Read this short link</button>
        : <p className="ls-note err">No location found in this text. Copy the link again from Google Maps.</p>)}
      {parsed && (
        <>
          <div className="ls-map"><iframe title="Pasted location" src={embedAt(parsed)} loading="lazy" /></div>
          <p className="ls-note ok">📍 {parsed.lat.toFixed(5)}, {parsed.lng.toFixed(5)}{cur ? ` · ${fmtKm(km(parsed, cur))} from the current pin` : ''}</p>
          <button type="button" className="ls-btn lime big" onClick={() => onSave(parsed, 'link', 0)}><Icon name="check" size={20} /> Save this location</button>
        </>
      )}
    </div>
  )
}
