import { useState } from 'react'
import { Avatar } from './ui'
import { prettyDate } from './ledger'

const SEV = { high: ['🔴', 'Serious', '#dc2626'], med: ['🟠', 'Check', '#d97706'], info: ['🔵', 'FYI', '#2563eb'] }

export default function Check({ app, alerts, goDay }) {
  const { users, audit = [] } = app.state
  const [view, setView] = useState('alerts')
  const counts = { high: 0, med: 0, info: 0 }
  alerts.forEach((a) => counts[a.sev]++)

  return (
    <div className="screen">
      <h1 className="title">🔎 Mismatch Check</h1>
      <div className="chips">
        <button className={`chip ${view === 'alerts' ? 'on' : ''}`} onClick={() => setView('alerts')}>Alerts · last 30 days</button>
        <button className={`chip ${view === 'audit' ? 'on' : ''}`} onClick={() => setView('audit')}>Audit log</button>
      </div>

      {view === 'alerts' && (
        <>
          <div className="kpis">
            {Object.entries(SEV).map(([k, [ic, l, c]]) => (
              <div className="kpi" key={k}><span>{ic} {l}</span><b style={{ color: c }}>{counts[k]}</b></div>
            ))}
          </div>
          {alerts.length === 0 && <div className="empty">✅ Everything matches.<br />No stock, cash, photo or closing problems in the last 30 days.</div>}
          <div className="log" style={{ marginTop: 12 }}>
            {alerts.map((a, i) => (
              <button className="entry alert" key={i} onClick={() => goDay(a.date)} style={{ borderLeft: `5px solid ${SEV[a.sev][2]}` }}>
                <div className="entry-mid">
                  <b>{a.text}</b>
                  <span className="muted small">{prettyDate(a.date, { weekday: 'short', day: 'numeric', month: 'short' })} · tap to open the day</span>
                </div>
                <span>{SEV[a.sev][0]}</span>
              </button>
            ))}
          </div>
          <div className="card" style={{ marginTop: 14 }}>
            <b className="small">What is checked automatically</b>
            <ul className="checks">
              <li>Cold room count vs book stock (shortage / extra)</li>
              <li>Days that were never closed</li>
              <li>Negative stock (a purchase or return was not entered)</li>
              <li>Purchase received vs supplier bill</li>
              <li>Vehicle cash collected vs packets sold × rate</li>
              <li>Damage entries without photo proof</li>
              <li>Deleted entries (always logged with reason)</li>
            </ul>
          </div>
        </>
      )}

      {view === 'audit' && (
        <div className="log">
          {audit.length === 0 && <div className="empty">No changes logged yet.</div>}
          {audit.map((a) => {
            const u = users.find((x) => x.id === a.userId)
            return (
              <div className="entry" key={a.id}>
                <Avatar user={u} size={32} />
                <div className="entry-mid">
                  <b className="small">{a.text}</b>
                  <span className="muted small">{u?.name || '—'} · {new Date(a.ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{a.date ? ` · for ${prettyDate(a.date, { day: 'numeric', month: 'short' })}` : ''}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
