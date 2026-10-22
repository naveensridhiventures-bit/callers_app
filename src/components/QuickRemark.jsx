import { useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence } from 'framer-motion'
import { useApp } from '../store'
import { RemarkSheet } from './VisitMode'
import { ratingToPriority } from './Stars'

/** Remark without starting a visit run: tap ✍️ Remark on any hotel card. Renders above everything. */
export function useQuickRemark() {
  const { logCall, toast } = useApp()
  const [lead, setLead] = useState(null)
  const [busy, setBusy] = useState(false)

  const save = ({ outcome, rating, remark, next, extra }) => {
    setBusy(true)
    logCall(lead, { outcome, rating, remark, next, extra, priority: ratingToPriority(rating) || undefined, mode: 'visit' })
    toast(outcome === 'Order Restarted' ? '🎉 Order restarted. Great work!' : 'Remark saved ✓')
    setLead(null)
    setBusy(false)
  }

  const node = createPortal(
    <AnimatePresence>
      {lead && <RemarkSheet key={lead.id} fixed quick lead={lead} reached={null} last={false} busy={busy} onSave={save} onBack={() => setLead(null)} />}
    </AnimatePresence>,
    document.body
  )
  return { open: setLead, node }
}
