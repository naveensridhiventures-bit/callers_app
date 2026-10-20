import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../store'
import { Icon, Segmented, Sheet } from '../ui'
import { AREAS, BIZ_TYPES, INVEST, PRIORITIES, SOURCES, STATUSES } from '../constants'
import { cleanPhone, fromLocalInput, toLocalInput, atDay, addHours } from '../utils'

export default function LeadForm({ lead, preset, onClose }) {
  const { leads, addLead, saveDetails, toast, session, callers } = useApp()
  const editing = !!lead
  const [f, setF] = useState(() => ({
    type: 'distributor', name: '', phone: '', altPhone: '', email: '', company: '', bizType: '',
    area: '', source: 'Company Data', priority: 'Warm', status: 'New', investment: '', vehicle: '',
    coldStorage: '', experience: '', dailyQty: '', notes: '', nextFollowUp: '',
    ...preset, ...lead,
  }))
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const isNum = f.type === 'number'
  const dup = useMemo(() => {
    const p = cleanPhone(f.phone)
    if (p.length < 10) return null
    return leads.find((l) => cleanPhone(l.phone) === p && l.id !== lead?.id)
  }, [f.phone, leads, lead])

  const submit = (e) => {
    e.preventDefault()
    if (!isNum && !f.name.trim()) return toast("Enter the person's name", 'warn')
    if (cleanPhone(f.phone).length < 10) return toast('Enter a valid 10-digit phone number', 'warn')
    const data = { ...f, name: f.name.trim(), phone: cleanPhone(f.phone), altPhone: cleanPhone(f.altPhone) }
    if (session?.role === 'admin' && data.assignedTo !== undefined) {
      data.assignedName = callers.find((c) => c.id === data.assignedTo)?.name || ''
      if (data.assignedTo && data.assignedTo !== lead?.assignedTo) data.assignedAt = new Date().toISOString()
    }
    if (editing) saveDetails(lead, data)
    else addLead(data)
    toast(editing ? 'Lead updated ✓' : isNum ? 'Number saved ✓' : 'Lead added ✓')
    onClose()
  }

  const yn = (k) => <Segmented id={`yn-${k}`} value={f[k]} onChange={(v) => set(k, v)} options={['Yes', 'No']} />

  return (
    <Sheet onClose={onClose}>
      <form className="sheet-body" onSubmit={submit}>
        <div className="sheet-title">
          <h2>{editing ? (lead.name ? 'Edit lead' : "Add the person's details") : 'New lead'}</h2>
          <button type="button" className="icon-btn" onClick={onClose}><Icon name="x" /></button>
        </div>

        <Segmented
          id="lf-type" value={f.type} onChange={(v) => set('type', v)}
          options={[{ value: 'distributor', label: '🤝 Distributor' }, { value: 'sales', label: '🛒 Sales' }, { value: 'number', label: '📞 Number' }]}
        />
        {isNum && <p className="mini-note">Just save the number now. Call it, and when the person picks up, move it to a Distributor or Sales lead.</p>}

        <div className="grid2">
          {!isNum && (
            <label className="field"><span>Name *</span>
              <input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Contact person" autoFocus={!editing || !lead?.name} />
            </label>
          )}
          <label className="field"><span>Phone *</span>
            <input inputMode="numeric" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="10-digit mobile" maxLength={14} autoFocus={isNum} />
          </label>
        </div>
        {dup && (
          <motion.div className="warn" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
            ⚠️ This number already exists: <b>{dup.name || dup.phone}</b> ({dup.status})
          </motion.div>
        )}

        {!isNum && (
          <div className="grid2">
            <label className="field"><span>Shop / Business name</span>
              <input value={f.company} onChange={(e) => set('company', e.target.value)} placeholder="e.g. Sri Lakshmi Stores" />
            </label>
            <label className="field"><span>Business type</span>
              <select value={f.bizType} onChange={(e) => set('bizType', e.target.value)}>
                <option value="">Select…</option>
                {BIZ_TYPES.map((b) => <option key={b}>{b}</option>)}
              </select>
            </label>
          </div>
        )}

        <div className="grid2">
          <label className="field"><span>Area (Bengaluru)</span>
            <select value={AREAS.includes(f.area) ? f.area : f.area ? 'Other' : ''} onChange={(e) => set('area', e.target.value === 'Other' ? ' ' : e.target.value)}>
              <option value="">Select area</option>
              {AREAS.map((a) => <option key={a}>{a}</option>)}
              <option value="Other">Other…</option>
            </select>
            {f.area && !AREAS.includes(f.area) && (
              <input autoFocus className="area-other" value={f.area.trim() === '' ? '' : f.area} onChange={(e) => set('area', e.target.value || ' ')} placeholder="Which area?" />
            )}
          </label>
          <label className="field"><span>Source</span>
            <select value={f.source} onChange={(e) => set('source', e.target.value)}>
              {SOURCES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
        </div>

        {!isNum && (
          <div className="grid2">
            <label className="field"><span>Alternate phone</span>
              <input inputMode="numeric" value={f.altPhone} onChange={(e) => set('altPhone', e.target.value)} />
            </label>
            <label className="field"><span>Email</span>
              <input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="optional" />
            </label>
          </div>
        )}

        {f.type === 'distributor' && (
          <div className="extra">
            <h4>Distributor details</h4>
            <label className="field"><span>Investment capacity</span>
              <div className="chips">
                {INVEST.map((v) => (
                  <button type="button" key={v} className={`chip ${f.investment === v ? 'on' : ''}`} onClick={() => set('investment', f.investment === v ? '' : v)}>{v}</button>
                ))}
              </div>
            </label>
            <div className="grid3">
              <div className="field"><span>Own vehicle?</span>{yn('vehicle')}</div>
              <div className="field"><span>Fridge / cold storage?</span>{yn('coldStorage')}</div>
              <label className="field"><span>FMCG experience (yrs)</span>
                <input inputMode="numeric" value={f.experience} onChange={(e) => set('experience', e.target.value)} />
              </label>
            </div>
          </div>
        )}
        {f.type === 'sales' && (
          <div className="extra">
            <h4>Sales details</h4>
            <label className="field"><span>Expected packets / day</span>
              <input inputMode="numeric" value={f.dailyQty} onChange={(e) => set('dailyQty', e.target.value)} placeholder="e.g. 30" />
            </label>
          </div>
        )}

        {!isNum && (
          <div className="field"><span>Lead temperature</span>
            <Segmented id="lf-pri" value={f.priority} onChange={(v) => set('priority', v)}
              options={PRIORITIES.map((p) => ({ value: p, label: p === 'Hot' ? '🔥 Hot' : p === 'Warm' ? '🌤 Warm' : '❄️ Cold' }))} />
          </div>
        )}

        {editing && !isNum && (
          <label className="field"><span>Status</span>
            <select value={f.status} onChange={(e) => set('status', e.target.value)}>
              {STATUSES.map((s) => <option key={s.id}>{s.id}</option>)}
            </select>
          </label>
        )}

        <label className="field"><span>Follow-up (optional)</span>
          <input type="datetime-local" value={toLocalInput(f.nextFollowUp)} onChange={(e) => set('nextFollowUp', fromLocalInput(e.target.value))} />
          <div className="chips small">
            {[['In 1 hour', addHours(1)], ['Today 5 PM', atDay(0, 17)], ['Tomorrow 10 AM', atDay(1, 10)]].map(([l, v]) => (
              <button type="button" key={l} className="chip" onClick={() => set('nextFollowUp', v)}>{l}</button>
            ))}
          </div>
        </label>

        {session?.role === 'admin' && (
          <label className="field"><span>Assign to caller</span>
            <select value={f.assignedTo || ''} onChange={(e) => set('assignedTo', e.target.value)}>
              <option value="">Unassigned</option>
              {callers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}

        <label className="field"><span>Notes</span>
          <textarea rows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Anything useful about this lead…" />
        </label>

        <motion.button whileTap={{ scale: 0.97, y: 3 }} className="btn3d big" type="submit">
          <Icon name="check" /> {editing ? 'Save changes' : isNum ? 'Save number' : 'Add lead'}
        </motion.button>
      </form>
    </Sheet>
  )
}
