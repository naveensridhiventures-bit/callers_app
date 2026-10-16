import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../store'
import { Counter, Icon, Segmented, Tilt } from '../ui'
import { OUTCOMES, STATUSES } from '../constants'
import { download, sameDay, toCSV } from '../utils'

export default function Reports() {
  const { leads } = useApp()
  const [range, setRange] = useState('7')

  const r = useMemo(() => {
    const days = Number(range)
    const since = new Date(); since.setHours(0, 0, 0, 0); since.setDate(since.getDate() - (days - 1))
    const calls = leads.flatMap((l) => (l.calls || []).map((c) => ({ ...c, lead: l }))).filter((c) => new Date(c.at) >= since)
    const connected = calls.filter((c) => OUTCOMES.find((o) => o.id === c.outcome)?.connected).length
    const outcomes = OUTCOMES.filter((o) => !o.hidden).map((o) => ({ ...o, n: calls.filter((c) => c.outcome === o.id).length }))
    const series = Array.from({ length: Math.min(days, 14) }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (Math.min(days, 14) - 1 - i))
      return { l: d.getDate(), n: calls.filter((c) => sameDay(c.at, d)).length }
    })
    const areaMap = {}
    leads.forEach((l) => {
      const a = l.area || 'Unknown'
      areaMap[a] = areaMap[a] || { area: a, total: 0, hot: 0, won: 0 }
      areaMap[a].total++
      if (l.priority === 'Hot') areaMap[a].hot++
      if (l.status === 'Onboarded') areaMap[a].won++
    })
    const areas = Object.values(areaMap).sort((a, b) => b.total - a.total).slice(0, 8)
    const talk = calls.reduce((s, c) => s + (c.duration || 0), 0)
    return {
      calls: calls.length, connected, pct: calls.length ? Math.round((connected / calls.length) * 100) : 0,
      interested: calls.filter((c) => c.outcome === 'Interested').length,
      won: calls.filter((c) => c.outcome === 'Onboarded').length,
      outcomes, series, areas, talk: Math.round(talk / 60),
    }
  }, [leads, range])

  const maxO = Math.max(1, ...r.outcomes.map((o) => o.n))
  const maxS = Math.max(1, ...r.series.map((s) => s.n))
  const total = leads.length
  const won = leads.filter((l) => l.status === 'Onboarded').length

  const exportLeads = () => {
    const cols = ['name', 'phone', 'type', 'company', 'area', 'status', 'priority', 'source', 'nextFollowUp', 'lastOutcome', 'lastRemark', 'callCount', 'notes']
    download('sridhi-leads.csv', toCSV(leads, cols), 'text/csv')
  }
  const exportCalls = () => {
    const rows = leads.flatMap((l) => (l.calls || []).map((c) => ({ ...c, name: l.name, phone: l.phone, area: l.area })))
    download('sridhi-call-log.csv', toCSV(rows, ['at', 'name', 'phone', 'area', 'outcome', 'remark', 'next', 'duration', 'by']), 'text/csv')
  }

  return (
    <div className="sub">
      <Segmented id="rep-range" value={range} onChange={setRange} options={[{ value: '1', label: 'Today' }, { value: '7', label: '7 days' }, { value: '30', label: '30 days' }]} />

      <div className="kpis">
        {[['📞', 'Calls', r.calls], ['✅', 'Connected', r.pct, '%'], ['🔥', 'Interested', r.interested], ['🎉', 'Onboarded', r.won]].map(([e, l, v, suf], i) => (
          <Tilt key={l} className="kpi" max={9} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
            <em>{e}</em><b><Counter value={v} />{suf}</b><span>{l}</span>
          </Tilt>
        ))}
      </div>
      <div className="mini-note">🕘 {r.talk} min talk time logged</div>

      <section className="card">
        <div className="sec-h"><h3>Daily calls</h3></div>
        <div className="bars">
          {r.series.map((s, i) => (
            <div key={i} className="bar">
              <motion.i initial={{ height: 0 }} animate={{ height: `${(s.n / maxS) * 100}%` }} transition={{ delay: i * 0.04, type: 'spring', stiffness: 120, damping: 14 }} style={{ minHeight: s.n ? 6 : 3 }} />
              <b>{s.n}</b><span>{s.l}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="sec-h"><h3>Call outcomes</h3></div>
        <div className="funnel">
          {r.outcomes.map((o, i) => (
            <div key={o.id} className="frow">
              <span>{o.icon} {o.id}</span>
              <div><motion.i initial={{ width: 0 }} animate={{ width: `${(o.n / maxO) * 100}%` }} transition={{ delay: i * 0.05, duration: 0.7 }} style={{ background: 'var(--g500)' }} /></div>
              <b>{o.n}</b>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="sec-h"><h3>Hiring funnel</h3><small>{total ? Math.round((won / total) * 100) : 0}% converted</small></div>
        <div className="funnel">
          {STATUSES.map((s, i) => {
            const n = leads.filter((l) => l.status === s.id).length
            return (
              <div key={s.id} className="frow">
                <span>{s.id}</span>
                <div><motion.i initial={{ width: 0 }} animate={{ width: `${total ? (n / total) * 100 : 0}%` }} transition={{ delay: i * 0.05, duration: 0.7 }} style={{ background: s.color }} /></div>
                <b>{n}</b>
              </div>
            )
          })}
        </div>
      </section>

      <section className="card">
        <div className="sec-h"><h3>Top Bengaluru areas</h3></div>
        <table className="tbl">
          <thead><tr><th>Area</th><th>Leads</th><th>Hot</th><th>Won</th></tr></thead>
          <tbody>{r.areas.map((a) => <tr key={a.area}><td>{a.area}</td><td>{a.total}</td><td>{a.hot}</td><td>{a.won}</td></tr>)}</tbody>
        </table>
        {!r.areas.length && <p className="empty-s">No data yet.</p>}
      </section>

      <div className="row-btns">
        <button className="btn-soft" onClick={exportLeads}><Icon name="download" /> Export leads CSV</button>
        <button className="btn-soft" onClick={exportCalls}><Icon name="download" /> Export call log</button>
      </div>
    </div>
  )
}
