import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../store'
import { Avatar, Confetti, Icon, Segmented, Sheet, StatusPill } from '../ui'
import MapButton from './MapPopup'
import FieldStatusPick from './FieldStatusPick'
import { HistoryEditor } from './AdminHotelEditor'
import { RATING_LABEL, Stars, ratingToPriority } from './Stars'
import { AUDIENCES, HOTEL_OUTCOMES, CLOSED, NUMBER_ONLY, NUMBER_OUTCOMES, OUTCOMES, PRIORITIES, QUICK_REMARKS, STATUSES } from '../constants'
import {
  addHours, atDay, downloadICS, fmtDur, fmtWhen, fromLocalInput, gcalLink, gmailLink,
  assignedAtOf, cityOf, fmtAssigned, nameOf, nowISO, suggestNext, telHref, toLocalInput, typeLabel, waHref,
} from '../utils'

export default function LeadDetail({ id, calling, preset, onClose }) {
  const { leads, logCall, removeLead, saveLead, openForm, settings, toast, go, session, callers, assignMany, convertLead, scriptVersion, startCall } = useApp()
  const lead = leads.find((l) => l.id === id)
  const [tab, setTab] = useState(() => (session?.role === 'admin' ? 'history' : 'call'))
  const remarkRef = useRef(null)
  const [started, setStarted] = useState(calling ? Date.now() : null)
  const [, tick] = useState(0)
  const [outcome, setOutcome] = useState(preset || '')
  const [remark, setRemark] = useState('')
  const [priority, setPriority] = useState(lead?.priority || 'Warm')
  const [status, setStatus] = useState(() => (preset && OUTCOMES.find((o) => o.id === preset)?.status) || lead?.status || 'New')
  const [next, setNext] = useState(preset ? suggestNext(preset) : '')
  const [done, setDone] = useState(null)
  const [rating, setRating] = useState(() => Number(lead?.rating) || 0)
  const [mode, setMode] = useState(calling ? 'call' : 'visit')
  const [delOpen, setDelOpen] = useState(false)
  const [otherText, setOtherText] = useState('')
  const [audience, setAudience] = useState('')
  const [audOther, setAudOther] = useState('')
  const [audOpen, setAudOpen] = useState(preset === 'Wrong Audience')
  const [delNote, setDelNote] = useState('')

  useEffect(() => {
    if (!started) return
    const t = setInterval(() => tick((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [started])

  if (!lead) return null
  const isAdmin = session?.role === 'admin'
  const isField = session?.role === 'field'
  const pending = lead.delReq === '1'
  const secs = started ? Math.floor((Date.now() - started) / 1000) : 0
  const isNum = lead.type === 'number'
  const remarks = QUICK_REMARKS[lead.type] || QUICK_REMARKS.distributor
  const isHotel = lead.type === 'hotel'
  const outcomeList = isHotel
    ? HOTEL_OUTCOMES.map((id) => OUTCOMES.find((o) => o.id === id)).filter(Boolean)
    : isNum
    ? OUTCOMES.filter((o) => NUMBER_OUTCOMES.includes(o.id))
    : OUTCOMES.filter((o) => !NUMBER_ONLY.includes(o.id) && !o.hidden && !o.hotel)
  const moveTo = (type) => { convertLead(lead, type); setOutcome(''); toast(`Moved to ${typeLabel(type)} lead ✓ Now call and add the details`) }
  const waText = `Hi ${lead.name || 'there'}, this is ${settings.name || 'the team'} from Sridhi Premium Idli & Dosa Batter. Thank you for your time. Soft idlies & crispy dosas - no preservatives, RO purified water, naturally fermented. 🌿`

  const pick = (o) => {
    setOutcome(o.id)
    if (o.id === 'Wrong Audience') setAudOpen(true)
    if (o.status) setStatus(o.status)
    setNext(suggestNext(o.id))
    // bring the remark + follow-up section up so nobody has to scroll to find it
    setTimeout(() => {
      const el = remarkRef.current
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      el.classList.remove('focus-flash'); void el.offsetWidth; el.classList.add('focus-flash')
    }, 140)
  }
  const toggleRemark = (r) => setRemark((cur) => (cur.includes(r) ? cur.replace(r, '').replace(/^[,\s]+|[,\s]+$/g, '').replace(/,\s*,/g, ',') : cur ? `${cur}, ${r}` : r))

  const save = () => {
    if (!outcome) return toast('Pick the call outcome first', 'warn')
    if (outcome === 'Other' && !otherText.trim()) return toast('Tell us what happened in "Other"', 'warn')
    if (outcome === 'Wrong Audience' && !audience) { setAudOpen(true); return toast('Pick the audience type first', 'warn') }
    const audLabel = audience === 'Other' ? (audOther.trim() || 'Other') : audience
    const parts = []
    if (outcome === 'Other') parts.push(`Other: ${otherText.trim()}`)
    if (outcome === 'Wrong Audience') parts.push(`Wrong audience: ${audLabel}`)
    if (remark.trim()) parts.push(remark.trim())
    const updated = logCall(lead, {
      outcome, remark: parts.join(' · '), next, status, duration: secs,
      priority: isField && rating ? ratingToPriority(rating) : priority,
      ...(isField ? { mode: started ? 'call' : mode, rating: rating || undefined } : {}),
      extra: outcome === 'Wrong Audience' ? { audience: audLabel } : undefined,
    })
    setDone({ lead: updated, outcome })
    setStarted(null)
    setTimeout(() => document.querySelector('.sheet-scroll')?.scrollTo({ top: 0, behavior: 'smooth' }), 60)
  }

  const requestDelete = () => {
    saveLead({ ...lead, delReq: '1', delReqBy: session?.name || settings.name || 'Caller', delReqAt: nowISO(), delReqNote: delNote.trim() })
    setDelOpen(false); setDelNote('')
    toast(scriptVersion && scriptVersion < 3 ? 'Saved here. Ask HR to update the Apps Script (v3) so the request reaches the admin.' : 'Delete request sent to admin ✓', scriptVersion && scriptVersion < 3 ? 'warn' : 'ok')
  }
  const cancelRequest = () => { saveLead({ ...lead, delReq: '', delReqBy: '', delReqAt: '', delReqNote: '' }); setDelOpen(false); toast('Delete request cancelled') }
  const deleteNow = () => { removeLead(lead.id); onClose(); toast('Lead deleted') }
  const keepLead = () => { saveLead({ ...lead, delReq: '', delReqBy: '', delReqAt: '', delReqNote: '' }); toast('Kept. Request rejected') }

  const reset = () => {
    setDone(null); setOutcome(''); setRemark(''); setNext(''); setStatus(lead.status); setTab('call')
  }

  const quick = [
    ['In 1 hour', addHours(1)], ['Today 5 PM', atDay(0, 17)], ['Tomorrow 10 AM', atDay(1, 10)],
    ['In 3 days', atDay(3, 10)], ['Next week', atDay(7, 10)],
  ]

  const info = [
    ['Phone', lead.phone], ['Alt phone', lead.altPhone], ['Email', lead.email], ['Business', lead.company],
    ['Type', lead.bizType], ['Area', lead.area], ['Source', lead.source], ['Priority', lead.priority], ['Interest rating', Number(lead.rating) ? `${lead.rating} / 5 ⭐` : ''],
    ['Investment', lead.investment], ['Own vehicle', lead.vehicle], ['Cold storage', lead.coldStorage],
    ['FMCG exp (yrs)', lead.experience], ['Packets / day', lead.dailyQty], ['Calls made', lead.callCount || 0],
    ['Assigned', lead.assignedTo ? fmtAssigned(assignedAtOf(lead)) : ''],
    ['Added on', lead.createdAt ? fmtAssigned(lead.createdAt) : ''],
    ['Notes', lead.notes],
  ].filter(([, v]) => v !== '' && v != null)

  const footer = tab === 'call' && !done && !isAdmin ? (
    <div className="sheet-foot">
      <motion.button whileTap={{ scale: 0.97, y: 3 }} className={`btn3d big ${outcome ? '' : 'off'}`} onClick={save}>
        <Icon name="check" /> {outcome ? `Save “${outcome}” & follow-up` : 'Pick what happened ↑'}
      </motion.button>
    </div>
  ) : null

  return (
    <Sheet onClose={onClose} footer={footer}>
      <div className="detail-head">
        <div className="dh-top">
          <button className="tool" onClick={() => { onClose(); setTimeout(() => openForm(lead), 250) }}><Icon name="edit" size={16} /> Edit</button>
          <button className="tool del" onClick={() => setDelOpen((o) => !o)}><Icon name="trash" size={16} /> {isAdmin ? 'Delete' : pending ? 'Delete requested' : 'Request delete'}</button>
          <button className="icon-btn light" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="dh-row">
          <Avatar name={nameOf(lead)} size={56} icon={isNum || !lead.name} />
          <div className="dh-main">
            <h2>{isNum ? lead.phone : lead.name || lead.phone}</h2>
            <p>{isHotel ? [lead.contactName, lead.address || lead.area || cityOf(lead)].filter(Boolean).join(' · ') : isNum ? 'New number · who is this?' : `${lead.company ? `${lead.company} · ` : ''}${lead.area || cityOf(lead)}`}</p>
            <div className="dh-tags">{!isNum && <StatusPill status={lead.status} />}<span className="tag light">{typeLabel(lead.type)}</span></div>
          </div>
        </div>
        {isHotel && <div className="dh-actions"><MapButton lead={lead} className="act" label="Location"><Icon name="pin" /> Location &amp; Navigate</MapButton></div>}
        {!isAdmin && (!isHotel || lead.phone) && <div className="dh-actions">
          <motion.a whileTap={{ scale: 0.94 }} className="act call" href={telHref(lead.phone)} onClick={(e) => { if (!startCall(lead)) return e.preventDefault(); setStarted(Date.now()); setMode('call'); setTab('call') }}>
            <Icon name="phone" /> {started ? <span className="live"><i />{fmtDur(secs)}</span> : 'Call'}
          </motion.a>
          <motion.a whileTap={{ scale: 0.94 }} className="act wa" href={waHref(lead.phone, waText)} target="_blank" rel="noreferrer"><Icon name="whatsapp" /> WhatsApp</motion.a>
          {lead.email && <motion.a whileTap={{ scale: 0.94 }} className="act" href={`mailto:${lead.email}`}><Icon name="mail" /></motion.a>}
        </div>}
        {lead.nextFollowUp && !CLOSED.includes(lead.status) && (
          <div className="dh-next"><Icon name="clock" size={14} /> Next follow-up: <b>{fmtWhen(lead.nextFollowUp)}</b></div>
        )}
      </div>

      <div className="sheet-body tight">
        {delOpen && (
          <motion.div className="del-panel" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
            {isAdmin ? (
              <>
                <b>Delete {nameOf(lead)} permanently?</b>
                <p>This removes the lead and its call history for everyone.</p>
                <div className="done-actions"><button className="btn-soft" onClick={() => setDelOpen(false)}>Cancel</button><button className="btn-soft danger" onClick={deleteNow}><Icon name="trash" /> Delete</button></div>
              </>
            ) : pending ? (
              <>
                <b>Delete request already sent</b>
                <p>Waiting for the admin to approve or reject.{lead.delReqNote ? ` Your note: “${lead.delReqNote}”` : ''}</p>
                <div className="done-actions"><button className="btn-soft" onClick={() => setDelOpen(false)}>Close</button><button className="btn-soft danger" onClick={cancelRequest}>Cancel request</button></div>
              </>
            ) : (
              <>
                <b>Request delete</b>
                <p>The admin will review it and delete the lead if approved.</p>
                <textarea rows={2} value={delNote} onChange={(e) => setDelNote(e.target.value)} placeholder="Why should it be deleted? (wrong number, duplicate…)" />
                <div className="done-actions"><button className="btn-soft" onClick={() => setDelOpen(false)}>Cancel</button><button className="btn3d" onClick={requestDelete}>Send to admin</button></div>
              </>
            )}
          </motion.div>
        )}
        {isAdmin && pending && !delOpen && (
          <div className="fill-banner req">
            <span>🗑 {lead.delReqBy || 'A caller'} asked to delete this lead{lead.delReqNote ? `: “${lead.delReqNote}”` : ''}</span>
            <div className="row-btns"><button onClick={deleteNow}>Approve</button><button className="keep" onClick={keepLead}>Keep</button></div>
          </div>
        )}
        {!isAdmin && pending && !delOpen && <div className="fill-banner"><span>🗑 Delete request sent. Waiting for admin.</span></div>}
        <Segmented id="ld-tab" value={tab} onChange={setTab}
          options={[...(isAdmin ? [] : [{ value: 'call', label: '📞 Log call' }]), { value: 'history', label: `🕘 History (${lead.calls?.length || 0})` }, { value: 'info', label: 'ℹ️ Info' }]} />

          {tab === 'call' && !done && (
            <motion.div key="call" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              {!isNum && !lead.name && (
                <motion.div className="fill-banner" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                  <span>📝 Call the number, then add the person's details.</span>
                  <button type="button" onClick={() => { onClose(); setTimeout(() => openForm(lead), 250) }}>Add details</button>
                </motion.div>
              )}
              {isNum && (
                <div className="mvbox">
                  <p>Person picked up? Move this number:</p>
                  <div className="mv big">
                    <button type="button" onClick={() => moveTo('distributor')}>🤝 Distributor lead</button>
                    <button type="button" onClick={() => moveTo('sales')}>🛒 Sales lead</button>
                  </div>
                  <small>No answer? Pick what happened below and set a retry time.</small>
                </div>
              )}
              {lead.lastRemark && <div className="last-remark">Last: <b>{lead.lastOutcome}</b> — {lead.lastRemark}</div>}
              {audOpen && (
                <div className="ov-back aud-back" onClick={() => setAudOpen(false)}>
                  <div className="cc-card aud-card" onClick={(e) => e.stopPropagation()}>
                    <h3>Who did you reach?</h3>
                    <p className="cc-sub">Wrong audience · choose the audience type</p>
                    <div className="cc-grid">
                      {AUDIENCES.map((a) => (
                        <button key={a.id} type="button" className={`cc-opt ${audience === a.id ? 'sel' : ''}`}
                          onClick={() => { setAudience(a.id); if (a.id !== 'Other') setAudOpen(false) }}>
                          <i>{a.icon}</i>{a.id}
                        </button>
                      ))}
                    </div>
                    {audience === 'Other' && (
                      <div className="aud-other">
                        <input autoFocus value={audOther} onChange={(e) => setAudOther(e.target.value)} placeholder="What type of audience?" />
                        <button type="button" className="btn3d" onClick={() => audOther.trim() ? setAudOpen(false) : toast('Type the audience', 'warn')}>Done</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <h4 className="lbl">What happened?</h4>
              <div className="outcomes">
                {outcomeList.map((o, i) => (
                  <motion.button
                    key={o.id} type="button" className={`oc ${outcome === o.id ? 'on' : ''}`}
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}
                    whileTap={{ scale: 0.92 }} onClick={() => pick(o)}
                  >
                    <em>{o.icon}</em>{o.id}
                  </motion.button>
                ))}
              </div>

              {outcome === 'Other' && (
                <label className="field other-box"><span>What happened? <em>(required)</em></span>
                  <input autoFocus value={otherText} onChange={(e) => setOtherText(e.target.value)} placeholder="e.g. Shop closed, owner travelling…" />
                </label>
              )}
              {outcome === 'Wrong Audience' && (
                <button type="button" className="aud-chip" onClick={() => setAudOpen(true)}>
                  🎯 Audience: <b>{audience ? (audience === 'Other' ? audOther || 'Other' : audience) : 'tap to choose'}</b> <small>change</small>
                </button>
              )}

              <h4 className="lbl" ref={remarkRef} style={{ scrollMarginTop: 8 }}>Remark &amp; follow-up</h4>
              <div className="chips small">
                {remarks.map((r) => (
                  <button type="button" key={r} className={`chip ${remark.includes(r) ? 'on' : ''}`} onClick={() => toggleRemark(r)}>{r}</button>
                ))}
              </div>
              <textarea rows={3} value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Type what the person said…" />

              {isField && (
                <>
                  <h4 className="lbl">Was this a visit or a call?</h4>
                  <Segmented id="ld-mode" value={started ? 'call' : mode} onChange={setMode} options={[{ value: 'visit', label: '📍 Visit' }, { value: 'call', label: '📞 Call' }]} />
                  <h4 className="lbl">Interest rating</h4>
                  <div className="vm-rate"><Stars value={rating} size={38} onChange={setRating} /><span className={`vm-rate-l r${rating}`}>{RATING_LABEL[rating]}</span></div>
                </>
              )}

              {!isNum && <div className={isField ? '' : 'grid2'}>
                {!isField && <div className="field"><span>Temperature</span>
                  <Segmented id="ld-pri" value={priority} onChange={setPriority}
                    options={PRIORITIES.map((p) => ({ value: p, label: p === 'Hot' ? '🔥' : p === 'Warm' ? '🌤' : '❄️' }))} />
                </div>}
                {isField ? (
                  <div className="field"><span>Status</span>
                    <FieldStatusPick status={status} next={next} onChange={(st, nx) => { setStatus(st); setNext(nx) }} />
                  </div>
                ) : (
                  <label className="field"><span>Status</span>
                    <select value={status} onChange={(e) => setStatus(e.target.value)}>
                      {STATUSES.map((s) => <option key={s.id}>{s.id}</option>)}
                    </select>
                  </label>
                )}
              </div>}

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

            </motion.div>
          )}

          {tab === 'call' && done && (
            <motion.div key="done" className="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              {done.outcome === 'Onboarded' && <Confetti />}
              <motion.div className="done-check" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}>
                <Icon name="check" size={38} />
              </motion.div>
              <h3>{done.outcome === 'Onboarded' ? 'Distributor onboarded! 🎉' : isNum ? 'Number updated' : 'Call saved'}</h3>
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
            <motion.div key="hist" className="timeline" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              {isAdmin && isHotel && <HistoryEditor lead={lead} />}
              {(!isAdmin || !isHotel) && !lead.calls?.length && <p className="empty-s">No calls logged yet. Make the first call! 📞</p>}
              {!(isAdmin && isHotel) && lead.calls?.map((c, i) => (
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
            <motion.div key="info" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
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
              {session?.role === 'admin' && (
                <label className="field" style={{ marginBottom: 12 }}><span>Assigned to</span>
                  <select value={lead.assignedTo || ''} onChange={async (e) => { await assignMany([[lead.id, e.target.value]]); toast('Assignment updated ✓') }}>
                    <option value="">Unassigned</option>
                    {callers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              )}
              <div className="done-actions">
                <button className="btn-soft" onClick={() => { onClose(); setTimeout(() => openForm(lead), 250) }}><Icon name="edit" /> Edit</button>
                <button className="btn-soft" onClick={() => { onClose(); go('more', 'scripts') }}><Icon name="book" /> Scripts</button>
              </div>
            </motion.div>
          )}
      </div>
    </Sheet>
  )
}
