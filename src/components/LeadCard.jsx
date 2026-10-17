import { motion } from 'framer-motion'
import { useApp } from '../store'
import { Avatar, Icon, StatusPill } from '../ui'
import { assignedAtOf, bucket, fmtAssigned, fmtWhen, isToday, nameOf, telHref, waHref } from '../utils'
import { CLOSED, NUMBER_ONLY } from '../constants'

export default function LeadCard({ lead, i = 0 }) {
  const { openLead, session, callers, convertLead } = useApp()
  const k = bucket(lead)
  const closed = CLOSED.includes(lead.status)
  const isNum = lead.type === 'number'
  const move = (type) => {
    convertLead(lead, type)
    openLead(lead.id, { moved: true })
  }
  const got = lead.assignedTo ? assignedAtOf(lead) : ''
  const fresh = !!got && isToday(got) && !lead.callCount
  return (
    <motion.div
      layout
      className="lead"
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: Math.min(i, 8) * 0.035, type: 'spring', stiffness: 260, damping: 24 }}
      whileTap={{ scale: 0.98 }}
      whileHover={{ y: -2 }}
      onClick={() => openLead(lead.id)}
    >
      <Avatar name={nameOf(lead)} icon={isNum || !lead.name} />
      <div className="lead-main">
        <div className="lead-top">
          <b>{isNum ? lead.phone : lead.name}</b>
          {lead.priority === 'Hot' && !closed && <span title="Hot lead">🔥</span>}
        </div>
        <div className="lead-sub">
          {isNum
            ? lead.lastOutcome ? `${lead.lastOutcome}${lead.lastRemark ? ` · ${lead.lastRemark}` : ''}` : 'New number · call and find out who it is'
            : `${lead.company ? `${lead.company} · ` : ''}${lead.area || 'Bengaluru'}`}
        </div>
        <div className="lead-meta">
          {isNum ? <span className="tag num">📞 Number</span> : <StatusPill status={lead.status} />}
          {lead.type === 'sales' && <span className="tag">Sales</span>}
          {fresh && <span className="tag new">🆕 New</span>}
          {got && <span className="tag when" title="When this lead was assigned">📥 {fmtAssigned(got)}</span>}
          {lead.delReq === '1' && <span className="tag red">🗑 Delete requested</span>}
          {session?.role === 'admin' && <span className={`tag ${lead.assignedTo ? '' : 'amber'}`}>👤 {lead.assignedTo ? callers.find((c) => c.id === lead.assignedTo)?.name || lead.assignedName || '—' : 'Unassigned'}</span>}
          {lead.nextFollowUp && !closed && (
            <span className={`due ${k}`}><Icon name="clock" size={12} />{fmtWhen(lead.nextFollowUp)}</span>
          )}
        </div>
      </div>
      <div className="lead-actions" onClick={(e) => e.stopPropagation()}>
        <a className="round call" href={telHref(lead.phone)} onClick={() => openLead(lead.id, { calling: true })} aria-label="Call">
          <Icon name="phone" size={18} />
        </a>
        <a className="round wa" href={waHref(lead.phone)} target="_blank" rel="noreferrer" aria-label="WhatsApp">
          <Icon name="whatsapp" size={18} />
        </a>
      </div>
      {isNum && (
        <div className="mv" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => move('distributor')}>🤝 Move to Distributor lead</button>
          <button onClick={() => move('sales')}>🛒 Move to Sales lead</button>
        </div>
      )}
    </motion.div>
  )
}
