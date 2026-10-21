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

/* ---------- one hotel: the pop-up card ---------- */
function StopCard({ lead, me, index, total, last, onSave, onSkip, busy }) {
  const { toast } = useApp()
  const pt = pointOf(lead)
  const d = me && pt ? km(me, pt) : null
  const here = d != null && !pt.approx && d < 0.15
  const [outcome, setOutcome] = useState('')
  const [rating, setRating] = useState(0)
  const [manual, setManual] = useState(false)
  const [remark, setRemark] = useState('')
  const [next, setNext] = useState('')
  const [reached, setReached] = useState(null)
  const remarks = QUICK_REMARKS.hotel

  const pick = (id) => {
    setOutcome(id)
    if (!manual) setRating(DEFAULT_RATING[id] || 0)
    setNext(suggestNext(id))
  }
  const toggleRemark = (r) => setRemark((cur) => (cur.includes(r) ? cur.replace(r, '').replace(/^[,\s]+|[,\s]+$/g, '').replace(/,\s*,/g, ',') : cur ? `${cur}, ${r}` : r))
  const reach = () => {
    if (!me) return toast('Turn on location to check in', 'warn')
    setReached({ dist: d })
    toast(d != null && !pt.approx ? (d < 0.25 ? '✅ You are at the hotel' : `📍 ${fmtKm(d)} from the hotel pin`) : '✅ Checked in')
  }
  const save = () => {
    if (!outcome) return toast('Pick how the visit went first', 'warn')
    if (NEEDS_RATING.includes(outcome) && !rating) return toast('Give the interest a star rating ⭐', 'warn')
    const note = [reached && d != null && !pt.approx ? `Checked in ${fmtKm(d)} from the pin` : '', remark.trim()].filter(Boolean).join(' · ')
    onSave({ outcome, rating, remark: note, next })
  }
  const share = `📍 ${lead.name}\n${[lead.address, lead.area].filter(Boolean).join(', ')}\n${mapOpen(lead)}`

  return (
    <motion.div className="vm-card" initial={{ opacity: 0, x: 70, scale: 0.97 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -70, scale: 0.97 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
      <div className="vm-head">
        <span className="vm-step">Stop {index} of {total}</span>
        <span className="vm-pin">🏨</span>
        <h2>{lead.name}</h2>
        <p>{[lead.area, 'Chennai'].filter(Boolean).join(' · ')}</p>
        <div className="vm-chips">
          {d != null && <span className="big">📏 {fmtKm(d)} · ~{fmtEta(etaMin(d))}</span>}
          {pt?.approx && <span>≈ area centre</span>}
          {lead.rating > 0 && <span><StarsRO value={Number(lead.rating)} size={11} /> last visit</span>}
          {lead.lastOrderOn && <span>🕒 Last order {lead.lastOrderOn}</span>}
          {lead.stopReason && <span>⚠️ {lead.stopReason}</span>}
          {lead.monthlyQty && <span>📦 {lead.monthlyQty}/mo before</span>}
        </div>
        {here && <motion.div className="vm-here" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>📍 You are here</motion.div>}
      </div>

      <div className="vm-map">
        <iframe title={`Map of ${lead.name}`} src={mapEmbed(lead)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        <div className="mp-offline">Map needs internet. Use <b>Navigate</b> below.</div>
      </div>

      <div className="vm-info">
        {(lead.address || lead.area) && <p><Icon name="pin" size={16} /> {lead.address || lead.area}</p>}
        {(lead.contactName || lead.phone) && (
          <p><Icon name="phone" size={16} /> {lead.contactName ? <b>{lead.contactName}</b> : null}{lead.contactName && lead.phone ? ' · ' : ''}{lead.phone ? <a href={telHref(lead.phone)}>{lead.phone}</a> : null}</p>
        )}
        {!lead.phone && !lead.contactName && <p className="mp-muted">No contact number yet. Ask for the owner or manager and add it with Edit.</p>}
        {lead.lastRemark && <p className="mp-muted">Last time: {lead.lastOutcome ? `${lead.lastOutcome} · ` : ''}{lead.lastRemark}</p>}
      </div>

      <div className="vm-actions">
        <motion.a whileTap={{ scale: 0.95 }} className="go" href={mapDirections(lead)} target="_blank" rel="noreferrer"><Icon name="send" /> Navigate</motion.a>
        {lead.phone && <motion.a whileTap={{ scale: 0.95 }} href={telHref(lead.phone)}><Icon name="phone" /> Call</motion.a>}
        {lead.phone && <motion.a whileTap={{ scale: 0.95 }} href={waHref(lead.phone)} target="_blank" rel="noreferrer"><Icon name="whatsapp" /> Chat</motion.a>}
        <motion.a whileTap={{ scale: 0.95 }} href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noreferrer"><Icon name="copy" /> Share pin</motion.a>
      </div>

      <button type="button" className={`vm-reach ${reached || here ? 'done' : ''}`} onClick={reach}>
        {reached ? (reached.dist != null && !pt.approx ? (reached.dist < 0.25 ? `✅ Checked in · at the hotel (${fmtKm(reached.dist)})` : `⚠️ Checked in · ${fmtKm(reached.dist)} from the pin`) : '✅ Checked in') : '📍 I have reached · check in'}
      </button>

      <div className="vm-form">
        <h4>How did the visit go?</h4>
        <div className="vm-outcomes">
          {VISIT_OUTCOMES.map((id) => (
            <motion.button type="button" key={id} whileTap={{ scale: 0.93 }} className={outcome === id ? 'on' : ''} onClick={() => pick(id)}>
              <em>{OUTCOMES.find((o) => o.id === id)?.icon}</em>{id}
            </motion.button>
          ))}
        </div>

        <h4>Interest rating</h4>
        <div className="vm-rate">
          <Stars value={rating} size={40} onChange={(n) => { setRating(n); setManual(true) }} />
          <span className={`vm-rate-l r${rating}`}>{RATING_LABEL[rating]}</span>
        </div>

        <h4>Remark</h4>
        <div className="chips small">
          {remarks.map((r) => <button type="button" key={r} className={`chip ${remark.includes(r) ? 'on' : ''}`} onClick={() => toggleRemark(r)}>{r}</button>)}
        </div>
        <textarea rows={2} value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="What did the owner or chef say?" />

        {!['Order Restarted', 'Hotel Closed', 'Not Interested'].includes(outcome) && (
          <>
            <h4>Next follow-up {next && <small>· {fmtWhen(next)}</small>}</h4>
            <div className="chips small">
              {QUICK_NEXT.map(([l, f]) => <button type="button" key={l} className="chip" onClick={() => setNext(f())}>{l}</button>)}
              <button type="button" className={`chip ${!next ? 'on' : ''}`} onClick={() => setNext('')}>None</button>
            </div>
            <input type="datetime-local" value={toLocalInput(next)} onChange={(e) => setNext(fromLocalInput(e.target.value))} />
          </>
        )}

        <motion.button whileTap={{ scale: 0.97, y: 3 }} className={`btn3d big ${outcome ? '' : 'off'}`} disabled={busy} onClick={save}>
          <Icon name="check" /> {outcome ? (last ? 'Save & finish' : 'Save & go to next hotel') : 'Pick what happened ↑'}
        </motion.button>
        {!last && <button type="button" className="vm-skip" disabled={busy} onClick={onSkip}>Skip this hotel for now</button>}
      </div>
    </motion.div>
  )
}

/** Full-screen visit run: one hotel at a time, nearest first, from the person's live location. */
export default function VisitMode({ stops, areaLabel, onClose }) {
  const { leads, logCall, toast, go } = useApp()
  const { me, state, locate } = useGeo({ watch: true })
  const meRef = useRef(me); meRef.current = me
  const total = useRef(stops.length).current
  const [queue, setQueue] = useState(null)
  const [log, setLog] = useState([])
  const [busy, setBusy] = useState(false)
  const [party, setParty] = useState(0)
  const byId = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads])
  const first = useRef(stops).current

  useEffect(() => {
    let dead = false
    ;(async () => {
      const pos = await withTimeout(locate(), 7000)
      if (!dead) setQueue(planRoute(pos || meRef.current, first).map((x) => x.l.id))
    })()
    return () => { dead = true }
  }, [first, locate])

  const cur = queue?.length ? byId.get(queue[0]) : null
  const plan = useMemo(() => (queue || []).map((id) => byId.get(id)).filter(Boolean).map((l) => ({ l, pt: pointOf(l) })), [queue, byId])
  const nextUp = plan.slice(1, 4)

  const advance = async (skip) => {
    setBusy(true)
    const [head, ...rest] = queue
    const pos = rest.length ? await withTimeout(locate(), 2500) : null
    const ordered = planRoute(pos || meRef.current, rest.map((id) => byId.get(id)).filter(Boolean)).map((x) => x.l.id)
    setQueue(skip ? [...ordered, head] : ordered)
    setBusy(false)
  }
  const onSave = async ({ outcome, rating, remark, next }) => {
    const here = meRef.current
    logCall(cur, { outcome, rating, remark, next, priority: ratingToPriority(rating) || undefined, mode: 'visit', visit: here ? { lat: here.lat, lng: here.lng } : undefined })
    setLog((l) => [...l, { id: cur.id, name: nameOf(cur), area: cur.area, outcome, rating }])
    if (outcome === 'Order Restarted') { setParty((n) => n + 1); toast('🎉 Order restarted. Great work!') } else toast('Visit saved ✓')
    await advance(false)
  }

  const doneN = log.length
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

      <div className="vm-body">
        {party > 0 && <Confetti key={party} />}
        {queue === null && (
          <div className="vm-wait">
            <div className="radar"><i /><i /><i /><span>📍</span></div>
            <h3>Finding the shortest route…</h3>
            <p>Reading your location and ordering the hotels from nearest to farthest.</p>
          </div>
        )}

        {queue && cur && (
          <>
            {state === 'denied' && <div className="vm-note">Location is off, so hotels are ordered by area. Allow location for nearest-first routing.</div>}
            <RouteMap me={me} plan={plan} />
            <AnimatePresence mode="wait">
              <StopCard key={cur.id} lead={cur} me={me} index={doneN + 1} total={total} last={queue.length === 1} busy={busy} onSave={onSave} onSkip={() => advance(true)} />
            </AnimatePresence>
            {nextUp.length > 0 && (
              <div className="vm-next">
                <h4>Up next</h4>
                {nextUp.map((s, i) => (
                  <div key={s.l.id} className="vm-nx"><i>{doneN + i + 2}</i><b>{s.l.name}</b><small>{[s.l.area, me && s.pt ? fmtKm(km(me, s.pt)) : ''].filter(Boolean).join(' · ')}</small></div>
                ))}
                {queue.length > 4 && <small className="vm-more">+ {queue.length - 4} more after these</small>}
              </div>
            )}
          </>
        )}

        {queue && !cur && (
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
    </motion.div>,
    document.body
  )
}
