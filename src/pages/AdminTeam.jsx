import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../store'
import { Avatar, Icon, Segmented } from '../ui'
import { INTEREST, ago, allCalls, callerStats, interestOf, pct } from '../analytics'
import { OUTCOMES } from '../constants'
import { nameOf } from '../utils'
import { AddCaller } from './Admin'
import { Bars, InterestBar, Legend } from './AdminOverview'

const PERIODS = [{ value: 'today', label: 'Today' }, { value: '7d', label: '7 days' }, { value: '30d', label: '30 days' }, { value: 'all', label: 'All' }]

function CallerCard({ r, open, onToggle, i }) {
  const { openLead, deleteCaller, go, filter, setFilter, toast } = useApp()
  const [pin, setPin] = useState(false)
  const [lf, setLf] = useState('all')
  const live = r.today > 0
  const leads = useMemo(() => {
    const list = r.mine.filter((l) => lf === 'all' || interestOf(l) === lf)
    return [...list].sort((a, b) => (b.lastCall || b.updatedAt || '').localeCompare(a.lastCall || a.updatedAt || '')).slice(0, 25)
  }, [r.mine, lf])

  return (
    <motion.article layout="position" className={`card cc ${open ? 'open' : ''}`} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
      <header className="cc-h" onClick={onToggle}>
        <div className="cc-av"><Avatar name={r.c.name} size={48} /><i className={live ? 'on' : ''} /></div>
        <div className="cc-name"><b>{r.c.name}</b><small>{live ? '🟢 Active today' : '⚪ Last active'} · {ago(r.lastActive)}</small></div>
        <span className="cc-chev">{open ? '▲' : '▼'}</span>
      </header>

      <div className="cc-kpis">
        <div><b>{r.assigned}</b><small>Assigned</small></div>
        <div><b>{r.calls}</b><small>Calls</small></div>
        <div><b>{pct(r.connected, r.calls)}%</b><small>Connected</small></div>
        <div><b>{r.interest.hot + r.interest.won}</b><small>Interested</small></div>
        <div className={r.fresh ? 'warn' : ''}><b>{r.fresh}</b><small>Not called</small></div>
        <div className={r.overdue ? 'bad' : ''}><b>{r.overdue}</b><small>Overdue</small></div>
      </div>

      <InterestBar interest={r.interest} total={r.assigned} />
      <Legend interest={r.interest} />

      {open && (
        <div className="cc-more pulse-in">
          <h4 className="lbl">Calls, last 7 days</h4>
          <Bars days={r.series} height={92} />

          <h4 className="lbl">Her leads</h4>
          <div className="chips small">
            <button className={`chip ${lf === 'all' ? 'on' : ''}`} onClick={() => setLf('all')}>All {r.assigned}</button>
            {INTEREST.filter((x) => r.interest[x.id]).map((x) => (
              <button key={x.id} className={`chip ${lf === x.id ? 'on' : ''}`} onClick={() => setLf(x.id)}>{x.icon} {x.label} {r.interest[x.id]}</button>
            ))}
          </div>
          <div className="mini-list">
            {leads.map((l) => {
              const it = INTEREST.find((x) => x.id === interestOf(l))
              return (
                <button key={l.id} className="ml-row" onClick={() => openLead(l.id)}>
                  <i style={{ background: it.color }} title={it.label} />
                  <div>
                    <b>{nameOf(l)}</b>
                    <small>{l.lastOutcome ? `${l.lastOutcome}${l.lastRemark ? ` · ${l.lastRemark}` : ''}` : 'Not called yet'}</small>
                  </div>
                  <time>{l.lastCall ? ago(l.lastCall) : l.area || ''}</time>
                </button>
              )
            })}
            {!leads.length && <p className="empty-s">No leads in this group.</p>}
          </div>

          <h4 className="lbl">Recent calls</h4>
          <div className="feed">
            {r.recent.slice(0, 8).map((c, k) => (
              <button key={c.id || k} className="feed-row" onClick={() => openLead(c.lead.id)}>
                <i>{OUTCOMES.find((o) => o.id === c.outcome)?.icon || '📞'}</i>
                <div><b>{nameOf(c.lead)}</b><small>{c.outcome}{c.remark ? ` · ${c.remark}` : ''}</small></div>
                <time>{ago(c.at)}</time>
              </button>
            ))}
            {!r.recent.length && <p className="empty-s">No calls yet.</p>}
          </div>

          <div className="done-actions" style={{ justifyContent: 'flex-start' }}>
            <button className="btn-soft sm" onClick={() => { setFilter({ ...filter, caller: r.c.id }); go('leads') }}><Icon name="users" size={16} /> Open in Leads</button>
            <button className="btn-soft sm" onClick={() => go('assign')}><Icon name="plus" size={16} /> Assign more</button>
            <button className="pin-chip" onClick={() => setPin((v) => !v)}>{pin ? `PIN ${r.c.pin}` : 'PIN ••••'}</button>
            <button className="btn-soft sm danger" onClick={async () => {
              if (confirm(`Remove ${r.c.name}? Her ${r.assigned} leads become unassigned.`)) { await deleteCaller(r.c.id); toast('Caller removed') }
            }}><Icon name="trash" size={16} /> Remove</button>
          </div>
        </div>
      )}
    </motion.article>
  )
}

export default function AdminTeam() {
  const { allLeads, callers } = useApp()
  const [period, setPeriod] = useState('7d')
  const [openId, setOpenId] = useState(null)
  const [add, setAdd] = useState(false)
  const calls = useMemo(() => allCalls(allLeads, callers), [allLeads, callers])
  const stats = useMemo(() => callerStats(allLeads, callers, calls, period), [allLeads, callers, calls, period])

  return (
    <div className="page adm">
      <div className="page-h">
        <h1>Callers <small>{callers.length}</small></h1>
        <button className="btn-soft sm" onClick={() => setAdd((v) => !v)}><Icon name="plus" size={16} /> {add ? 'Close' : 'Add caller'}</button>
      </div>
      {add && <motion.div className="pulse-in" initial={false}><AddCaller onDone={() => setAdd(false)} /></motion.div>}
      <Segmented id="tm-period" value={period} onChange={setPeriod} options={PERIODS} />
      <div className="cc-grid">
        {stats.map((r, i) => <CallerCard key={r.c.id} r={r} i={i} open={openId === r.c.id} onToggle={() => setOpenId(openId === r.c.id ? null : r.c.id)} />)}
      </div>
      {!stats.length && <div className="card empty"><div className="empty-ico">👥</div><h3>No callers yet</h3><p>Tap “Add caller”, give her a name and a 4-digit PIN. She signs in with those on her phone and sees only the numbers you assign.</p></div>}
    </div>
  )
}
