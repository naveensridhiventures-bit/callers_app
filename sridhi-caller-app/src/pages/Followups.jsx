import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useApp } from '../store'
import { Icon, Segmented } from '../ui'
import LeadCard from '../components/LeadCard'
import { addHours, atDay, bucket, downloadICS, sameDay } from '../utils'

export default function Followups() {
  const { leads, snooze, toast } = useApp()
  const [tab, setTab] = useState('due')
  const [day, setDay] = useState(null)

  const { by, strip } = useMemo(() => {
    const by = { overdue: [], today: [], upcoming: [] }
    leads.forEach((l) => { const k = bucket(l); if (by[k]) by[k].push(l) })
    Object.values(by).forEach((a) => a.sort((x, y) => new Date(x.nextFollowUp) - new Date(y.nextFollowUp)))
    const all = [...by.overdue, ...by.today, ...by.upcoming]
    const strip = Array.from({ length: 10 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() + i)
      return { d, n: all.filter((l) => sameDay(l.nextFollowUp, d)).length }
    })
    return { by, strip }
  }, [leads])

  const all = [...by.overdue, ...by.today, ...by.upcoming]
  const shown = day ? all.filter((l) => sameDay(l.nextFollowUp, day)) : tab === 'due' ? [...by.overdue, ...by.today] : by.upcoming

  const exportAll = () => {
    const n = downloadICS(all)
    toast(n ? `${n} follow-ups saved to calendar file 📅` : 'No follow-ups to export', n ? 'ok' : 'warn')
  }

  return (
    <div className="page">
      <div className="page-h">
        <h1>Follow-ups</h1>
        <button className="btn-soft sm" onClick={exportAll}><Icon name="calendar" size={16} /> Export all</button>
      </div>

      <div className="strip">
        {strip.map(({ d, n }, i) => {
          const on = day && sameDay(day, d)
          return (
            <motion.button key={i} className={`day ${on ? 'on' : ''}`} whileTap={{ scale: 0.92 }}
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              onClick={() => setDay(on ? null : d)}>
              <small>{i === 0 ? 'Today' : d.toLocaleDateString('en-IN', { weekday: 'short' })}</small>
              <b>{d.getDate()}</b>
              <span className={n ? 'dot has' : 'dot'}>{n || ''}</span>
            </motion.button>
          )
        })}
      </div>

      {!day && (
        <Segmented id="fu-tab" value={tab} onChange={setTab}
          options={[{ value: 'due', label: `⏰ Due now (${by.overdue.length + by.today.length})` }, { value: 'up', label: `🗓 Upcoming (${by.upcoming.length})` }]} />
      )}
      {day && <div className="day-note">Showing {day.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })} · <button onClick={() => setDay(null)}>clear</button></div>}

      {!day && tab === 'due' && by.overdue.length > 0 && <div className="sec-tag red">Overdue · {by.overdue.length}</div>}
      <div className="list">
        <AnimatePresence initial={false}>
          {shown.map((l, i) => (
            <div key={l.id}>
              {!day && tab === 'due' && i === by.overdue.length && by.today.length > 0 && <div className="sec-tag amber">Later today · {by.today.length}</div>}
              <LeadCard lead={l} i={i} />
              <div className="snooze">
                <small>Snooze:</small>
                <button onClick={() => { snooze(l, addHours(1)); toast('Snoozed 1 hour') }}>+1h</button>
                <button onClick={() => { snooze(l, atDay(0, 17)); toast('Moved to 5 PM') }}>5 PM</button>
                <button onClick={() => { snooze(l, atDay(1, 10)); toast('Moved to tomorrow') }}>Tomorrow</button>
              </div>
            </div>
          ))}
        </AnimatePresence>
      </div>

      {shown.length === 0 && (
        <motion.div className="card empty" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <div className="empty-ico">🎯</div>
          <h3>{day ? 'Nothing scheduled this day' : tab === 'due' ? "You're all caught up!" : 'No upcoming follow-ups'}</h3>
          <p>Every call you log with a next follow-up date shows up here.</p>
        </motion.div>
      )}
    </div>
  )
}
