import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../store'
import { Counter, Icon } from '../ui'
import { StarsRO } from '../components/Stars'
import { areaOfLead, buildFieldReport, rangeFor } from '../fieldReport'
import { bucket, fmtTime, greeting } from '../utils'
import { CLOSED } from '../constants'
import { kgOf } from '../cancelled'
import { hasPin, isClosedHotel } from '../fieldStatus'

/** TODAY: where you stand in the day, and the one thing to do next. */
export default function FieldHome() {
  const { leads, session, go } = useApp()
  const hotels = useMemo(() => leads.filter((l) => l.type === 'hotel'), [leads])
  const today = useMemo(() => buildFieldReport({ leads: hotels, session, range: rangeFor('today') }), [hotels, session])
  const visitedIds = useMemo(() => new Set(today.entries.filter((e) => e.mode === 'visit').map((e) => e.lead.id)), [today])
  const pending = useMemo(() => hotels.filter((l) => !CLOSED.includes(l.status) && !visitedIds.has(l.id)), [hotels, visitedIds])
  const due = useMemo(() => pending.filter((l) => ['overdue', 'today'].includes(bucket(l))), [pending])
  const upcoming = hotels.filter((l) => bucket(l) === 'upcoming').length
  const areas = useMemo(() => {
    const m = new Map()
    pending.forEach((l) => m.set(areaOfLead(l), (m.get(areaOfLead(l)) || 0) + 1))
    return [...m].sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [pending])
  const t = today.totals
  const pendingKg = pending.reduce((n, l) => n + kgOf(l), 0)
  const withNext = today.entries.filter((e) => e.next).length

  // how many open hotels already have an exact map pin
  const open = useMemo(() => hotels.filter((l) => !isClosedHotel(l)), [hotels])
  const noPin = open.filter((l) => !hasPin(l)).length
  const pinPct = open.length ? Math.round(((open.length - noPin) / open.length) * 100) : 100
  const dayGoal = Math.max(1, t.visits + pending.length)
  const dayPct = Math.round((t.visits / dayGoal) * 100)
  const addLocations = () => { localStorage.setItem('sridhi.planPin', 'lock'); go('plan') }

  const openPlan = (a) => { if (a) localStorage.setItem('sridhi.planArea', a); go('plan') }

  // the one thing to do next
  const next = !hotels.length
    ? { ico: '🏨', t: 'No hotels assigned yet', s: 'HR will assign hotels to you. You can also add one you find on the road.', btn: '+ Add a hotel', fn: () => go('plan') }
    : due.length
    ? { ico: '⏰', t: `${due.length} follow-up${due.length > 1 ? 's are' : ' is'} due`, s: 'Go back to these first. They already showed interest.', btn: 'Open follow-ups', fn: () => go('follow') }
    : pending.length
    ? { ico: '🗺', t: `${pending.length} hotel${pending.length > 1 ? 's' : ''} waiting`, s: `${pendingKg ? `${pendingKg} kg to win back. ` : ''}Choose an area, tick the hotels and start.`, btn: 'Plan my visits', fn: () => go('plan') }
    : { ico: '🎉', t: 'All hotels visited today', s: 'Great day. Send your report to the team.', btn: 'Open report', fn: () => go('report') }

  const steps = [
    { n: 1, ico: '🗺', t: 'Plan', s: `${pending.length} to visit`, hint: 'Filter and tick hotels', fn: () => go('plan') },
    { n: 2, ico: '📍', t: 'Visit', s: `${t.visits} today`, hint: 'Map shows why they stopped', fn: () => go('plan') },
    { n: 3, ico: '✍️', t: 'Remark', s: `${t.visits + t.calls} saved`, hint: 'Outcome, stars, note', fn: () => go('plan') },
    { n: 4, ico: '⏰', t: 'Follow up', s: `${due.length} due · ${upcoming} later`, hint: 'Never lose a hotel', fn: () => go('follow') },
  ]

  return (
    <div className="page">
      <section className="fh-hero">
        <div>
          <small>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</small>
          <h1>{greeting()}, {session.name.split(' ')[0]} 👋</h1>
          <p>{t.visits ? <><b>{t.visits}</b> visit{t.visits > 1 ? 's' : ''} done today. </> : 'No visits yet today. '}{pending.length ? <><b>{pending.length}</b> hotel{pending.length > 1 ? 's' : ''} waiting.</> : 'Everything is visited.'}</p>
        </div>
        <div className="fh-ring" style={{ '--p': dayPct }}><b>{dayPct}%<small>OF TODAY</small></b></div>
      </section>

      <motion.section className="card fh-next" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <span className="fh-next-i">{next.ico}</span>
        <div><small>Do this next</small><h3>{next.t}</h3><p>{next.s}</p></div>
        <button className="btn3d lime big" onClick={next.fn}>{next.btn} <Icon name="chevron" size={18} /></button>
      </motion.section>

      {noPin > 0 && (
        <section className="card fh-loc">
          <div className="fh-loc-ring" style={{ '--p': pinPct }}><b>{pinPct}%</b></div>
          <div>
            <h3>{noPin} hotel{noPin > 1 ? 's need' : ' needs'} an exact location</h3>
            <p>Add it when you reach the hotel (GPS), find it online, or paste a Google Maps link. HR sees it right away.</p>
          </div>
          <button type="button" className="btn-soft" onClick={addLocations}>📍 Show hotels to pin</button>
        </section>
      )}

      <div className="kpis">
        <div className="kpi"><em>📍</em><b><Counter value={t.visits} /></b><span>Visits today</span></div>
        <div className="kpi"><em>📞</em><b><Counter value={t.calls} /></b><span>Calls today</span></div>
        <div className="kpi"><em>⭐</em><b>{t.avgRating ? t.avgRating : '-'}</b><span>Avg interest</span></div>
        <div className="kpi"><em>⏰</em><b><Counter value={due.length} /></b><span>Follow-ups due</span></div>
      </div>

      <section className="card fh-steps">
        <h3>Your day, step by step</h3>
        <div className="fh-steps-g">
          {steps.map((s) => (
            <button key={s.n} className="fh-step" onClick={s.fn}>
              <i>{s.n}</i><em>{s.ico}</em><b>{s.t}</b><span>{s.s}</span><small>{s.hint}</small>
            </button>
          ))}
        </div>
        {withNext < t.visits && t.visits > 0 && <p className="mini-note warn">⚠️ {t.visits - withNext} visit{t.visits - withNext > 1 ? 's' : ''} today have no next follow-up set.</p>}
      </section>

      {areas.length > 0 && (
        <section className="card">
          <h3 className="fh-h">Where the hotels are</h3>
          <div className="chips scroll">
            {areas.map(([a, n]) => <button key={a} className="chip" onClick={() => openPlan(a)}>{a} <b>{n}</b></button>)}
            <button className="chip on" onClick={() => openPlan()}>All areas →</button>
          </div>
        </section>
      )}

      {(t.visits > 0 || t.calls > 0) && (
        <section className="card fh-today">
          <div className="fh-pick-h">
            <h3>✅ Today so far</h3>
            <button className="btn-soft sm" onClick={() => go('report')}><Icon name="download" size={15} /> Report</button>
          </div>
          {[...today.entries].reverse().slice(0, 6).map((e, i) => (
            <div key={`${e.at}-${i}`} className="fh-row">
              <i>{e.mode === 'visit' ? '📍' : '📞'}</i>
              <div><b>{e.name}</b><small>{[e.area, e.outcome, fmtTime(e.at)].filter(Boolean).join(' · ')}</small></div>
              <StarsRO value={e.rating} size={12} />
            </div>
          ))}
          {today.entries.length > 6 && <small className="vm-more">+ {today.entries.length - 6} more in the report</small>}
        </section>
      )}
    </div>
  )
}
