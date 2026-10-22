import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../store'
import { Icon, Segmented, Sheet } from '../ui'
import AreaPicker from './AreaPicker'
import ChennaiAreaPicker from './ChennaiAreaPicker'
import { lastKnown } from '../useGeo'
import FieldStatusPick from './FieldStatusPick'
import { AREAS, BIZ_TYPES, INVEST, PRIORITIES, SOURCES, STATUSES, STOP_REASONS } from '../constants'
import { coordsFromLink, cleanPhone, fromLocalInput, toLocalInput, atDay, addHours } from '../utils'

export default function LeadForm({ lead, preset, onClose }) {
  const { leads, addLead, saveDetails, toast, session, callers } = useApp()
  const editing = !!lead
  const isField = session?.role === 'field'
  const [f, setF] = useState(() => ({
    type: isField ? 'hotel' : 'distributor', name: '', phone: '', altPhone: '', email: '', company: '', bizType: '',
    area: '', source: isField ? 'Field visit' : 'Company Data', priority: 'Warm', status: 'New', investment: '', vehicle: '',
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
    if (f.type !== 'hotel' && cleanPhone(f.phone).length < 10) return toast('Enter a valid 10-digit phone number', 'warn')
    const data = { ...f, name: f.name.trim(), phone: cleanPhone(f.phone), altPhone: cleanPhone(f.altPhone) }
    if (f.type === 'hotel') { data.city = 'Chennai'; const pt = coordsFromLink(f.mapUrl || ''); if (pt && !f.lat) { data.lat = String(pt.lat); data.lng = String(pt.lng) } }
    if (session?.role === 'admin' && data.assignedTo !== undefined) {
      data.assignedName = callers.find((c) => c.id === data.assignedTo)?.name || ''
      if (data.assignedTo && data.assignedTo !== lead?.assignedTo) data.assignedAt = new Date().toISOString()
    }
    if (editing) saveDetails(lead, data)
    else addLead(data)
    toast(editing ? (f.type === 'hotel' ? 'Hotel updated ✓' : 'Lead updated ✓') : isNum ? 'Number saved ✓' : f.type === 'hotel' ? 'Hotel added ✓' : 'Lead added ✓')
    onClose()
  }

  const yn = (k) => <Segmented id={`yn-${k}`} value={f[k]} onChange={(v) => set(k, v)} options={['Yes', 'No']} />

  return (
    <Sheet onClose={onClose}>
      <form className="sheet-body" onSubmit={submit}>
        <div className="sheet-title">
          <h2>{editing ? (lead.name ? (f.type === 'hotel' ? 'Edit hotel' : 'Edit lead') : "Add the person's details") : f.type === 'hotel' ? 'New hotel' : 'New lead'}</h2>
          <button type="button" className="icon-btn" onClick={onClose}><Icon name="x" /></button>
        </div>

        {f.type !== 'hotel' && <Segmented
          id="lf-type" value={f.type} onChange={(v) => set('type', v)}
          options={[{ value: 'distributor', label: '🤝 Distributor' }, { value: 'sales', label: '🛒 Sales' }, { value: 'number', label: '📞 Number' }]}
        />}
        {isNum && <p className="mini-note">Just save the number now. Call it, and when the person picks up, move it to a Distributor or Sales lead.</p>}

        <div className="grid2">
          {!isNum && (
            <label className="field"><span>{f.type === 'hotel' ? 'Hotel name *' : 'Name *'}</span>
              <input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder={f.type === 'hotel' ? 'Hotel / restaurant name' : 'Contact person'} autoFocus={!editing || !lead?.name} />
            </label>
          )}
          <label className="field"><span>{f.type === 'hotel' ? 'Phone (if given)' : 'Phone *'}</span>
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
          {f.type === 'hotel'
            ? <ChennaiAreaPicker value={f.area} onChange={(area) => setF((p) => ({ ...p, area }))} />
            : <AreaPicker value={f.area} hub={f.hub} onChange={(area, hub) => setF((p) => ({ ...p, area, hub }))} />}
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

        {f.type === 'hotel' && (
          <div className="extra">
            <h4>🏨 Hotel &amp; location (Chennai)</h4>
            <label className="field"><span>Contact person</span><input value={f.contactName || ''} onChange={(e) => set('contactName', e.target.value)} placeholder="Owner / manager / chef" /></label>
            <label className="field"><span>Address</span><input value={f.address || ''} onChange={(e) => set('address', e.target.value)} placeholder="Street, landmark" /></label>
            <label className="field"><span>Google Maps link</span><input value={f.mapUrl || ''} onChange={(e) => set('mapUrl', e.target.value)} placeholder="Paste the share link from Google Maps" /></label>
            <button type="button" className="btn-soft wide" onClick={() => {
              const use = (p) => { setF((x) => ({ ...x, lat: String(p.lat), lng: String(p.lng) })); toast('📍 Pin saved at your location') }
              if (!navigator.geolocation) return toast('GPS is not available', 'warn')
              navigator.geolocation.getCurrentPosition((p) => use({ lat: p.coords.latitude, lng: p.coords.longitude }), () => { const k = lastKnown(); k ? use(k) : toast('Allow location access to pin this hotel', 'warn') }, { enableHighAccuracy: true, timeout: 12000 })
            }}>📍 {f.lat && f.lng ? 'Pin saved · update to my location' : 'Standing at the hotel? Pin my location'}</button>
            <div className="grid2">
              <label className="field"><span>Last order on</span><input value={f.lastOrderOn || ''} onChange={(e) => set('lastOrderOn', e.target.value)} placeholder="e.g. 12 Aug" /></label>
              <label className="field"><span>Packets / month before</span><input inputMode="numeric" value={f.monthlyQty || ''} onChange={(e) => set('monthlyQty', e.target.value)} /></label>
            </div>
            <label className="field"><span>Why did they stop?</span>
              <div className="chips">{STOP_REASONS.map((v) => <button type="button" key={v} className={`chip ${f.stopReason === v ? 'on' : ''}`} onClick={() => set('stopReason', f.stopReason === v ? '' : v)}>{v}</button>)}</div>
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
          isField ? (
            <div className="field"><span>Status</span>
              <FieldStatusPick status={f.status} next={f.nextFollowUp} onChange={(st, nx) => { set('status', st); set('nextFollowUp', nx) }} />
            </div>
          ) : (
            <label className="field"><span>Status</span>
              <select value={f.status} onChange={(e) => set('status', e.target.value)}>
                {STATUSES.map((s) => <option key={s.id}>{s.id}</option>)}
              </select>
            </label>
          )
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
          <Icon name="check" /> {editing ? 'Save changes' : isNum ? 'Save number' : f.type === 'hotel' ? 'Add hotel' : 'Add lead'}
        </motion.button>
      </form>
    </Sheet>
  )
}
