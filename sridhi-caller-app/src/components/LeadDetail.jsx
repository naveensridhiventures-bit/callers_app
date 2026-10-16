import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useApp } from '../store'
import { Avatar, Confetti, Icon, Segmented, Sheet, StatusPill } from '../ui'
import { CLOSED, OUTCOMES, PRIORITIES, QUICK_REMARKS, STATUSES } from '../constants'
import {
  addHours, atDay, downloadICS, fmtDur, fmtWhen, fromLocalInput, gcalLink, gmailLink,
  suggestNext, telHref, toLocalInput, waHref,
} from '../utils'

export default function LeadDetail({ id, calling, onClose }) {
  const { leads, logCall, removeLead, openForm, settings, toast, go } = useApp()
  const lead = leads.find((l) => l.id === id)
  const [tab, setTab] = useState('call')
  const [started, setStarted] = useState(calling ? Date.now() : null)
  const [, tick] = useState(0)
  const [outcome, setOutcome] = useState('')
  const [remark, setRemark] = useState('')
  const [priority, setPriority] = useState(lead?.priority || 'Warm')
  const [status, setStatus] = useState(lead?.status || 'New')
  const [next, setNext] = useState('')
  const [done, setDone] = useState(null)

  useEffect(() => {
    if (!started) return
    const t = setInterval(() => tick((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [started])

  if (!lead) return null
  const secs = started ? Math.floor((Date.now() - started) / 1000) : 0
  const remarks = QUICK_REMARKS[lead.type] || QUICK_REMARKS.distributor
  const waText = `Hi ${lead.name}, this is ${settings.name || 'the team'} from Sridhi Premium Idli & Dosa Batter. Thank you for your time. Soft idlies & crispy dosas - no preservatives, RO purified water, naturally fermented. 🌿`

  const pick = (o) => {
    setOutcome(o.id)
    if (o.status) setStatus(o.status)
    setNext(suggestNext(o.id))
  }
  const toggleRemark = (r) => setRemark((cur) => (cur.includes(r) ? cur.replace(r, '').replace(/^[,\s]+|[,\s]+$/g, '').replace(/,\s*,/g, ',') : cur ? `${cur}, ${r}` : r))

  const save = () => {
    if (!outcome) return toast('Pick the call outcome first', 'warn')
    const updated = logCall(lead, { outcome, remark: remark.trim(), next, status, priority, duration: secs })
    setDone({ lead: updated, outcome })
    setStarted(null)
  }

  const reset = () => {
    setDone(null); setOutcome(''); setRemark(''); setNext(''); setStatus(lead.status); setTab('call')
  }

  const quick = [
    ['In 1 hour', addHours(1)], ['Today 5 PM', atDay(0, 17)], ['Tomorrow 10 AM', atDay(1, 10)],
    ['In 3 days', atDay(3, 10)], ['Next week', atDay(7, 10)],
  ]

  const info = [
    ['Phone', lead.phone], ['Alt phone', lead.altPhone], ['Email', lead.email], ['Business', lead.company],
    ['Type', lead.bizType], ['Area', lead.area], ['Source', lead.source], ['Priority', lead.priority],
    ['Investment', lead.investment], ['Own vehicle', lead.vehicle], ['Cold storage', lead.coldStorage],
    ['FMCG exp (yrs)', lead.experience], ['Packets / day', lead.dailyQty], ['Calls made', lead.callCount || 0],
    ['Notes', lead.notes],
  ].filter(([, v]) => v !== '' && v != null)

  return (
    <Sheet onClose={onClose}>
      <div className="detail-head">
        <div className="dh-row">
          <Avatar name={lead.name} size={56} />
          <div className="dh-main">
            <h2>{lead.name}</h2>
            <p>{lead.company ? `${lead.company} · ` : ''}{lead.area || 'Bengaluru'}</p>
            <div className="dh-tags"><StatusPill status={lead.status} /><span className="tag light">{lead.type === 'sales' ? 'Sales' : 'Distributor'}</span></div>
          </div>
          <button className="icon-btn light" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="dh-actions">
          <motion.a whileTap={{ scale: 0.94 }} className="act call" href={telHref(lead.phone)} onClick={() => { setStarted(Date.now()); setTab('call') }}>
            <Icon name="phone" /> {started ? <span className="live"><i />{fmtDur(secs)}</span> : 'Call'}
          </motion.a>
          <motion.a whileTap={{ scale: 0.94 }} className="act wa" href={waHref(lead.phone, waText)} target="_blank" rel="noreferrer"><Icon name="whatsapp" /> WhatsApp</motion.a>
          {lead.email && <motion.a whileTap={{ scale: 0.94 }} className="act" href={`mailto:${lead.email}`}><Icon name="mail" /></motion.a>}
        </div>
        {lead.nextFollowUp && !CLOSED.includes(lead.status) && (
          <div className="dh-next"><Icon name="clock" size={14} /> Next follow-up: <b>{fmtWhen(lead.nextFollowUp)}</b></div>
        )}
      </div>

      <div className="sheet-body tight">
        <Segmented id="ld-tab" value={tab} onChange={setTab}
          options={[{ value: 'call', label: '📞 Log call' }, { value: 'history', label: `🕘 History (${lead.calls?.length || 0})` }, { value: 'info', label: 'ℹ️ Info' }]} />

        <AnimatePresence mode="wait">
          {tab === 'call' && !done && (
            <motion.div key="call" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              {lead.lastRemark && <div className="last-remark">Last: <b>{lead.lastOutcome}</b> — {lead.lastRemark}</div>}
              <h4 className="lbl">What happened?</h4>
              <div className="outcomes">
                {OUTCOMES.map((o, i) => (
                  <motion.button
                    key={o.id} type="button" className={`oc ${outcome === o.id ? 'on' : ''}`}
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}
                    whileTap={{ scale: 0.92 }} onClick={() => pick(o)}
                  >
                    <em>{o.icon}</em>{o.id}
                  </motion.button>
                ))}
              </div>

              <h4 className="lbl">Remark</h4>
              <div className="chips small">
                {remarks.map((r) => (
                  <button type="button" key={r} className={`chip ${remark.includes(r) ? 'on' : ''}`} onClick={() => toggleRemark(r)}>{r}</button>
                ))}
              </div>
              <textarea rows={3} value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Type what the person said…" />

              <div className="grid2">
                <div className="field"><span>Temperature</span>
                  <Segmented id="ld-pri" value={priority} onChange={setPriority}
                    options={PRIORITIES.map((p) => ({ value: p, label: p === 'Hot' ? '🔥' : p === 'Warm' ? '🌤' : '❄️' }))} />
                </div>
                <label className="field"><span>Status</span>
                  <select value={status} onChange={(e) => setStatus(e.target.value)}>
                    {STATUSES.map((s) => <option key={s.id}>{s.id}</option>)}
                  </select>
                </label>
              </div>

              {!CLOSED.includes(status) && (
                <>
                  <h4 className="lbl">Next follow-up</h4>
                  <div className="chips small">
                    {quick.map(([l, v]) => (
                      <button type="button" key={l} className={`chip ${next && Math.abs(new Date(next) - new Date(v)) < 60000 ? 'on' : ''}`} onClick={() => setNext(v)}>{l}</button>
                    ))}
                  </div>
                  <input type="datetime-local" value={toLocalInput(next)} onChange={(e) => setNext(fromLocalInput(e.target.value))} />
                </>
              )}

              <motion.button whileTap={{ scale: 0.97, y: 3 }} className="btn3d big" onClick={save}>
                <Icon name="check" /> Save call &amp; follow-up
              </motion.button>
            </motion.div>
          )}

          {tab === 'call' && done && (
            <motion.div key="done" className="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              {done.outcome === 'Onboarded' && <Confetti />}
              <motion.div className="done-check" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}>
                <Icon name="check" size={38} />
              </motion.div>
              <h3>{done.outcome === 'Onboarded' ? 'Distributor onboarded! 🎉' : 'Call saved'}</h3>
              {done.lead.nextFollowUp ? (
                <>
                  <p>Follow-up set for <b>{fmtWhen(done.lead.nextFollowUp)}</b>. Add a reminder so you never miss it:</p>
                  <div className="remind">
                    <a className="btn-soft" href={gcalLink(done.lead)} target="_blank" rel="noreferrer"><Icon name="calendar" /> Google Calendar</a>
                    <a className="btn-soft" href={gmailLink(done.lead, settings.email)} target="_blank" rel="noreferrer"><Icon name="mail" /> Gmail reminder</a>
                    <button className="btn-soft" onClick={() => { downloadICS([done.lead]); toast('Calendar file downloaded') }}><Icon name="download" /> .ics file</button>
                  </div>
                  {!settings.email && <small className="hint">Tip: add your Gmail in More → Settings so reminder mails go to you.</small>}
                </>
              ) : <p>No further follow-up needed for this lead.</p>}
              <div className="done-actions">
                <button className="btn-soft" onClick={reset}>Log another</button>
                <button className="btn3d" onClick={onClose}>Done</button>
              </div>
            </motion.div>
          )}

          {tab === 'history' && (
            <motion.div key="hist" className="timeline" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {!lead.calls?.length && <p className="empty-s">No calls logged yet. Make the first call! 📞</p>}
              {lead.calls?.map((c, i) => (
                <motion.div key={c.id} className="tl" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                  <i>{OUTCOMES.find((o) => o.id === c.outcome)?.icon || '📞'}</i>
                  <div>
                    <b>{c.outcome}</b>
                    <small>{new Date(c.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}{c.duration ? ` · ${fmtDur(c.duration)}` : ''}{c.by ? ` · ${c.by}` : ''}</small>
                    {c.remark && <p>{c.remark}</p>}
                    {c.next && <span className="due upcoming"><Icon name="clock" size={11} /> Next: {fmtWhen(c.next)}</span>}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {tab === 'info' && (
            <motion.div key="info" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="info">
                {info.map(([k, v], i) => (
                  <motion.div key={k} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.025 }}>
                    <small>{k}</small><b>{String(v)}</b>
                  </motion.div>
                ))}
              </div>
              {lead.nextFollowUp && !CLOSED.includes(lead.status) && (
                <div className="remind">
                  <a className="btn-soft" href={gcalLink(lead)} target="_blank" rel="noreferrer"><Icon name="calendar" /> Calendar</a>
                  <a className="btn-soft" href={gmailLink(lead, settings.email)} target="_blank" rel="noreferrer"><Icon name="mail" /> Gmail reminder</a>
                  <button className="btn-soft" onClick={() => downloadICS([lead])}><Icon name="download" /> .ics</button>
                </div>
              )}
              <div className="done-actions">
                <button className="btn-soft" onClick={() => { onClose(); setTimeout(() => openForm(lead), 250) }}><Icon name="edit" /> Edit</button>
                <button className="btn-soft danger" onClick={() => { if (confirm(`Delete ${lead.name}?`)) { removeLead(lead.id); onClose(); toast('Lead deleted') } }}><Icon name="trash" /> Delete</button>
                <button className="btn-soft" onClick={() => { onClose(); go('more', 'scripts') }}><Icon name="book" /> Scripts</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Sheet>
  )
}
