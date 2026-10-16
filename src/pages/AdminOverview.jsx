import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../store'
import { Avatar, Counter, Icon, Segmented } from '../ui'
import { INTEREST, ago, allCalls, callerStats, interestOf, isConnected, lastDays, pct, sinceFor } from '../analytics'
import { OUTCOMES } from '../constants'
import { nameOf } from '../utils'

const PERIODS = [{ value: 'today', label: 'Today' }, { value: '7d', label: '7 days' }, { value: '30d', label: '30 days' }, { value: 'all', label: 'All' }]

export function Bars({ days, height = 120 }) {
  const max = Math.max(1, ...days.map((d) => d.calls))
  return (
    <div className="bars" style={{ height }}>
      {days.map((d, i) => (
        <div key={d.key} className="barcol">
          <small className="bv">{d.calls || ''}</small>
          <div className="bartrack">
            <motion.i className="b-all" initial={{ height: 0 }} animate={{ height: `${(d.calls / max) * 100}%` }} transition={{ delay: i * 0.04, duration: 0.5 }}>
              <motion.i className="b-conn" initial={{ height: 0 }} animate={{ height: d.calls ? `${(d.connected / d.calls) * 100}%` : 0 }} transition={{ delay: 0.3 + i * 0.04, duration: 0.5 }} />
            </motion.i>
          </div>
          <small className={i === days.length - 1 ? 'today' : ''}>{days.length > 8 ? d.d.getDate() : d.d.toLocaleDateString('en-IN', { weekday: 'short' }).slice(0, 3)}</small>
        </div>
      ))}
    </div>
  )
}

export function InterestBar({ interest, total }) {
  return (
    <div className="ibar" title="Interest level of assigned leads">
      {INTEREST.map((i) => (interest[i.id] ? <motion.i key={i.id} style={{ background: i.color }} initial={{ flexGrow: 0 }} animate={{ flexGrow: interest[i.id] }} transition={{ duration: 0.7 }} title={`${i.label}: ${interest[i.id]}`} /> : null))}
      {!total && <i className="empty" style={{ flexGrow: 1 }} />}
    </div>
  )
}

export function Legend({ interest }) {
  return (
    <div className="legend">
      {INTEREST.filter((i) => interest[i.id]).map((i) => <span key={i.id}><i style={{ background: i.color }} />{i.icon} {i.label} <b>{interest[i.id]}</b></span>)}
    </div>
  )
}

export default function AdminOverview() {
  const { allLeads, callers, go, openLead, session } = useApp()
  const [period, setPeriod] = useState('7d')
  const calls = useMemo(() => allCalls(allLeads, callers), [allLeads, callers])
  const stats = useMemo(() => callerStats(allLeads, callers, calls, period), [allLeads, callers, calls, period])

  const d = useMemo(() => {
    const since = sinceFor(period)
    const inP = calls.filter((c) => new Date(c.at) >= since)
    const conn = inP.filter((c) => isConnected(c.outcome)).length
    const now = new Date()
    const assigned = allLeads.filter((l) => l.assignedTo)
    const called = assigned.filter((l) => l.callCount > 0)
    const hot = allLeads.filter((l) => ['hot', 'won'].includes(interestOf(l)))
    const meet = allLeads.filter((l) => ['Meeting Fixed', 'Documentation', 'Onboarded'].includes(l.status))
    return {
      calls: inP.length, conn, rate: pct(conn, inP.length),
      positive: inP.filter((c) => ['Interested', 'Meeting Fixed', 'Onboarded'].includes(c.outcome)).length,
      won: allLeads.filter((l) => l.status === 'Onboarded').length,
      unassigned: allLeads.filter((l) => !l.assignedTo).length,
      overdue: allLeads.filter((l) => l.nextFollowUp && !['Onboarded', 'Not Interested'].includes(l.status) && new Date(l.nextFollowUp) < now).length,
      funnel: [
        ['Assigned', assigned.length, '#94a3b8'], ['Called', called.length, '#38bdf8'],
        ['Interested', hot.length, '#f97316'], ['Meeting+', meet.length, '#eab308'],
        ['Onboarded', allLeads.filter((l) => l.status === 'Onboarded').length, '#16a34a'],
      ],
      series: lastDays(calls, period === '30d' || period === 'all' ? 14 : 7),
      feed: calls.slice(0, 14),
    }
  }, [calls, allLeads, period])

  const ranked = [...stats].sort((a, b) => b.calls - a.calls || b.assigned - a.assigned)
  const maxCalls = Math.max(1, ...ranked.map((r) => r.calls))
  const callerName = (id) => callers.find((c) => c.id === id)?.name || '—'
  const idle = stats.filter((r) => r.today === 0 && r.assigned > 0)

  return (
    <div className="page adm">
      <div className="page-h">
        <h1>Team progress <small>{session?.name}</small></h1>
      </div>
      <Segmented id="ov-period" value={period} onChange={setPeriod} options={PERIODS} />

      <div className="kpis kpis6">
        {[
          ['📞', d.calls, 'Calls made', ''], ['✅', d.rate, 'Connected', '%'], ['🔥', d.positive, 'Positive calls', ''],
          ['🎉', d.won, 'Onboarded (all time)', ''], ['📭', d.unassigned, 'Unassigned leads', ''], ['⏰', d.overdue, 'Overdue follow-ups', ''],
        ].map(([e, v, l, suf], i) => (
          <motion.div key={l} className={`kpi ${l.startsWith('Overdue') && v ? 'warn' : ''}`} initial={{ opacity: 0, y: 16, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: i * 0.05 }}>
            <em>{e}</em><b><Counter value={v} />{suf}</b><span>{l}</span>
          </motion.div>
        ))}
      </div>

      {idle.length > 0 && period === 'today' || (period !== 'today' && idle.length > 0) ? (
        <motion.div className="alert-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <b>⚠️ No calls yet today</b>
          <span>{idle.map((r) => r.c.name).join(', ')}</span>
        </motion.div>
      ) : null}

      <div className="adm-grid">
        <section className="card">
          <h3 className="card-t">📈 Calls per day <small><i className="dot dk" /> connected <i className="dot lt" /> not connected</small></h3>
          <Bars days={d.series} />
        </section>

        <section className="card">
          <h3 className="card-t">🎯 Pipeline</h3>
          <div className="funnel2">
            {d.funnel.map(([l, n, c], i) => (
              <div key={l} className="fn-row">
                <span>{l}</span>
                <div className="fn-track"><motion.i style={{ background: c }} initial={{ width: 0 }} animate={{ width: `${(n / Math.max(1, d.funnel[0][1])) * 100}%` }} transition={{ delay: i * 0.08, duration: 0.6 }} /></div>
                <b>{n}</b>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card">
        <h3 className="card-t">🏆 Caller leaderboard <button className="link-btn dk" onClick={() => go('team')}>Full details →</button></h3>
        {!ranked.length && <p className="empty-s">Add callers in the Callers tab to track their progress.</p>}
        <div className="lb">
          {ranked.map((r, i) => (
            <motion.button key={r.c.id} className="lb-row" onClick={() => go('team')} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
              <span className="rank">{i === 0 && r.calls ? '🥇' : i === 1 && r.calls ? '🥈' : i === 2 && r.calls ? '🥉' : i + 1}</span>
              <Avatar name={r.c.name} size={38} />
              <div className="lb-main">
                <div className="lb-top"><b>{r.c.name}</b><small>{r.calls} calls · {pct(r.connected, r.calls)}% connected · {r.interest.hot + r.interest.won} interested</small></div>
                <div className="lb-track"><motion.i initial={{ width: 0 }} animate={{ width: `${(r.calls / maxCalls) * 100}%` }} transition={{ duration: 0.7, delay: 0.1 + i * 0.05 }} /></div>
              </div>
              <span className="lb-n">{r.assigned}<small>leads</small></span>
            </motion.button>
          ))}
        </div>
      </section>

      <section className="card">
        <h3 className="card-t">⚡ Live activity</h3>
        {!d.feed.length && <p className="empty-s">No calls logged yet. Activity appears here as callers update leads.</p>}
        <div className="feed">
          {d.feed.map((c, i) => (
            <motion.button key={c.id || i} className="feed-row" onClick={() => openLead(c.lead.id)} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <i>{OUTCOMES.find((o) => o.id === c.outcome)?.icon || '📞'}</i>
              <div>
                <b>{callerName(c.callerId)} <em>→</em> {nameOf(c.lead)}</b>
                <small>{c.outcome}{c.remark ? ` · ${c.remark}` : ''}</small>
              </div>
              <time>{ago(c.at)}</time>
            </motion.button>
          ))}
        </div>
      </section>
    </div>
  )
}
