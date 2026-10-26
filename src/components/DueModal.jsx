import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../store'
import { Avatar, Icon } from '../ui'
import { addHours, atDay, bucket, fmtWhen, nameOf, telHref, waHref } from '../utils'

const KEY_SHOWN = 'sridhi.dueShown'
const KEY_UNTIL = 'sridhi.dueUntil'
const get = (k) => { try { return sessionStorage.getItem(k) } catch { return null } }
const put = (k, v) => { try { sessionStorage.setItem(k, v) } catch {} }
const daysLate = (iso) => Math.max(1, Math.round((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 864e5))

/* Pops up after login / app open with everything that is overdue or due today. */
export default function DueModal() {
  const { leads, snooze, startCall, openLead, go, pendingCall, sheet } = useApp()
  const [open, setOpen] = useState(false)
  const due = useMemo(() => {
    const rows = leads.map((l) => ({ l, b: bucket(l) })).filter((x) => x.b === 'overdue' || x.b === 'today')
    return rows.sort((a, b) => new Date(a.l.nextFollowUp) - new Date(b.l.nextFollowUp))
  }, [leads])
  const overdue = due.filter((x) => x.b === 'overdue').length

  // decide when to show: first open of the session, after "remind later" expires, after a long absence
  useEffect(() => {
    let hiddenAt = 0
    const check = () => {
      const until = +get(KEY_UNTIL) || 0
      if (!get(KEY_SHOWN) || (until && Date.now() > until)) { put(KEY_SHOWN, '1'); put(KEY_UNTIL, ''); setOpen(true) }
    }
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now()
      else {
        if (hiddenAt && Date.now() - hiddenAt > 30 * 60000) { put(KEY_UNTIL, '1'); setOpen(true) }
        check()
      }
    }
    const t = setTimeout(check, 900)
    const iv = setInterval(check, 20000)
    document.addEventListener('visibilitychange', onVis)
    return () => { clearTimeout(t); clearInterval(iv); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  if (!open || !due.length || pendingCall || sheet) return null
  const later = () => { put(KEY_UNTIL, String(Date.now() + 30 * 60000)); setOpen(false) }
  const close = () => { put(KEY_UNTIL, ''); setOpen(false) }
  const callNow = (e, l) => {
    if (!startCall(l)) { e.preventDefault(); return }
    put(KEY_UNTIL, String(Date.now() + 30 * 60000)); setOpen(false)
    openLead(l.id, { calling: true })
  }

  return (
    <div className="ov-back due-back" onClick={later}>
      <div className="due-card" onClick={(e) => e.stopPropagation()}>
        <div className="due-top">
          <div className="due-bell">🔔</div>
          <div>
            <h3>{overdue ? 'Follow-ups need you' : 'Follow-ups today'}</h3>
            <p>{overdue ? <><b className="red">{overdue} overdue</b> · </> : null}{due.length - overdue} due today</p>
          </div>
          <button className="due-x" onClick={later} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>
        <div className="due-list">
          {due.map(({ l, b }) => (
            <div key={l.id} className={`due-row ${b}`}>
              <Avatar name={nameOf(l)} size={38} />
              <div className="due-info">
                <b>{nameOf(l)}</b>
                <span>{b === 'overdue' ? `${daysLate(l.nextFollowUp)} day${daysLate(l.nextFollowUp) > 1 ? 's' : ''} overdue` : fmtWhen(l.nextFollowUp)}{l.area ? ` · ${l.area}` : ''}</span>
                {l.lastRemark && <em>“{l.lastRemark}”</em>}
              </div>
              <div className="due-acts">
                <a className="round call" href={telHref(l.phone)} onClick={(e) => callNow(e, l)} aria-label="Call"><Icon name="phone" size={16} /></a>
                <a className="round wa" href={waHref(l.phone)} target="_blank" rel="noreferrer" aria-label="WhatsApp"><Icon name="whatsapp" size={16} /></a>
                <button className="round" title="+1 hour" onClick={() => snooze(l, addHours(1))}>1h</button>
                <button className="round" title="Tomorrow" onClick={() => snooze(l, atDay(1, 10))}>+1d</button>
              </div>
            </div>
          ))}
        </div>
        <button className="btn3d" onClick={() => { close(); go('call') }}>Start calling</button>
        <button className="due-later" onClick={later}>Remind me in 30 min</button>
      </div>
    </div>
  )
}
