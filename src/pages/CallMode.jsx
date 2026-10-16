import { useMemo, useState } from 'react'
import { AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion'
import { useApp } from '../store'
import { Avatar, Confetti, Icon, StatusPill } from '../ui'
import { bucket, fmtWhen, suggestNext, telHref } from '../utils'
import { OUTCOMES } from '../constants'

const QUICK = ['Not Answered', 'Busy', 'Wrong Number']

function TopCard({ lead, onSkip, onOpen, quick }) {
  const x = useMotionValue(0)
  const rot = useTransform(x, [-200, 200], [-14, 14])
  const hintL = useTransform(x, [-120, -30], [1, 0])
  const hintR = useTransform(x, [30, 120], [0, 1])
  const k = bucket(lead)
  return (
    <motion.div
      className="cm-card top" style={{ x, rotate: rot }}
      drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.9}
      onDragEnd={(_, i) => {
        if (i.offset.x < -110) onSkip()
        else if (i.offset.x > 110) onOpen(true)
      }}
      initial={{ scale: 0.9, y: 40, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }}
      exit={{ x: -420, opacity: 0, rotate: -18, transition: { duration: 0.35 } }}
      transition={{ type: 'spring', stiffness: 240, damping: 22 }}
    >
      <motion.span className="swipe-hint l" style={{ opacity: hintL }}>SKIP</motion.span>
      <motion.span className="swipe-hint r" style={{ opacity: hintR }}>CALL</motion.span>
      <Avatar name={lead.name} size={76} />
      <h2>{lead.name}</h2>
      <p>{lead.company ? `${lead.company} · ` : ''}{lead.area || 'Bengaluru'}</p>
      <div className="cm-tags">
        <StatusPill status={lead.status} />
        {lead.priority === 'Hot' && <span className="tag">🔥 Hot</span>}
        {lead.type === 'sales' && <span className="tag">Sales</span>}
        {lead.nextFollowUp && <span className={`due ${k}`}><Icon name="clock" size={12} />{fmtWhen(lead.nextFollowUp)}</span>}
      </div>
      {lead.lastRemark ? <div className="cm-remark">“{lead.lastRemark}”<small>— {lead.lastOutcome}, {lead.callCount} call{lead.callCount > 1 ? 's' : ''}</small></div> : <div className="cm-remark soft">Fresh lead · no calls yet</div>}
      <div className="cm-phone">{lead.phone}</div>
      <motion.a whileTap={{ scale: 0.93, y: 4 }} className="btn3d call-big" href={telHref(lead.phone)} onClick={() => onOpen(true)}>
        <Icon name="phone" size={24} /> Call now
      </motion.a>
      <div className="cm-quick">
        {QUICK.map((id) => (
          <button key={id} onClick={() => quick(lead, id)}>
            <em>{OUTCOMES.find((o) => o.id === id).icon}</em>{id}
          </button>
        ))}
        <button onClick={() => onOpen(false)}><em>📝</em>Log details</button>
      </div>
    </motion.div>
  )
}

export default function CallMode() {
  const { leads, openLead, logCall, toast, go } = useApp()
  const [handled, setHandled] = useState([])

  const queue = useMemo(() => {
    const due = leads.filter((l) => ['overdue', 'today'].includes(bucket(l))).sort((a, b) => new Date(a.nextFollowUp) - new Date(b.nextFollowUp))
    const fresh = leads.filter((l) => !l.callCount && l.status === 'New' && bucket(l) === 'none')
    return [...due, ...fresh].filter((l) => !handled.includes(l.id))
  }, [leads, handled])

  const current = queue[0]
  const handle = (id) => setHandled((h) => [...h, id])

  const quick = (lead, outcome) => {
    const next = suggestNext(outcome)
    logCall(lead, { outcome, remark: '', next })
    toast(`${outcome} logged${next ? ` · retry ${fmtWhen(next)}` : ''}`)
    handle(lead.id)
  }
  const open = (lead, calling) => { openLead(lead.id, { calling }); handle(lead.id) }

  return (
    <div className="page cm">
      <div className="page-h">
        <h1>Call Mode</h1>
        <div className="cm-count"><b>{handled.length}</b> done · <b>{queue.length}</b> left</div>
      </div>

      <div className="cm-stage">
        {current && queue.slice(1, 3).reverse().map((l, i, a) => (
          <div key={l.id} className="cm-card back" style={{ transform: `translateY(${(a.length - i) * 14}px) scale(${1 - (a.length - i) * 0.05})`, opacity: 1 - (a.length - i) * 0.25 }} />
        ))}
        <AnimatePresence mode="popLayout">
          {current ? (
            <TopCard key={current.id} lead={current} onSkip={() => handle(current.id)} onOpen={(calling) => open(current, calling)} quick={quick} />
          ) : (
            <motion.div key="done" className="cm-card top allclear" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
              <Confetti />
              <div className="empty-ico">🎉</div>
              <h2>All caught up!</h2>
              <p>{handled.length ? `You worked through ${handled.length} leads. Great job!` : 'No follow-ups due and no fresh leads waiting.'}</p>
              <button className="btn3d" onClick={() => go('leads')}>Browse leads</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {current && <p className="cm-tip">← swipe to skip · swipe to call →</p>}
    </div>
  )
}
