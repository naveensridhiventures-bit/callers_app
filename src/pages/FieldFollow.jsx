import { useMemo, useState } from 'react'
import { useApp } from '../store'
import { Icon } from '../ui'
import HotelRow from '../components/HotelRow'
import VisitMode from '../components/VisitMode'
import { useQuickRemark } from '../components/QuickRemark'
import { useGeo } from '../useGeo'
import { pointOf } from '../chennai'
import { addHours, atDay, bucket, dayLabel, km } from '../utils'

const TABS = [['overdue', 'Overdue'], ['today', 'Today'], ['upcoming', 'Upcoming']]

/** FOLLOW-UP: every hotel you promised to go back to, most urgent first. Visit, call or remark in one tap. */
export default function FieldFollow() {
  const { leads, snooze, toast } = useApp()
  const { me } = useGeo()
  const quick = useQuickRemark()
  const [tab, setTab] = useState(null)
  const [run, setRun] = useState(null)

  const by = useMemo(() => {
    const o = { overdue: [], today: [], upcoming: [] }
    leads.filter((l) => l.type === 'hotel').forEach((l) => { const k = bucket(l); if (o[k]) o[k].push(l) })
    Object.values(o).forEach((a) => a.sort((x, y) => new Date(x.nextFollowUp) - new Date(y.nextFollowUp)))
    return o
  }, [leads])

  const active = tab || (by.overdue.length ? 'overdue' : by.today.length ? 'today' : 'upcoming')
  const list = by[active]
  const dueNow = [...by.overdue, ...by.today]
  const dist = (l) => { const p = pointOf(l); return me && p ? km(me, p) : null }

  return (
    <div className="page fp">
      <div className="page-h"><h1>Follow-ups <small>{dueNow.length} due</small></h1></div>

      <div className="fp-tabs" role="tablist">
        {TABS.map(([id, t]) => (
          <button key={id} role="tab" aria-selected={active === id} className={`${active === id ? 'on' : ''} ${id === 'overdue' && by.overdue.length ? 'red' : ''}`} onClick={() => setTab(id)}>
            {t}<b>{by[id].length}</b>
          </button>
        ))}
      </div>

      {dueNow.length > 0 && active !== 'upcoming' && (
        <button className="fp-startdue" onClick={() => setRun({ stops: dueNow, label: 'Follow-ups' })}>
          <Icon name="play" size={18} /> Visit all {dueNow.length} due hotel{dueNow.length > 1 ? 's' : ''}, nearest first
        </button>
      )}

      {list.map((l) => (
        <div key={l.id}>
          {active === 'upcoming' && <div className="day-h"><b>{dayLabel(l.nextFollowUp)}</b></div>}
          <HotelRow lead={l} d={dist(l)} onRemark={quick.open} onVisit={(h) => setRun({ stops: [h], label: h.name })}>
            <div className="snooze">
              <small>Move to:</small>
              <button onClick={() => { snooze(l, addHours(1)); toast('Moved +1 hour') }}>+1h</button>
              <button onClick={() => { snooze(l, atDay(0, 17)); toast('Moved to 5 PM') }}>5 PM</button>
              <button onClick={() => { snooze(l, atDay(1, 11)); toast('Moved to tomorrow') }}>Tomorrow</button>
              <button onClick={() => { snooze(l, atDay(7, 11)); toast('Moved to next week') }}>Next week</button>
            </div>
          </HotelRow>
        </div>
      ))}

      {!list.length && (
        <div className="card empty">
          <div className="empty-ico">🎯</div>
          <h3>{active === 'upcoming' ? 'No upcoming follow-ups' : 'You are all caught up!'}</h3>
          <p>Every visit you save with a next follow-up date shows up here.</p>
        </div>
      )}

      {quick.node}
      {run && <VisitMode stops={run.stops} areaLabel={run.label} onClose={() => setRun(null)} />}
    </div>
  )
}
