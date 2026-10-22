import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useApp } from '../store'
import { Confetti, Icon } from '../ui'
import { RATING_LABEL, Stars, StarsRO, ratingToPriority } from './Stars'
import { useGeo } from '../useGeo'
import { etaMin, fmtEta, planRoute, pointOf } from '../chennai'
import { atDay, fmtKm, fmtWhen, fromLocalInput, km, mapDirections, mapEmbed, mapOpen, nameOf, telHref, toLocalInput, waHref } from '../utils'
import { OUTCOMES, QUICK_REMARKS } from '../constants'
import { REASON, REASONS, kgOf, reasonsOf } from '../cancelled'
import { WhyBox } from './ReasonChips'

const VISIT_OUTCOMES = ['Order Restarted', 'Will Order Soon', 'Interested', 'Revisit Needed', 'Visited', 'Owner Not Available', 'Hotel Closed', 'Not Interested']
const NEEDS_RATING = ['Order Restarted', 'Will Order Soon', 'Interested', 'Revisit Needed', 'Visited']
const DEFAULT_RATING = { 'Order Restarted': 5, 'Will Order Soon': 4, Interested: 4, 'Revisit Needed': 3, Visited: 3, 'Not Interested': 1 }
const suggestNext = (o) => ({ 'Will Order Soon': atDay(3, 11), Interested: atDay(2, 11), 'Revisit Needed': atDay(2, 11), Visited: atDay(3, 11), 'Owner Not Available': atDay(1, 11) }[o] || '')
const QUICK_NEXT = [['Tomorrow', () => atDay(1, 11)], ['In 2 days', () => atDay(2, 11)], ['In 3 days', () => atDay(3, 11)], ['Next week', () => atDay(7, 11)]]
const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))])

/* ---------- little route picture: you, then every stop in visiting order ---------- */
function RouteMap({ me, plan }) {
  const stops = plan.filter((s) => s.pt)
  const all = [...(me ? [me] : []), ...stops.map((s) => s.pt)]
  if (!all.length) return null
  const lats = all.map((p) => p.lat), lngs = all.map((p) => p.lng)
  const minLa = Math.min(...lats), maxLa = Math.max(...lats), minLn = Math.min(...lngs), maxLn = Math.max(...lngs)
  const sLa = Math.max(maxLa - minLa, 0.012), sLn = Math.max(maxLn - minLn, 0.012)
  const W = 340, H = 118, P = 20
  const X = (lng) => P + ((lng - minLn) / sLn) * (W - 2 * P)
  const Y = (lat) => H - P - ((lat - minLa) / sLa) * (H - 2 * P)
  const line = [...(me ? [me] : []), ...stops.map((s) => s.pt)].map((p) => `${X(p.lng).toFixed(1)},${Y(p.lat).toFixed(1)}`).join(' ')
  return (
    <div className="vm-route">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Your route">
        <defs>
          <pattern id="vmgrid" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0V22" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="1" /></pattern>
        </defs>
        <rect width={W} height={H} fill="url(#vmgrid)" />
        <polyline points={line} fill="none" stroke="rgba(212,232,58,.75)" strokeWidth="2.4" strokeDasharray="5 5" strokeLinecap="round" strokeLinejoin="round" />
        {stops.map((s, i) => {
          const cx = X(s.pt.lng), cy = Y(s.pt.lat), cur = i === 0
          return (
            <g key={s.l.id}>
              {cur && <circle cx={cx} cy={cy} r="9" fill="none" stroke="#d4e83a" strokeWidth="2"><animate attributeName="r" values="9;19" dur="1.6s" repeatCount="indefinite" /><animate attributeName="opacity" values=".9;0" dur="1.6s" repeatCount="indefinite" /></circle>}
              <circle cx={cx} cy={cy} r={cur ? 10 : 8} fill={cur ? '#d4e83a' : '#0f6b34'} stroke="#fff" strokeWidth="1.6" />
              <text x={cx} y={cy + 3.4} textAnchor="middle" fontSize="9.5" fontWeight="800" fill={cur ? '#06301a' : '#fff'}>{i + 1}</text>
            </g>
          )
        })}
        {me && (
          <g>
            <circle cx={X(me.lng)} cy={Y(me.lat)} r="8" fill="#3b82f6" opacity=".25"><animate attributeName="r" values="6;16" dur="1.8s" repeatCount="indefinite" /></circle>
            <circle cx={X(me.lng)} cy={Y(me.lat)} r="6" fill="#3b82f6" stroke="#fff" strokeWidth="2" />
          </g>
        )}
      </svg>
      <span className="vm-route-key"><i className="me" /> You <i className="st" /> Stops in order</span>
    </div>
  )
}

/* the few nearest hotels from a point: these are the "proper alignment" choices */
function nearest(origin, pool, exclude = []) {
  let list = pool.filter((l) => !exclude.includes(l.id))
  if (!list.length) list = pool
  if (!origin) return planRoute(null, list).map((x) => ({ l: x.l, pt: x.pt, d: null }))
  return list
    .map((l) => { const pt = pointOf(l); return { l, pt, d: pt ? km(origin, pt) : null } })
    .sort((a, b) => (a.d ?? 1e9) - (b.d ?? 1e9))
}

/* ---------- one hotel: why they stopped, the map, then the way there ---------- */
function StopCard({ lead, me, index, total }) {
  const pt = pointOf(lead)
  const d = me && pt ? km(me, pt) : null
  const here = d != null && !pt.approx && d < 0.15
  const share = `📍 ${lead.name}\n${[lead.address, lead.area].filter(Boolean).join(', ')}\n${mapOpen(lead)}`

  return (
    <motion.div className="vm-card" initial={{ opacity: 0, x: 70, scale: 0.97 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -70, scale: 0.97 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
      <div className="vm-head2">
        <span className="vm-step">Stop {index} of {total}</span>
        <h2>{lead.name}</h2>
        <p>📍 {[lead.area, 'Chennai'].filter(Boolean).join(' · ')}</p>
        <div className="vm-chips">
          {d != null && <span className="big">📏 {fmtKm(d)} · ~{fmtEta(etaMin(d))}</span>}
          {pt?.approx && <span>≈ area centre</span>}
          {lead.rating > 0 && <span><StarsRO value={Number(lead.rating)} size={11} /> last visit</span>}
          {here && <span className="here">📍 You are here</span>}
        </div>
      </div>

      <div className="vm-sec">
        <WhyBox lead={lead} />
      </div>

      <div className="vm-map">
        <iframe title={`Map of ${lead.name}`} src={mapEmbed(lead)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        <div className="mp-offline">Map needs internet. Use <b>Navigate</b> below.</div>
      </div>

      <div className="vm-actions first">
        <motion.a whileTap={{ scale: 0.95 }} className="go" href={mapDirections(lead)} target="_blank" rel="noreferrer"><Icon name="send" /> Navigate</motion.a>
        {lead.phone && <motion.a whileTap={{ scale: 0.95 }} href={telHref(lead.phone)}><Icon name="phone" /> Call</motion.a>}
        {lead.phone && <motion.a whileTap={{ scale: 0.95 }} href={waHref(lead.phone)} target="_blank" rel="noreferrer"><Icon name="whatsapp" /> Chat</motion.a>}
        <motion.a whileTap={{ scale: 0.95 }} href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noreferrer"><Icon name="copy" /> Share pin</motion.a>
      </div>

      <div className="vm-info">
        {(lead.address || lead.area) && <p><Icon name="pin" size={16} /> {lead.address || lead.area}</p>}
        {(lead.contactName || lead.phone) && (
          <p><Icon name="phone" size={16} /> {lead.contactName ? <b>{lead.contactName}</b> : null}{lead.contactName && lead.phone ? ' · ' : ''}{lead.phone ? <a href={telHref(lead.phone)}>{lead.phone}</a> : null}</p>
        )}
        {!lead.phone && !lead.contactName && <p className="mp-muted">No contact number yet. Ask for the owner or manager and add it with Edit.</p>}
        {lead.lastRemark && <p className="mp-muted"><b>Last time:</b> {lead.lastOutcome ? `${lead.lastOutcome} · ` : ''}{lead.lastRemark}</p>}
      </div>
    </motion.div>
  )
}

/* ---------- the remark: outcome, what they said, why they stopped, next follow-up ---------- */
const OUTCOME_GROUPS = [
  ['👍 Good news', ['Order Restarted', 'Will Order Soon', 'Interested']],
  ['🔁 Needs another visit', ['Revisit Needed', 'Visited', 'Owner Not Available']],
  ['🚫 Closed for now', ['Hotel Closed', 'Not Interested']],
]
const FOLLOW_REQ = ['Will Order Soon', 'Interested', 'Revisit Needed', 'Visited', 'Owner Not Available']
const NO_FOLLOW = ['Order Restarted', 'Hotel Closed', 'Not Interested']
const NO_RATING = ['Hotel Closed', 'Owner Not Available']

export function RemarkSheet({ lead, reached, last, busy, onSave, onBack, quick = false, fixed = false }) {
  const { toast } = useApp()
  const [outcome, setOutcome] = useState('')
  const [rating, setRating] = useState(0)
  const [manual, setManual] = useState(false)
  const [remark, setRemark] = useState('')
  const [next, setNext] = useState('')
  const startReasons = reasonsOf(lead.stopReason).filter((x) => x !== 'none' && x !== 'other')
  const [why, setWhy] = useState(startReasons)
  const [kg, setKg] = useState(kgOf(lead) ? String(kgOf(lead)) : '')
  const pt = pointOf(lead)
  const canPin = !!(reached?.pos && pt?.approx && !quick)
  const [pinMe, setPinMe] = useState(true)
  const d = reached?.dist
  const remarks = QUICK_REMARKS.hotel
  const toggleWhy = (id) => setWhy((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]))
  const needsNext = FOLLOW_REQ.includes(outcome)
  const showNext = outcome && !NO_FOLLOW.includes(outcome)

  const pick = (id) => {
    setOutcome(id)
    if (!manual) setRating(NO_RATING.includes(id) ? 0 : DEFAULT_RATING[id] || 0)
    setNext(suggestNext(id))
  }
  const toggleRemark = (r) => setRemark((cur) => (cur.includes(r) ? cur.replace(r, '').replace(/^[,\s]+|[,\s]+$/g, '').replace(/,\s*,/g, ',') : cur ? `${cur}, ${r}` : r))
  const save = () => {
    if (!outcome) return toast('Pick how the visit went first', 'warn')
    if (NEEDS_RATING.includes(outcome) && !rating) return toast('Give the interest a star rating ⭐', 'warn')
    if (needsNext && !next) return toast('Pick a follow-up so this hotel is not forgotten ⏰', 'warn')
    const note = [d != null && pt && !pt.approx ? `Checked in ${fmtKm(d)} from the pin` : '', remark.trim()].filter(Boolean).join(' · ')
    // what the person learned: the reason they stopped, and the KG they will order now
    const extra = {}
    if (why.join() !== startReasons.join()) extra.stopReason = why.map((id) => REASON[id].label).join(' / ')
    if (['Order Restarted', 'Will Order Soon'].includes(outcome) && kg && Number(kg) !== kgOf(lead)) extra.monthlyQty = String(Number(kg))
    if (canPin && pinMe) { extra.lat = reached.pos.lat.toFixed(6); extra.lng = reached.pos.lng.toFixed(6); extra.mapUrl = `https://www.google.com/maps/search/?api=1&query=${extra.lat},${extra.lng}` }
    onSave({ outcome, rating, remark: note, next, extra: Object.keys(extra).length ? extra : undefined })
  }
  const summary = outcome ? [outcome, rating && !NO_RATING.includes(outcome) ? `${rating}★` : '', showNext ? (next ? fmtWhen(next) : 'no follow-up') : ''].filter(Boolean).join(' · ') : 'Step 1: pick how it went'

  return (
    <motion.div className={`vm-sheet-ov ${fixed ? 'fixed' : ''}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={fixed ? onBack : undefined}>
      <motion.div className="vm-sheet" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 280, damping: 30 }} onClick={(e) => e.stopPropagation()}>
        <div className="vm-grab" />
        <div className="vm-sheet-h">
          <div>
            <b>{quick ? `✍️ ${lead.name}` : `✅ Reached ${lead.name}`}</b>
            <small>{quick ? 'Saved with today’s date and your name' : d != null && pt && !pt.approx ? (d < 0.25 ? `Checked in · at the hotel (${fmtKm(d)})` : `Checked in · ${fmtKm(d)} from the pin`) : 'Checked in'}</small>
          </div>
          <button type="button" className="vm-sheet-x" onClick={onBack} aria-label="Close"><Icon name="x" /></button>
        </div>

        <div className="vm-form">
          <WhyBox lead={lead} compact tip={false} />
          {canPin && (
            <label className="vm-pinme"><input type="checkbox" checked={pinMe} onChange={(e) => setPinMe(e.target.checked)} /><span><b>📍 Save this spot as the hotel’s map pin</b><small>This hotel has no exact location yet. Tick only if you are standing at the hotel.</small></span></label>
          )}

          <h4><i>1</i> How did it go?</h4>
          {OUTCOME_GROUPS.map(([g, ids]) => (
            <div key={g} className="vm-og">
              <small>{g}</small>
              <div className="vm-outcomes">
                {ids.map((id) => (
                  <motion.button type="button" key={id} whileTap={{ scale: 0.93 }} className={outcome === id ? 'on' : ''} onClick={() => pick(id)}>
                    <em>{OUTCOMES.find((o) => o.id === id)?.icon}</em>{id}
                  </motion.button>
                ))}
              </div>
            </div>
          ))}

          {outcome && !NO_RATING.includes(outcome) && (
            <>
              <h4><i>2</i> How interested are they?</h4>
              <div className="vm-rate">
                <Stars value={rating} size={40} onChange={(n) => { setRating(n); setManual(true) }} />
                <span className={`vm-rate-l r${rating}`}>{RATING_LABEL[rating]}</span>
              </div>
            </>
          )}

          {outcome && (
            <>
              <h4><i>{NO_RATING.includes(outcome) ? 2 : 3}</i> What did they say?</h4>
              <div className="chips small">
                {remarks.map((r) => <button type="button" key={r} className={`chip ${remark.includes(r) ? 'on' : ''}`} onClick={() => toggleRemark(r)}>{r}</button>)}
              </div>
              <textarea rows={2} value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Owner or chef said… (tap a chip or type)" />

              <h4>Why did they stop? <small>· tap to confirm or change</small></h4>
              <div className="chips small">
                {REASONS.filter((r) => r.id !== 'none' && r.id !== 'other').map((r) => (
                  <button type="button" key={r.id} className={`chip ${why.includes(r.id) ? 'on' : ''}`} onClick={() => toggleWhy(r.id)}>{r.icon} {r.label}</button>
                ))}
              </div>
            </>
          )}

          {['Order Restarted', 'Will Order Soon'].includes(outcome) && (
            <>
              <h4>KG they will order</h4>
              <input inputMode="numeric" value={kg} onChange={(e) => setKg(e.target.value.replace(/[^\d.]/g, ''))} placeholder="for example 10" />
            </>
          )}

          {showNext && (
            <>
              <h4><i>{NO_RATING.includes(outcome) ? 3 : 4}</i> When will you go back? {next && <small>· {fmtWhen(next)}</small>}</h4>
              <div className="chips small">
                {QUICK_NEXT.map(([l, f]) => <button type="button" key={l} className="chip" onClick={() => setNext(f())}>{l}</button>)}
                {!needsNext && <button type="button" className={`chip ${!next ? 'on' : ''}`} onClick={() => setNext('')}>None</button>}
              </div>
              <input type="datetime-local" value={toLocalInput(next)} onChange={(e) => setNext(fromLocalInput(e.target.value))} />
              {needsNext && !next && <p className="vm-warn">⏰ Pick a date so this hotel shows up in Follow-ups.</p>}
            </>
          )}
        </div>

        <div className="vm-sheet-foot">
          <small>{summary}</small>
          <motion.button whileTap={{ scale: 0.97, y: 3 }} className={`btn3d big ${outcome ? '' : 'off'}`} disabled={busy} onClick={save}>
            <Icon name="check" /> {outcome ? (quick ? 'Save remark' : last ? 'Save & finish' : 'Save & next hotel') : 'Pick what happened ↑'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ---------- pop-up 2: the next hotel, accept or choose another ---------- */
function NextSheet({ kind, options, fromLabel, waiting, onAccept, onFinish }) {
  const [sel, setSel] = useState(0)
  const pick = options[Math.min(sel, options.length - 1)]
  if (!pick) return null
  const title = kind === 'start' ? 'Nearest hotels to you' : kind === 'skip' ? 'Pick another hotel' : '✅ Saved! Next nearest hotel'
  const sub = kind === 'start' ? 'Start with the closest one' : `Distance from ${fromLabel || 'where you are'}`

  return (
    <motion.div className="vm-sheet-ov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="vm-sheet" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 280, damping: 30 }}>
        <div className="vm-grab" />
        <div className="vm-sheet-h"><div><b>{title}</b><small>{sub}</small></div></div>
        <div className="vm-opts">
          {options.map((o, i) => (
            <motion.button type="button" key={o.l.id} whileTap={{ scale: 0.97 }} className={`vm-opt ${sel === i ? 'on' : ''}`} onClick={() => setSel(i)}>
              <i>{i + 1}</i>
              <span className="vm-opt-t">
                <b>{o.l.name}</b>
                <small>{[o.l.area, o.pt?.approx ? '≈ area centre' : ''].filter(Boolean).join(' · ')}</small>
              </span>
              <span className="vm-opt-d">
                {o.d != null ? <><b>{fmtKm(o.d)}</b><small>~{fmtEta(etaMin(o.d))}</small></> : <small>no pin</small>}
                {i === 0 && <em>Nearest</em>}
              </span>
            </motion.button>
          ))}
        </div>
        {waiting > 0 && <small className="vm-more dark">+ {waiting} more hotel{waiting > 1 ? 's' : ''} after these</small>}
        <div className="vm-sheet-act">
          <a className="btn3d big lime" href={mapDirections(pick.l)} target="_blank" rel="noreferrer" onClick={() => onAccept(pick.l.id)}>
            <Icon name="send" /> Accept &amp; navigate
          </a>
          <button type="button" className="btn-soft" onClick={() => onAccept(pick.l.id)}>Accept, I will navigate myself</button>
          <button type="button" className="vm-skip" onClick={onFinish}>Not now · finish for today</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

/**
 * Full-screen visit run, one hotel at a time:
 *  1. nearest hotels to the person's live location are offered (accept or choose another)
 *  2. person reaches the hotel (tap, or auto-detected) → remark pop-up
 *  3. after saving, the next nearest hotels from THAT hotel are offered (accept or choose another)
 */
export default function VisitMode({ stops, areaLabel, onClose }) {
  const { leads, logCall, toast, go } = useApp()
  const { me, state, locate } = useGeo({ watch: true })
  const meRef = useRef(me); meRef.current = me
  const total = useRef(stops.length).current
  const first = useRef(stops).current
  const arrived = useRef(new Set())

  const [ready, setReady] = useState(false)
  const [pool, setPool] = useState(() => first.map((l) => l.id)) // hotels still to visit (not the current one)
  const [curId, setCurId] = useState(null)
  const [phase, setPhase] = useState('pick') // pick | go | form
  const [pickKind, setPickKind] = useState('start') // start | next | skip
  const [origin, setOrigin] = useState(null) // where the next-nearest is measured from
  const [skipped, setSkipped] = useState([])
  const [reached, setReached] = useState(null)
  const [log, setLog] = useState([])
  const [busy, setBusy] = useState(false)
  const [party, setParty] = useState(0)
  const byId = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads])

  useEffect(() => {
    let dead = false
    ;(async () => {
      const pos = await withTimeout(locate(), 7000)
      if (dead) return
      const p = pos || meRef.current
      setOrigin(p ? { lat: p.lat, lng: p.lng, label: 'your location' } : null)
      setReady(true)
    })()
    return () => { dead = true }
  }, [locate])

  const cur = curId ? byId.get(curId) : null
  const poolLeads = useMemo(() => pool.map((id) => byId.get(id)).filter(Boolean), [pool, byId])
  const options = useMemo(() => (phase === 'pick' ? nearest(origin, poolLeads, skipped).slice(0, 3) : []), [phase, origin, poolLeads, skipped])
  const plan = useMemo(() => {
    if (phase === 'pick') return planRoute(origin, poolLeads).map((x) => ({ l: x.l, pt: x.pt }))
    if (!cur) return []
    const curPt = pointOf(cur)
    return [{ l: cur, pt: curPt }, ...planRoute(curPt || origin, poolLeads).map((x) => ({ l: x.l, pt: x.pt }))]
  }, [phase, origin, poolLeads, cur])
  const nextUp = phase === 'pick' ? [] : plan.slice(1, 4)
  const done = ready && !cur && pool.length === 0

  const accept = (id) => {
    setCurId(id)
    setPool((p) => p.filter((x) => x !== id))
    setSkipped([])
    setReached(null)
    setPhase('go')
  }

  const reachNow = () => {
    if (!cur) return
    const pt = pointOf(cur)
    const pos = meRef.current
    const dist = pos && pt && !pt.approx ? km(pos, pt) : null
    setReached({ dist, pos: pos ? { lat: pos.lat, lng: pos.lng } : null })
    setPhase('form')
    toast(dist != null ? (dist < 0.25 ? '✅ You are at the hotel' : `📍 ${fmtKm(dist)} from the hotel pin`) : '✅ Checked in')
  }

  // arriving within ~120 m of an exact pin opens the remark pop-up by itself (once per hotel)
  useEffect(() => {
    if (phase !== 'go' || !cur || !me) return
    const pt = pointOf(cur)
    if (!pt || pt.approx || arrived.current.has(cur.id)) return
    if (km(me, pt) < 0.12) { arrived.current.add(cur.id); reachNow() }
  }, [me, phase, cur]) // eslint-disable-line react-hooks/exhaustive-deps

  const onSkip = async () => {
    setBusy(true)
    const id = curId
    const pos = await withTimeout(locate(), 2500)
    const p = pos || meRef.current
    setOrigin(p ? { lat: p.lat, lng: p.lng, label: 'your location' } : origin)
    setPool((l) => [...l, id])
    setSkipped([id])
    setCurId(null)
    setPickKind('skip')
    setPhase('pick')
    setBusy(false)
  }

  const onSave = async ({ outcome, rating, remark, next, extra }) => {
    setBusy(true)
    const here = meRef.current
    const visited = cur
    logCall(visited, { outcome, rating, remark, next, extra, priority: ratingToPriority(rating) || undefined, mode: 'visit', visit: here ? { lat: here.lat, lng: here.lng } : undefined })
    setLog((l) => [...l, { id: visited.id, name: nameOf(visited), area: visited.area, outcome, rating }])
    if (outcome === 'Order Restarted') { setParty((n) => n + 1); toast('🎉 Order restarted. Great work!') } else toast('Visit saved ✓')
    setCurId(null)
    if (pool.length) {
      // measure the next hotels from the place just reached: the hotel pin, else where the check-in happened
      const pt = pointOf(visited)
      const o = pt && !pt.approx ? { lat: pt.lat, lng: pt.lng } : reached?.pos || meRef.current || (pt && { lat: pt.lat, lng: pt.lng }) || null
      setOrigin(o ? { ...o, label: nameOf(visited) } : null)
      setSkipped([])
      setPickKind('next')
      setPhase('pick')
    }
    setReached(null)
    setBusy(false)
  }

  const doneN = log.length
  const hereNow = !!(cur && me && (() => { const q = pointOf(cur); return q && !q.approx && km(me, q) < 0.15 })())
  const rated = log.filter((x) => x.rating)
  const avg = rated.length ? Math.round((rated.reduce((n, x) => n + x.rating, 0) / rated.length) * 10) / 10 : 0

  return createPortal(
    <motion.div className="vm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <header className="vm-top">
        <button className="vm-x" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        <div className="vm-title"><b>Visit run · {areaLabel}</b><small>{doneN} of {total} visited today</small></div>
        <button className={`vm-gps ${state}`} onClick={() => locate()}>{state === 'ok' ? '📡 Live' : state === 'loading' ? '📡 Locating…' : state === 'denied' ? '📡 Allow GPS' : '📡 Find me'}</button>
      </header>
      <div className="vm-bar"><motion.i animate={{ width: `${Math.min(100, (doneN / Math.max(1, total)) * 100)}%` }} /></div>

      <div className={`vm-body ${phase === 'go' && cur && !done ? 'has-foot' : ''}`}>
        {party > 0 && <Confetti key={party} />}
        {!ready && (
          <div className="vm-wait">
            <div className="radar"><i /><i /><i /><span>📍</span></div>
            <h3>Finding the nearest hotel…</h3>
            <p>Reading your location and measuring every hotel from where you stand.</p>
          </div>
        )}

        {ready && !done && (
          <>
            {state === 'denied' && <div className="vm-note">Location is off, so hotels are ordered by area. Allow location for nearest-first routing.</div>}
            <RouteMap me={me} plan={plan} />
            {phase === 'pick' && <div className="vm-note soft">Choose where to go next in the pop-up 👇</div>}
            {phase !== 'pick' && cur && (
              <AnimatePresence mode="wait">
                <StopCard key={cur.id} lead={cur} me={me} index={doneN + 1} total={total} />
              </AnimatePresence>
            )}
            {nextUp.length > 0 && (
              <div className="vm-next">
                <h4>Then</h4>
                {nextUp.map((s, i) => (
                  <div key={s.l.id} className="vm-nx"><i>{doneN + i + 2}</i><b>{s.l.name}</b><small>{[s.l.area, me && s.pt ? fmtKm(km(me, s.pt)) : ''].filter(Boolean).join(' · ')}</small></div>
                ))}
                {plan.length > 4 && <small className="vm-more">+ {plan.length - 4} more after these</small>}
              </div>
            )}
          </>
        )}

        {done && (
          <motion.div className="vm-done" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}>
            <Confetti />
            <div className="vm-trophy">🏁</div>
            <h2>{areaLabel} done!</h2>
            <p>{doneN} hotel{doneN === 1 ? '' : 's'} visited{avg ? ` · average interest ${avg} / 5` : ''}.</p>
            <div className="vm-sum">
              {log.map((x) => (
                <div key={x.id}><b>{x.name}</b><small>{x.outcome}</small><StarsRO value={x.rating} size={13} /></div>
              ))}
            </div>
            <div className="done-actions">
              <button className="btn-soft" onClick={() => { onClose(); go('report') }}><Icon name="download" /> Download report</button>
              <button className="btn3d" onClick={onClose}>Back to today</button>
            </div>
          </motion.div>
        )}
      </div>

      {ready && !done && phase === 'go' && cur && (
        <div className="vm-foot">
          <button type="button" className={`vm-reach2 ${hereNow ? 'done' : ''}`} disabled={busy} onClick={reachNow}>
            {hereNow ? '📍 You are here · log the visit' : '📍 I have reached · log the visit'}
          </button>
          {pool.length > 0 && <button type="button" className="vm-skip2" disabled={busy} onClick={onSkip}>Skip</button>}
        </div>
      )}

      <AnimatePresence>
        {ready && !done && phase === 'pick' && options.length > 0 && (
          <NextSheet key={`${pickKind}-${doneN}-${skipped.join('')}`} kind={pickKind} options={options} fromLabel={origin?.label} waiting={Math.max(0, poolLeads.length - options.length)} onAccept={accept} onFinish={() => { setPool([]); setCurId(null) }} />
        )}
        {phase === 'form' && cur && (
          <RemarkSheet key={cur.id} lead={cur} reached={reached} last={pool.length === 0} busy={busy} onSave={onSave} onBack={() => setPhase('go')} />
        )}
      </AnimatePresence>
    </motion.div>,
    document.body
  )
}
