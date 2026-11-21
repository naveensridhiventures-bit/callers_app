import { useMemo, useState } from 'react'
import { DAMAGE_REASONS, inr, packetValue, prettyDate } from './ledger'
import { Avatar, PhotoImg } from './ui'

export default function Damage({ app, ledger, openPhoto, openEntry }) {
  const { state } = app
  const { settings, users, entries } = state
  const pv = packetValue(settings)
  const [filter, setFilter] = useState('All')

  const list = useMemo(
    () => entries.filter((e) => e.type === 'damage').sort((a, b) => (a.date === b.date ? b.ts - a.ts : b.date.localeCompare(a.date))),
    [entries]
  )
  const shown = filter === 'All' ? list : list.filter((e) => e.reason === filter)
  const total = list.reduce((a, e) => a + e.qty, 0)
  const noPhoto = list.filter((e) => !e.photoIds?.length).length
  const sentOut = ledger.rows.reduce((a, r) => a + r.sentOut, 0)
  const pct = sentOut ? ((total / sentOut) * 100).toFixed(1) : '0.0'

  const byReason = DAMAGE_REASONS.map((r) => [r, list.filter((e) => e.reason === r).reduce((a, e) => a + e.qty, 0)]).filter((x) => x[1] > 0)
  const maxR = Math.max(1, ...byReason.map((x) => x[1]))

  const groups = []
  shown.forEach((e) => {
    const g = groups[groups.length - 1]
    if (g && g.date === e.date) g.items.push(e)
    else groups.push({ date: e.date, items: [e] })
  })

  return (
    <div className="screen">
      <h1 className="title">⚠️ Damage Register</h1>
      <div className="kpis">
        <div className="kpi"><span>Total damage</span><b style={{ color: '#dc2626' }}>{total}</b><em>packets</em></div>
        <div className="kpi"><span>Loss</span><b>{inr(total * pv)}</b><em>{pct}% of sent out</em></div>
        <div className="kpi"><span>No photo</span><b style={{ color: noPhoto ? '#d97706' : '#16a34a' }}>{noPhoto}</b><em>{noPhoto ? 'needs proof' : 'all proven'}</em></div>
      </div>

      {byReason.length > 0 && (
        <section className="card">
          <b className="small">Why is stock getting damaged?</b>
          {byReason.map(([r, q]) => (
            <div className="rbar" key={r}>
              <span>{r}</span>
              <div><i style={{ width: `${(q / maxR) * 100}%` }} /></div>
              <b>{q}</b>
            </div>
          ))}
        </section>
      )}

      <div className="chips scroll">
        {['All', ...DAMAGE_REASONS].map((r) => (
          <button key={r} className={`chip ${filter === r ? 'on' : ''}`} onClick={() => setFilter(r)}>{r}</button>
        ))}
      </div>

      {groups.length === 0 && (
        <div className="empty">
          No damage recorded 🎉<br />
          <button className="btn primary" style={{ marginTop: 12 }} onClick={() => openEntry('damage')}>+ Record damage with photo</button>
        </div>
      )}

      {groups.map((g) => (
        <div key={g.date}>
          <h3 className="day-h">{prettyDate(g.date, { weekday: 'long', day: 'numeric', month: 'short' })}
            <span className="pill red">{g.items.reduce((a, e) => a + e.qty, 0)} pkt</span></h3>
          <div className="gallery">
            {g.items.map((e) => {
              const u = users.find((x) => x.id === e.userId)
              const pid = e.photoIds?.[0]
              const cap = `${prettyDate(e.date)} · ${e.qty} pkt · ${e.reason} · ${u?.name || ''}`
              return (
                <div className="gcard" key={e.id}>
                  {pid ? (
                    <div className="gimg" onClick={() => openPhoto(pid, cap)}>
                      <PhotoImg id={pid} className="gpic" />
                      {e.photoIds.length > 1 && <span className="more">+{e.photoIds.length - 1}</span>}
                    </div>
                  ) : (
                    <div className="gimg none">📷<small>No photo</small></div>
                  )}
                  <div className="ginfo">
                    <b>{e.qty} pkt <span className="muted">· {inr(e.qty * pv)}</span></b>
                    <span className="small">{e.reason}{e.loc === 'vehicle' ? ` · ${e.vehicle || 'vehicle'}` : ' · cold room'}</span>
                    <span className="by"><Avatar user={u} size={16} />{u?.name?.split(' ')[0]} · {new Date(e.ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
