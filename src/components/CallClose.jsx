import { useEffect, useState } from 'react'
import { useApp } from '../store'
import { Avatar, Icon } from '../ui'
import { NUMBER_OUTCOMES } from '../constants'
import { addHours, atDay, fmtWhen, nameOf, suggestNext } from '../utils'

const NO_ANSWER = ['No Response', 'Switched Off', 'Not Reachable', 'Not Answered', 'Busy']
const EMO = { 'No Response': '📵', 'Switched Off': '🔌', 'Not Reachable': '📡', Busy: '⏳', 'Not Answered': '📵', 'Wrong Number': '🚫', 'Call Back Later': '🔁' }

/* Pushes the caller to close every call: ring / no response first, then "spoke to person". */
export default function CallClose() {
  const { pendingCall, pendingSnooze, leads, sheet, logCall, snooze, clearPending, snoozePending, openLead, toast } = useApp()
  const [, tick] = useState(0)
  const [done, setDone] = useState(null) // {lead, outcome, next}
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 2000)
    const v = () => tick((x) => x + 1)
    document.addEventListener('visibilitychange', v)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', v) }
  }, [])

  const lead = pendingCall && leads.find((l) => l.id === pendingCall.leadId)
  // dangling pending for a lead that no longer exists
  useEffect(() => { if (pendingCall && !lead) clearPending() }, [pendingCall, lead, clearPending])

  if (done) {
    const l = leads.find((x) => x.id === done.lead.id) || done.lead
    const setNext = (iso) => { snooze(l, iso); setDone({ ...done, next: iso }) }
    return (
      <div className="ov-back cc-back">
        <div className="cc-card cc-ok">
          <div className="cc-tick">✓</div>
          <h3>{done.outcome} logged</h3>
          {done.next ? <p className="cc-sub">Follow-up set for <b>{fmtWhen(done.next)}</b></p> : <p className="cc-sub">Saved.</p>}
          <div className="cc-chips">
            <button onClick={() => setNext(addHours(1))}>+1 hour</button>
            <button onClick={() => setNext(addHours(3))}>+3 hours</button>
            <button onClick={() => setNext(atDay(1, 10))}>Tomorrow 10 AM</button>
            <button onClick={() => setNext(atDay(2, 10))}>In 2 days</button>
          </div>
          <button className="btn3d" onClick={() => setDone(null)}>Done</button>
        </div>
      </div>
    )
  }

  if (!pendingCall || !lead) return null
  if (sheet?.type === 'detail' && sheet.id === lead.id) return null // she is already filling it in
  const elapsed = Date.now() - pendingCall.at
  const away = pendingCall.away && elapsed > 2500
  const stale = elapsed > 45000 // desktop / dialer that never hid the page
  if (!(away || stale)) return null
  if (pendingSnooze > Date.now()) return null

  const isNum = lead.type === 'number'
  const ring = isNum ? NUMBER_OUTCOMES.filter((o) => o !== 'Call Back Later' && o !== 'Wrong Number') : ['Not Answered', 'Busy']
  const extra = ['Wrong Number']

  const quickLog = (outcome) => {
    const next = NO_ANSWER.includes(outcome) ? suggestNext(outcome) : ''
    logCall(lead, { outcome, remark: '', next })
    setDone({ lead, outcome, next })
  }
  const spoke = () => openLead(lead.id, { outcome: isNum ? 'Call Back Later' : 'Interested', calling: false })

  return (
    <div className="ov-back cc-back">
      <div className="cc-card">
        <div className="cc-head">
          <Avatar name={nameOf(lead)} size={46} />
          <div>
            <small>How did the call go?</small>
            <h3>{nameOf(lead)}</h3>
            <span>{lead.phone}{lead.area ? ` · ${lead.area}` : ''}</span>
          </div>
        </div>
        <p className="cc-lead">Close this call first <em>(ring / no response)</em></p>
        <div className="cc-grid">
          {ring.map((o) => (
            <button key={o} className="cc-opt ring" onClick={() => quickLog(o)}><i>{EMO[o]}</i>{o}</button>
          ))}
          {extra.map((o) => (
            <button key={o} className="cc-opt" onClick={() => quickLog(o)}><i>{EMO[o]}</i>{o}</button>
          ))}
        </div>
        <div className="cc-grid cc-more">
          <button className="cc-opt" onClick={() => openLead(lead.id, { outcome: 'Wrong Audience' })}><i>🎯</i>Wrong Audience</button>
          <button className="cc-opt" onClick={() => openLead(lead.id, { outcome: 'Other' })}><i>✏️</i>Other</button>
        </div>
        <button className="cc-spoke" onClick={spoke}><Icon name="phone" size={18} /> Spoke to the person · add details</button>
        <div className="cc-foot">
          <button onClick={() => { snoozePending(10); toast('Reminder in 10 min. Close the call before the next one', 'warn') }}>Later (10 min)</button>
          <button onClick={() => { clearPending(); toast('Call dismissed') }}>Didn't call</button>
        </div>
      </div>
    </div>
  )
}
