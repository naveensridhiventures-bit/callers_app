import { useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../store'
import { Icon, Sheet } from '../ui'
import ChennaiAreaPicker from './ChennaiAreaPicker'
import { OUTCOMES } from '../constants'
import { areaInfo } from '../chennai'
import { fmtWhen } from '../utils'

const AUTO = ['Details Updated', 'Lead Added', 'Checked In'] // automatic entries, not real visits or calls

/** rebuild the summary fields that cards show, after a history entry was changed or removed */
export function withHistory(lead, calls) {
  const sorted = [...calls].sort((a, b) => String(b.at).localeCompare(String(a.at)))
  const last = sorted[0]
  const real = sorted.filter((c) => !AUTO.includes(c.outcome))
  return {
    ...lead,
    calls: sorted,
    callCount: sorted.length ? Math.max(1, real.length) : 0,
    lastCall: last?.at || '',
    lastOutcome: last?.outcome || '',
    lastRemark: (sorted.find((c) => c.remark) || {}).remark || '',
    rating: String((sorted.find((c) => Number(c.rating) > 0) || {}).rating || ''),
  }
}

/** Admin only: change or delete any single remark in a hotel's history. Works on its own so it can sit in any screen. */
export function HistoryEditor({ lead }) {
  const { saveLead, toast } = useApp()
  const [edit, setEdit] = useState(null) // { id, remark }
  const [del, setDel] = useState(null)
  const calls = lead.calls || []

  const saveRemark = () => {
    if (!edit) return
    saveLead(withHistory(lead, calls.map((c) => (c.id === edit.id ? { ...c, remark: edit.remark.trim(), editedByAdmin: true } : c))))
    setEdit(null); toast('Remark updated ✓')
  }
  const remove = (id) => {
    saveLead(withHistory(lead, calls.filter((c) => c.id !== id)))
    setDel(null); toast('Entry deleted')
  }

  if (!calls.length) return <p className="mini-note">No visits or calls logged for this hotel yet.</p>
  return (
    <div className="he-hist">
      {calls.map((c) => (
        <div key={c.id} className="he-row">
          <i>{OUTCOMES.find((o) => o.id === c.outcome)?.icon || (c.mode === 'visit' ? '📍' : '📞')}</i>
          <div className="he-main">
            <b>{c.outcome}</b>
            <small>{fmtWhen(c.at)}{c.by ? ` · ${c.by}` : ''}{c.mode ? ` · ${c.mode === 'visit' ? 'Visit' : 'Call'}` : ''}{Number(c.rating) ? ` · ${c.rating}★` : ''}</small>
            {edit?.id === c.id ? (
              <div className="he-edit">
                <textarea rows={3} autoFocus value={edit.remark} onChange={(e) => setEdit({ ...edit, remark: e.target.value })} placeholder="Type the corrected remark…" />
                <div className="he-btns">
                  <button type="button" className="btn-soft sm" onClick={() => setEdit(null)}>Cancel</button>
                  <button type="button" className="btn3d sm" onClick={saveRemark}><Icon name="check" size={14} /> Save remark</button>
                </div>
              </div>
            ) : (
              <p className={c.remark ? '' : 'none'}>{c.remark ? `“${c.remark}”` : 'No remark'}{c.editedByAdmin && <em> · edited by admin</em>}</p>
            )}
            {del === c.id && (
              <div className="he-confirm">
                <span>Delete this entry for good?</span>
                <button type="button" className="btn-soft sm" onClick={() => setDel(null)}>Keep</button>
                <button type="button" className="btn-soft sm danger" onClick={() => remove(c.id)}><Icon name="trash" size={14} /> Delete</button>
              </div>
            )}
          </div>
          {edit?.id !== c.id && del !== c.id && (
            <div className="he-tools">
              <button type="button" aria-label="Edit remark" onClick={() => setEdit({ id: c.id, remark: c.remark || '' })}>✏️</button>
              <button type="button" aria-label="Delete entry" onClick={() => setDel(c.id)}><Icon name="trash" size={16} /></button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/** Admin: one sheet to fix a hotel: name, phone, area, address, latest remark, every past remark, or delete the hotel. */
export default function AdminHotelEditor({ lead: initial, onClose }) {
  const { leads, saveLead, removeLead, toast } = useApp()
  const lead = leads.find((l) => l.id === initial.id) || initial
  const [f, setF] = useState({ name: lead.name || '', phone: lead.phone || '', contactName: lead.contactName || '', area: lead.area || '', address: lead.address || '', lastRemark: lead.lastRemark || '' })
  const [confirm, setConfirm] = useState(false)
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const known = new Set(leads.map((l) => (l.area || '').trim().toLowerCase()).filter(Boolean))
  const isNewArea = f.area.trim() && !areaInfo(f.area) && !known.has(f.area.trim().toLowerCase())

  const save = () => {
    if (!f.name.trim()) return toast('The hotel needs a name', 'warn')
    saveLead({ ...lead, name: f.name.trim(), phone: f.phone.trim(), contactName: f.contactName.trim(), area: f.area.trim(), address: f.address.trim(), lastRemark: f.lastRemark.trim() })
    toast(isNewArea ? `✅ Saved. “${f.area.trim()}” added as a new area` : '✅ Hotel updated')
    onClose()
  }
  const remove = () => { removeLead(lead.id); toast(`🗑 ${lead.name} deleted`); onClose() }

  return (
    <Sheet onClose={onClose}>
      <div className="he">
        <div className="he-head"><div><h2>✏️ Edit hotel</h2><small>{lead.name}</small></div><button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button></div>

        <section className="he-sec">
          <h4>Hotel details</h4>
          <label className="field"><span>Hotel name</span><input value={f.name} onChange={(e) => set('name', e.target.value)} /></label>
          <div className="grid2">
            <label className="field"><span>Phone</span><input inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></label>
            <label className="field"><span>Contact person</span><input value={f.contactName} onChange={(e) => set('contactName', e.target.value)} /></label>
          </div>
          <ChennaiAreaPicker value={f.area} onChange={(a) => set('area', a)} />
          {isNewArea && <p className="he-new">➕ <b>{f.area.trim()}</b> is not in the list yet. Saving adds it as a new area for everyone (filters, reports, field person).</p>}
          <label className="field"><span>Address</span><input value={f.address} onChange={(e) => set('address', e.target.value)} placeholder="Street, landmark" /></label>
          <label className="field"><span>Latest remark <small>(shown on the cards)</small></span><textarea rows={2} value={f.lastRemark} onChange={(e) => set('lastRemark', e.target.value)} /></label>
          <motion.button whileTap={{ scale: 0.97, y: 3 }} className="btn3d big" onClick={save}><Icon name="check" /> Save changes</motion.button>
        </section>

        <section className="he-sec">
          <h4>Visit and call history <small>· edit or delete one entry</small></h4>
          <HistoryEditor lead={lead} />
        </section>

        <section className="he-sec danger">
          <h4>Delete this hotel</h4>
          {!confirm
            ? <button type="button" className="btn-soft danger wide" onClick={() => setConfirm(true)}><Icon name="trash" /> Delete {lead.name}</button>
            : (
              <div className="he-confirm big">
                <b>Delete {lead.name} permanently?</b>
                <p>This removes the hotel and its whole history for everyone. It cannot be undone.</p>
                <div className="he-btns"><button className="btn-soft" onClick={() => setConfirm(false)}>Keep it</button><button className="btn-soft danger" onClick={remove}><Icon name="trash" /> Yes, delete</button></div>
              </div>
            )}
        </section>
      </div>
    </Sheet>
  )
}
