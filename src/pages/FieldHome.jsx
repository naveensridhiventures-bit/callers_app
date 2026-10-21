import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../store'
import { Counter, Icon } from '../ui'
import LeadCard from '../components/LeadCard'
import VisitMode from '../components/VisitMode'
import { StarsRO } from '../components/Stars'
import { useGeo } from '../useGeo'
import { pointOf } from '../chennai'
import { areaOfLead, buildFieldReport, rangeFor } from '../fieldReport'
import { bucket, fmtKm, fmtTime, greeting, km } from '../utils'
import { CLOSED } from '../constants'

/** Field person's day: today's visits and calls, pick a Chennai area, then visit its hotels one by one. */
export default function FieldHome() {
  const { leads, session, go, toast } = useApp()
  const { me, state, locate } = useGeo()
  const [area, setArea] = useState('all')
  const [run, setRun] = useState(false)

  const hotels = useMemo(() => leads.filter((l) => l.type === 'hotel'), [leads])
  const today = useMemo(() => buildFieldReport({ leads: hotels, session, range: rangeFor('today') }), [hotels, session])
  const visitedIds = useMemo(() => new Set(today.entries.filter((e) => e.mode === 'visit').map((e) => e.lead.id)), [today])

  // hotels still to visit: not closed, not already visited today
  const pending = useMemo(() => hotels.filter((l) => !CLOSED.includes(l.status) && !visitedIds.has(l.id)), [hotels, visitedIds])
  const areas = useMemo(() => {
    const m = new Map()
    pending.forEach((l) => m.set(areaOfLead(l), (m.get(areaOfLead(l)) || 0) + 1))
    return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [pending])
  const inArea = useMemo(() => (area === 'all' ? pending : pending.filter((l) => areaOfLead(l) === area)), [pending, area])
  const list = useMemo(() => {
    const rows = inArea.map((l) => { const p = pointOf(l); return { l, d: me && p ? km(me, p) : null } })
    return rows.sort((a, b) => (a.d ?? 1e9) - (b.d ?? 1e9) || (a.l.nextFollowUp || '9').localeCompare(b.l.nextFollowUp || '9') || (a.l.name || '').localeCompare(b.l.name || ''))
  }, [inArea, me])

  const due = hotels.filter((l) => ['overdue', 'today'].includes(bucket(l))).length
  const t = today.totals
  const label = area === 'all' ? 'all areas' : area

  const near = async () => {
    const p = await locate()
    toast(p ? 'Sorted by distance from you 📍' : 'Allow location access to sort by distance', p ? 'ok' : 'warn')
  }

  return (
    <div className="page">
      <div className="page-h"><h1>{greeting()}, {session.name.split(' ')[0]} 👋</h1></div>

      <div className="kpis">
        <div className="kpi"><em>📍</em><b><Counter value={t.visits} /></b><span>Visits today</span></div>
        <div className="kpi"><em>📞</em><b><Counter value={t.calls} /></b><span>Calls today</span></div>
        <div className="kpi"><em>⭐</em><b>{t.avgRating ? t.avgRating : '-'}</b><span>Avg interest today</span></div>
        <div className="kpi"><em>⏰</em><b><Counter value={due} /></b><span>Follow-ups due</span></div>
      </div>

      <section className="card fh-pick">
        <div className="fh-pick-h">
          <h3>🗺 Choose an area in Chennai</h3>
          <button className="btn-soft sm" disabled={state === 'loading'} onClick={near}>{state === 'loading' ? 'Finding…' : me ? '📍 Refresh' : '📍 Nearest first'}</button>
        </div>
        <div className="chips scroll">
          <button className={`chip ${area === 'all' ? 'on' : ''}`} onClick={() => setArea('all')}>All areas <b>{pending.length}</b></button>
          {areas.map(([a, n]) => <button key={a} className={`chip ${area === a ? 'on' : ''}`} onClick={() => setArea(a)}>{a} <b>{n}</b></button>)}
        </div>
        <motion.button whileTap={{ scale: 0.97, y: 3 }} className="btn3d lime big fh-go" disabled={!inArea.length} onClick={() => setRun(true)}>
          <Icon name="play" size={20} /> {inArea.length ? `Start visits · ${label} (${inArea.length} hotel${inArea.length > 1 ? 's' : ''})` : 'No hotels left to visit here'}
        </motion.button>
        <p className="mini-note">You get one hotel at a time, nearest first from where you stand, with the map, Navigate, and a star rating for their interest.</p>
      </section>

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

      <div className="sel-bar">
        <b>{inArea.length} to visit{area === 'all' ? '' : ` in ${area}`}</b>
        {due > 0 && <button className="btn-soft sm" onClick={() => go('follow')}>⏰ Due ({due})</button>}
      </div>
      {list.map(({ l, d }, i) => (
        <div key={l.id}>
          {d != null && <small className="dist">{fmtKm(d)} away</small>}
          <LeadCard lead={l} i={i} />
        </div>
      ))}
      {!hotels.length && <div className="card empty"><div className="empty-ico">🏨</div><h3>No hotels assigned yet</h3><p>HR will assign hotels to you, or tap + to add one you find on the road.</p></div>}
      {hotels.length > 0 && !pending.length && <div className="card empty"><div className="empty-ico">🎉</div><h3>All hotels visited today</h3><p>Great day. Download your report from the Report tab.</p></div>}

      {run && <VisitMode stops={inArea} areaLabel={area === 'all' ? 'All areas' : area} onClose={() => setRun(false)} />}
    </div>
  )
}
