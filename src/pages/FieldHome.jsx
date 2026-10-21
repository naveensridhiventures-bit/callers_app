import { useMemo, useState } from 'react'
import { useApp } from '../store'
import { Counter } from '../ui'
import LeadCard from '../components/LeadCard'
import { bucket, fmtKm, greeting, hotelPoint, isToday, km } from '../utils'
import { CLOSED } from '../constants'

/** Field person's home: today's numbers + the hotels to visit, nearest first. */
export default function FieldHome() {
  const { leads, session, toast, go } = useApp()
  const [me, setMe] = useState(null)
  const [busy, setBusy] = useState(false)

  const hotels = useMemo(() => leads.filter((l) => l.type === 'hotel'), [leads])
  const withDist = useMemo(() => hotels.map((l) => {
    const p = hotelPoint(l)
    return { l, d: me && p ? km(me, p) : null }
  }), [hotels, me])
  const open = withDist.filter(({ l }) => !CLOSED.includes(l.status))
    .sort((a, b) => (a.d ?? 1e9) - (b.d ?? 1e9) || (a.l.nextFollowUp || '9').localeCompare(b.l.nextFollowUp || '9'))
  const visitsToday = hotels.reduce((n, l) => n + (l.calls || []).filter((c) => isToday(c.at) && c.mode === 'visit' && c.outcome !== 'Checked In').length, 0)
  const won = hotels.filter((l) => l.status === 'Reactivated').length
  const due = hotels.filter((l) => ['overdue', 'today'].includes(bucket(l))).length

  const locate = () => {
    if (!navigator.geolocation) return toast('GPS is not available', 'warn')
    setBusy(true)
    navigator.geolocation.getCurrentPosition(
      (p) => { setMe({ lat: p.coords.latitude, lng: p.coords.longitude }); setBusy(false); toast('Sorted by distance from you 📍') },
      () => { setBusy(false); toast('Allow location access to sort by distance', 'warn') },
      { enableHighAccuracy: true, timeout: 12000 }
    )
  }

  return (
    <div className="page">
      <div className="page-h"><h1>{greeting()}, {session.name.split(' ')[0]} 👋</h1></div>
      <div className="kpis">
        <div className="kpi"><em>🏨</em><b><Counter value={hotels.length} /></b><span>My hotels</span></div>
        <div className="kpi"><em>📍</em><b><Counter value={visitsToday} /></b><span>Visited today</span></div>
        <div className="kpi"><em>⏰</em><b><Counter value={due} /></b><span>Follow-ups due</span></div>
        <div className="kpi"><em>🎉</em><b><Counter value={won} /></b><span>Won back</span></div>
      </div>
      <div className="sel-bar">
        <b>{open.length} to visit</b>
        <button className="btn-soft sm" disabled={busy} onClick={locate}>{busy ? 'Finding…' : me ? '📍 Refresh' : '📍 Nearest first'}</button>
        {due > 0 && <button className="btn-soft sm" onClick={() => go('follow')}>⏰ Due ({due})</button>}
      </div>
      {open.map(({ l, d }, i) => (
        <div key={l.id}>
          {d != null && <small className="dist">{fmtKm(d)} away</small>}
          <LeadCard lead={l} i={i} />
        </div>
      ))}
      {!hotels.length && <div className="card empty"><div className="empty-ico">🏨</div><h3>No hotels assigned yet</h3><p>HR will assign lapsed hotels to you. They appear here with their location.</p></div>}
    </div>
  )
}
