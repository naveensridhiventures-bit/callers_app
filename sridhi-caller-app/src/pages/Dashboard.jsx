import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../store'
import { Counter, Icon, Ring, Tilt } from '../ui'
import LeadCard from '../components/LeadCard'
import { CLOSED, OUTCOMES, STATUSES } from '../constants'
import { bucket, greeting, sameDay } from '../utils'

function Stat({ emoji, label, value, hint, color, action }) {
  const [flip, setFlip] = useState(false)
  return (
    <Tilt className="stat-wrap" max={8}>
      <motion.div className="stat" animate={{ rotateY: flip ? 180 : 0 }} transition={{ type: 'spring', stiffness: 130, damping: 16 }} onClick={() => setFlip((f) => !f)}>
        <div className="face-a" style={{ '--c': color }}>
          <em>{emoji}</em>
          <b><Counter value={value} /></b>
          <span>{label}</span>
        </div>
        <div className="face-b" style={{ '--c': color }}>
          <p>{hint}</p>
          <button onClick={(e) => { e.stopPropagation(); setFlip(false); action() }}>View <Icon name="chevron" size={14} /></button>
        </div>
      </motion.div>
    </Tilt>
  )
}

export default function Dashboard() {
  const { leads, settings, go, openForm, openLead, setFilter, loadSample } = useApp()

  const s = useMemo(() => {
    const now = new Date()
    const calls = leads.flatMap((l) => l.calls || [])
    const today = calls.filter((c) => sameDay(c.at, now))
    const connected = today.filter((c) => OUTCOMES.find((o) => o.id === c.outcome)?.connected).length
    const by = { overdue: [], today: [], upcoming: [] }
    leads.forEach((l) => { const k = bucket(l); if (by[k]) by[k].push(l) })
    Object.values(by).forEach((a) => a.sort((x, y) => new Date(x.nextFollowUp) - new Date(y.nextFollowUp)))
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i))
      return { label: d.toLocaleDateString('en-IN', { weekday: 'short' }).slice(0, 2), n: calls.filter((c) => sameDay(c.at, d)).length }
    })
    const funnel = STATUSES.map((st) => ({ ...st, n: leads.filter((l) => l.status === st.id).length }))
    return {
      callsToday: today.length, connected, by, week, funnel,
      hot: leads.filter((l) => l.priority === 'Hot' && !CLOSED.includes(l.status)).length,
      onboarded: leads.filter((l) => l.status === 'Onboarded').length,
      fresh: leads.filter((l) => !l.callCount && l.status === 'New').length,
    }
  }, [leads])

  const upNext = [...s.by.overdue, ...s.by.today].slice(0, 4)
  const maxW = Math.max(1, ...s.week.map((w) => w.n))
  const maxF = Math.max(1, ...s.funnel.map((f) => f.n))
  const filterTo = (status) => { setFilter({ q: '', type: 'all', status }); go('leads') }

  return (
    <div className="page">
      <Tilt className="hero" max={3}>
        <div className="orbs"><i /><i /><i /></div>
        <div className="hero-3d">
          <div className="fl a">📞</div><div className="fl b">🥞</div><div className="fl c">🌿</div>
        </div>
        <div className="hero-text">
          <small>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</small>
          <h1>{greeting()},<br />{settings.name || 'Caller'} 👋</h1>
          <p>{s.by.overdue.length + s.by.today.length > 0
            ? <>You have <b>{s.by.overdue.length + s.by.today.length}</b> follow-ups waiting.</>
            : 'Inbox zero! Time to call fresh leads 🌟'}</p>
          <motion.button whileTap={{ scale: 0.95, y: 3 }} className="btn3d lime" onClick={() => go('call')}>
            <Icon name="play" size={16} /> Start Call Mode
          </motion.button>
        </div>
        <div className="hero-ring">
          <Ring value={s.callsToday} max={settings.target || 60}>
            <b><Counter value={s.callsToday} /></b>
            <small>of {settings.target || 60} calls</small>
          </Ring>
          <span className="conn">{s.connected} connected today</span>
        </div>
      </Tilt>

      {leads.length === 0 && (
        <motion.div className="card empty" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="empty-ico">🌿</div>
          <h3>Welcome to Sridhi Caller</h3>
          <p>Add your first distributor lead, import the company data, or look around with sample data.</p>
          <div className="row-btns">
            <button className="btn3d" onClick={() => openForm()}><Icon name="plus" /> Add lead</button>
            <button className="btn-soft" onClick={() => go('more', 'settings')}><Icon name="upload" /> Import data</button>
            <button className="btn-soft" onClick={loadSample}>Load sample</button>
          </div>
        </motion.div>
      )}

      <div className="stats">
        <Stat emoji="⏰" label="Overdue" value={s.by.overdue.length} color="#ef4444" hint="Follow-ups you missed. Call them first!" action={() => go('follow')} />
        <Stat emoji="📅" label="Due today" value={s.by.today.length} color="#f59e0b" hint="Calls scheduled for the rest of today." action={() => go('follow')} />
        <Stat emoji="🔥" label="Hot leads" value={s.hot} color="#f97316" hint="Highly interested distributors." action={() => { setFilter({ q: '', type: 'all', status: 'all' }); go('leads') }} />
        <Stat emoji="🎉" label="Onboarded" value={s.onboarded} color="#16a34a" hint="Distributors successfully hired." action={() => filterTo('Onboarded')} />
      </div>

      {upNext.length > 0 && (
        <section>
          <div className="sec-h"><h3>Up next</h3><button onClick={() => go('follow')}>See all <Icon name="chevron" size={14} /></button></div>
          <div className="list">{upNext.map((l, i) => <LeadCard key={l.id} lead={l} i={i} />)}</div>
        </section>
      )}

      <div className="two">
        <motion.section className="card" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <div className="sec-h"><h3>Calls this week</h3></div>
          <div className="bars">
            {s.week.map((w, i) => (
              <div key={i} className="bar">
                <motion.i initial={{ height: 0 }} whileInView={{ height: `${(w.n / maxW) * 100}%` }} viewport={{ once: true }} transition={{ delay: i * 0.07, type: 'spring', stiffness: 120, damping: 14 }} style={{ minHeight: w.n ? 6 : 3 }} />
                <b>{w.n}</b><span>{w.label}</span>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section className="card" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <div className="sec-h"><h3>Pipeline</h3><small>{s.fresh} fresh leads uncalled</small></div>
          <div className="funnel">
            {s.funnel.map((f, i) => (
              <button key={f.id} onClick={() => filterTo(f.id)}>
                <span>{f.id}</span>
                <div><motion.i style={{ background: f.color }} initial={{ width: 0 }} whileInView={{ width: `${Math.max(f.n ? 6 : 0, (f.n / maxF) * 100)}%` }} viewport={{ once: true }} transition={{ delay: i * 0.06, duration: 0.7 }} /></div>
                <b>{f.n}</b>
              </button>
            ))}
          </div>
        </motion.section>
      </div>
    </div>
  )
}
