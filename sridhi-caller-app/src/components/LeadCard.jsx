import { motion } from 'framer-motion'
import { useApp } from '../store'
import { Avatar, Icon, StatusPill } from '../ui'
import { bucket, fmtWhen, telHref, waHref } from '../utils'
import { CLOSED } from '../constants'

export default function LeadCard({ lead, i = 0 }) {
  const { openLead } = useApp()
  const k = bucket(lead)
  const closed = CLOSED.includes(lead.status)
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
      <Avatar name={lead.name} />
      <div className="lead-main">
        <div className="lead-top">
          <b>{lead.name}</b>
          {lead.priority === 'Hot' && !closed && <span title="Hot lead">🔥</span>}
        </div>
        <div className="lead-sub">{lead.company ? `${lead.company} · ` : ''}{lead.area || 'Bengaluru'}</div>
        <div className="lead-meta">
          <StatusPill status={lead.status} />
          {lead.type === 'sales' && <span className="tag">Sales</span>}
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
    </motion.div>
  )
}
