import { useMemo } from 'react'
import { useApp } from '../store'
import { DELIVERED, PAID, dueText, inr, owingList } from '../stock'
import { fmtTime, isToday } from '../utils'

/** STOCK: deliver packets, collect cash, see who owes what and when it is due */
export default function FieldStock() {
  const { leads, openStock, openLead } = useApp()
  const owing = useMemo(() => owingList(leads), [leads])
  const owed = owing.reduce((t, x) => t + x.L.outstanding, 0)
  const today = useMemo(() => {
    const o = []
    leads.filter((l) => l.type === 'milk').forEach((l) => (l.calls || []).forEach((c) => { if ((c.outcome === DELIVERED || c.outcome === PAID) && isToday(c.at)) o.push({ l, c }) }))
    return o.sort((a, b) => b.c.at.localeCompare(a.c.at))
  }, [leads])
  const t = today.reduce((s, { c }) => {
    if (c.outcome === DELIVERED) { s.p += Number(c.dlPackets) || 0; s.b += Number(c.dlAmt) || 0; s.c += Number(c.dlCollected) || 0 } else s.c += Number(c.payAmt) || 0
    return s
  }, { p: 0, b: 0, c: 0 })

  return (
    <div className="page st-page">
      <div className="page-h"><h1>Stock &amp; cash <small>₹35 / packet</small></h1></div>

      <div className="st-act">
        <button type="button" className="btn3d lime big" onClick={() => openStock({ mode: 'deliver' })}><span>📦</span> Deliver stock</button>
        <button type="button" className="btn3d big st-pay-b" onClick={() => openStock({ mode: 'pay' })}><span>💰</span> Collect payment</button>
      </div>

      <div className="kpis">
        <div className="kpi"><em>📦</em><b>{t.p}</b><span>Packets today</span></div>
        <div className="kpi"><em>🧾</em><b>{inr(t.b)}</b><span>Billed today</span></div>
        <div className="kpi"><em>💵</em><b>{inr(t.c)}</b><span>Cash collected</span></div>
        <div className="kpi warn"><em>⏳</em><b>{inr(owed)}</b><span>Still to collect</span></div>
      </div>

      <h3 className="st-h">💰 Payments to collect <small>{owing.length}</small></h3>
      {owing.length === 0 && <div className="card empty"><div className="empty-ico">🎉</div><h3>No pending payments</h3><p>When you deliver on credit, the due date shows here and you get a reminder.</p></div>}
      {owing.map(({ lead: l, L, s }) => (
        <div key={l.id} className={`st-card ${s.k}`}>
          <div onClick={() => openLead(l.id)}>
            <b>{l.name}</b>
            <small>📍 {l.area || 'Chennai'}{l.phone ? ` · ${l.phone}` : ''}</small>
            <span className={`st-chip ${s.k}`}>{dueText(s)}</span>
          </div>
          <div className="st-amt"><b>{inr(L.outstanding)}</b>
            <button type="button" className="btn-soft sm" onClick={() => openStock({ mode: 'pay', id: l.id })}>Collect</button></div>
        </div>
      ))}

      <h3 className="st-h">🕘 Today <small>{today.length}</small></h3>
      {today.length === 0 && <p className="mk-hint">Nothing recorded today yet.</p>}
      {today.map(({ l, c }) => (
        <div key={c.id} className="st-row" onClick={() => openLead(l.id, { tab: 'history' })}>
          <i>{c.outcome === DELIVERED ? '📦' : '💰'}</i>
          <div><b>{l.name}</b><small>{c.remark}</small></div>
          <em>{fmtTime(c.at)}</em>
        </div>
      ))}
    </div>
  )
}
