import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../store'
import { Icon, Sheet } from '../ui'
import { RATING_LABEL, Stars, StarsRO, ratingToPriority } from './Stars'
import MapButton from './MapPopup'
import ChennaiAreaPicker from './ChennaiAreaPicker'
import { BRANDS, MILK_OUTCOMES, MILK_REMARKS, OUT, SRC_OWN, brandsOf, isOwn, joinBrands } from '../milk'
import { canonArea, zoneOf } from '../chennai'
import { FS, fieldStatusOf } from '../fieldStatus'
import { accLabel, bestFix, inChennai, isShortLink, locFields, parsePin } from '../location'
import { atDay, cleanPhone, fmtWhen, fromLocalInput, hotelPoint, nowISO, telHref, toLocalInput, uid, waHref } from '../utils'

const FOLLOW = [
  { id: 'today', t: 'Today 5 PM', at: () => atDay(0, 17), show: () => new Date().getHours() < 17 },
  { id: 'tom', t: 'Tomorrow', at: () => atDay(1, 11) },
  { id: 'd3', t: 'In 3 days', at: () => atDay(3, 11) },
  { id: 'wk', t: 'Next week', at: () => atDay(7, 11) },
  { id: 'mo', t: 'In 2 weeks', at: () => atDay(14, 11) },
]

/**
 * One milk distributor, built for the street:  Visit (what happened) · Details (fix / complete the record) · History.
 * With no `id` it adds a NEW distributor the field person found herself (source = "Own source").
 */
export default function MilkSheet({ id, preset = {}, tab: tab0 = 'visit', onClose }) {
  const { allLeads, leads, session, saveLead, logCall, saveDetails, removeLead, startCall, toast, openLead } = useApp()
  const lead = id ? allLeads.find((l) => l.id === id) : null
  const adding = !lead
  const isAdmin = session?.role === 'admin'
  const [tab, setTab] = useState(isAdmin && tab0 === 'visit' ? 'details' : tab0)

  // ---- record fields (Details)
  const [d, setD] = useState(() => ({
    name: lead?.name || preset.name || '', contactName: lead?.contactName || '', phone: lead?.phone || '', altPhone: lead?.altPhone || '',
    area: lead?.area || preset.area || '', address: lead?.address || '', notes: lead?.notes || '',
  }))
  const set = (k) => (e) => setD((p) => ({ ...p, [k]: e.target.value }))

  // ---- what we learn on the visit
  const [brands, setBrands] = useState(() => brandsOf(lead || {}))
  const [custom, setCustom] = useState('')
  const [litres, setLitres] = useState(lead?.dailyQty || '')
  const [vehicle, setVehicle] = useState(lead?.vehicle || '')
  const [cold, setCold] = useState(lead?.coldStorage || '')
  const [outcome, setOutcome] = useState(adding ? 'Met Owner' : '')
  const [rating, setRating] = useState(0)
  const [remark, setRemark] = useState('')
  const [next, setNext] = useState('')
  const [pin, setPin] = useState(null)
  const [busy, setBusy] = useState(false)

  const o = OUT[outcome]
  const fs = lead ? fieldStatusOf(lead) : FS.todo
  const own = adding || isOwn(lead)
  const pt = pin || (lead ? hotelPoint(lead) : null)
  const allBrands = useMemo(() => [...new Set([...BRANDS, ...brands])], [brands])
  const toggleBrand = (b) => setBrands((a) => (a.includes(b) ? a.filter((x) => x !== b) : [...a, b]))
  const addCustom = () => { const v = custom.trim(); if (v) { setBrands((a) => (a.includes(v) ? a : [...a, v])); setCustom('') } }
  const addRemark = (t) => setRemark((r) => (r.includes(t) ? r : r ? `${r}. ${t}` : t))

  const facts = () => ({ company: joinBrands(brands), dailyQty: String(litres || '').trim(), vehicle, coldStorage: cold })
  const detailPatch = () => ({ name: d.name.trim(), contactName: d.contactName.trim(), phone: cleanPhone(d.phone) || d.phone.trim(), altPhone: d.altPhone.trim(), area: canonArea(d.area), address: d.address.trim(), notes: d.notes.trim() })

  const checkRecord = () => {
    if (!d.name.trim()) { setTab('details'); toast('Enter the distributor name', 'warn'); return false }
    if (adding && cleanPhone(d.phone).length < 10) { toast('Enter a valid 10-digit phone number', 'warn'); return false }
    if (!d.area.trim()) { setTab('details'); toast('Choose the area', 'warn'); return false }
    if (adding) {
      const dup = leads.find((l) => l.type === 'milk' && cleanPhone(l.phone) === cleanPhone(d.phone))
      if (dup) { toast(`Already in your list: ${dup.name}${dup.area ? ` · ${dup.area}` : ''}`, 'warn'); openLead(dup.id); return false }
    }
    return true
  }

  const pinFields = (base) => (pin ? locFields(session, base || {}, pin, pin.source, pin.acc) : {})

  const saveVisit = () => {
    if (busy) return
    if (!checkRecord()) return
    if (!outcome) return toast('Choose how the visit went', 'warn')
    if (o.need && !next) return toast('Pick when to go back. This visit needs a follow-up.', 'warn')
    setBusy(true)
    const base = lead || {
      id: uid(), type: 'milk', city: 'Chennai', bizType: 'Milk Distributor', source: SRC_OWN, status: 'Contacted', priority: 'Warm',
      calls: [], callCount: 0, nextFollowUp: '', createdAt: nowISO(), fieldId: session.id, fieldName: session.name, fieldAt: nowISO(),
    }
    logCall({ ...base, ...detailPatch() }, {
      outcome, remark: remark.trim(), next: o.none ? '' : next, rating: rating || undefined,
      priority: ratingToPriority(rating) || undefined, mode: 'visit', visit: pin ? { lat: pin.lat, lng: pin.lng } : undefined,
      extra: { ...facts(), ...pinFields(base) },
    })
    navigator.vibrate?.(40)
    toast(adding ? `${d.name.trim()} added ✓` : outcome === 'Onboarded' ? '🎉 Onboarded! Great work' : 'Visit saved ✓')
    onClose()
  }

  const saveRecord = () => {
    if (!checkRecord()) return
    saveDetails(lead, { ...lead, ...detailPatch(), ...facts(), ...pinFields(lead) })
    toast('Details saved ✓')
    onClose()
  }

  const del = () => {
    if (!window.confirm(`Delete ${lead.name}? This cannot be undone.`)) return
    removeLead(lead.id); toast('Deleted'); onClose()
  }

  const footer = tab === 'history' ? null : (
    <div className="sheet-foot">
      {!adding && tab === 'visit' && o?.need && !next && <p className="mk-need">⏰ Pick a follow-up date to save</p>}
      <button type="button" className="btn3d lime big" disabled={busy} onClick={tab === 'details' && !adding ? saveRecord : saveVisit}>
        <Icon name="check" size={20} /> {adding ? 'Save distributor' : tab === 'details' ? 'Save changes' : 'Save visit'}
      </button>
    </div>
  )

  const hist = lead ? (lead.calls || []).filter((c) => !['Checked In'].includes(c.outcome)) : []

  return (
    <Sheet onClose={onClose} footer={footer}>
      <div className="mk">
        <header className="mk-head">
          <span className="mk-ico">🥛</span>
          <div>
            <small>{adding ? 'New distributor · your own source' : `${zoneOf(lead.area) !== 'Other' ? zoneOf(lead.area) : 'Chennai'}`}</small>
            <h2>{adding ? 'Add distributor' : lead.name}</h2>
            {!adding && <p>📍 {lead.area || 'Area not set'}{lead.contactName ? ` · ${lead.contactName}` : ''}</p>}
          </div>
          <button type="button" className="ls-x" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </header>

        {!adding && (
          <>
            <div className="mk-badges">
              <span className={`mk-src ${own ? 'own' : 'adm'}`}>{own ? '🧭 Own source' : '🏢 Admin list'}</span>
              <span className="hr-fs" style={{ '--fc': fs.color, '--fb': fs.bg }}>{fs.icon} {fs.label}</span>
              {Number(lead.rating) > 0 && <StarsRO value={Number(lead.rating)} size={13} />}
              {lead.nextFollowUp && !['Onboarded', 'Not Interested'].includes(lead.status) && <span className="due upcoming"><Icon name="clock" size={12} /> {fmtWhen(lead.nextFollowUp)}</span>}
            </div>
            {brandsOf(lead).length > 0 && <div className="mk-brands">{brandsOf(lead).map((b) => <span key={b}>{b}</span>)}</div>}
            <div className="mk-act">
              {lead.phone ? <a className="hr-b" href={telHref(lead.phone)} onClick={(e) => { if (!startCall(lead)) e.preventDefault() }}><Icon name="phone" size={17} /> Call</a> : <span className="hr-b off">No phone</span>}
              {lead.phone ? <a className="hr-b" href={waHref(lead.phone, `Hi ${lead.contactName || lead.name}, this is ${session?.name || 'Sridhi'} from Sridhi. `)} target="_blank" rel="noreferrer"><Icon name="whatsapp" size={17} /> WhatsApp</a> : <span className="hr-b off">—</span>}
              <MapButton lead={lead} className="hr-b"><Icon name="pin" size={17} /> {hotelPoint(lead) ? 'Map' : 'Find'}</MapButton>
            </div>
            {lead.lastRemark && <p className="mk-last"><b>Last remark:</b> {lead.lastRemark}</p>}
            <div className="mk-tabs" role="tablist">
              {[...(isAdmin ? [] : [['visit', '✍️ Visit']]), ['details', '📝 Details'], ['history', `🕘 History (${hist.length})`]].map(([k, t]) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
                  {tab === k && <motion.span layoutId="mk-tab" className="mk-tab-bg" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                  <span>{t}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ---------- DETAILS ---------- */}
        {(tab === 'details' || adding) && (
          <section className="mk-sec">
            {adding && <p className="mk-hint">You found a distributor that is not on the admin list. Fill what you know now; you can complete the rest later. Admin sees it as <b>Own source</b>.</p>}
            <label className="field"><span>Distributor / agency name *</span><input value={d.name} onChange={set('name')} placeholder="e.g. Sri Murugan Milk Agency" autoFocus={adding} /></label>
            <div className="mk-two">
              <label className="field"><span>Owner / contact person</span><input value={d.contactName} onChange={set('contactName')} placeholder="Name" /></label>
              <label className="field"><span>Phone {adding ? '*' : ''}</span><input inputMode="tel" value={d.phone} onChange={set('phone')} placeholder="10-digit number" /></label>
            </div>
            <ChennaiAreaPicker value={d.area} onChange={(v) => setD((p) => ({ ...p, area: v }))} />
            <label className="field"><span>Shop address / landmark</span><input value={d.address} onChange={set('address')} placeholder="Street, landmark" /></label>
            <PinField pin={pin} onChange={setPin} cur={lead ? hotelPoint(lead) : null} lead={lead} />
            <label className="field"><span>Notes</span><textarea rows={2} value={d.notes} onChange={set('notes')} placeholder="Anything useful for the next visit" /></label>
            {isAdmin && <div className="mk-two"><label className="field"><span>Alternate phone</span><input value={d.altPhone} onChange={set('altPhone')} /></label></div>}
          </section>
        )}

        {/* ---------- VISIT ---------- */}
        {(tab === 'visit' || adding) && !isAdmin && (
          <>
            <section className="mk-sec">
              <h3 className="mk-h"><i>1</i> How did the visit go?</h3>
              <div className="mk-out">
                {MILK_OUTCOMES.map((x) => (
                  <button key={x.id} type="button" className={`${outcome === x.id ? 'on' : ''} ${x.none ? 'end' : ''}`} onClick={() => { setOutcome(x.id); if (x.none) setNext('') }}>
                    <em>{x.icon}</em><b>{x.t}</b><small>{x.s}</small>
                  </button>
                ))}
              </div>
            </section>

            <section className="mk-sec">
              <h3 className="mk-h"><i>2</i> How interested are they?</h3>
              <div className="mk-stars"><Stars value={rating} onChange={setRating} size={38} /><small>{RATING_LABEL[rating]}</small></div>
            </section>

            <section className="mk-sec">
              <h3 className="mk-h"><i>3</i> What did they handle?<small>Brands, litres, vehicle</small></h3>
              <div className="chips">{allBrands.map((b) => <button key={b} type="button" className={`chip ${brands.includes(b) ? 'on' : ''}`} onClick={() => toggleBrand(b)}>{b}</button>)}</div>
              <div className="mk-add"><input value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom())} placeholder="Another brand…" /><button type="button" className="btn-soft sm" onClick={addCustom}>Add</button></div>
              <div className="mk-two">
                <label className="field"><span>Milk per day (litres)</span><input inputMode="numeric" value={litres} onChange={(e) => setLitres(e.target.value)} placeholder="e.g. 500" /></label>
                <div className="field"><span>Own vehicle?</span><YesNo value={vehicle} onChange={setVehicle} /></div>
              </div>
              <div className="field"><span>Cold storage / fridge?</span><YesNo value={cold} onChange={setCold} /></div>
            </section>

            <section className="mk-sec">
              <h3 className="mk-h"><i>4</i> What did they say?</h3>
              <div className="chips scroll">{MILK_REMARKS.map((t) => <button key={t} type="button" className="chip" onClick={() => addRemark(t)}>＋ {t}</button>)}</div>
              <textarea rows={3} value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Type your remark… (what they said, what to do next)" />
            </section>

            {!o?.none && (
              <section className="mk-sec">
                <h3 className="mk-h"><i>5</i> When do you go back?{o?.need && <em className="mk-req">required</em>}</h3>
                <div className="chips">
                  {FOLLOW.filter((f) => !f.show || f.show()).map((f) => {
                    const v = f.at()
                    return <button key={f.id} type="button" className={`chip ${next === v ? 'on' : ''}`} onClick={() => setNext(next === v ? '' : v)}>{f.t}</button>
                  })}
                  {!o?.need && <button type="button" className={`chip ${!next ? 'on' : ''}`} onClick={() => setNext('')}>No follow-up</button>}
                </div>
                <label className="field"><span>Or pick a date and time</span><input type="datetime-local" value={toLocalInput(next)} onChange={(e) => setNext(fromLocalInput(e.target.value))} /></label>
                {next && <p className="mk-when">⏰ You will be reminded {fmtWhen(next)}</p>}
              </section>
            )}
          </>
        )}

        {/* ---------- HISTORY ---------- */}
        {tab === 'history' && !adding && (
          <section className="mk-sec">
            {hist.length === 0 && <p className="mk-hint">No visits yet.</p>}
            <ul className="mk-hist">
              {hist.map((c, i) => (
                <li key={c.id || i}>
                  <i>{c.mode === 'visit' ? '📍' : c.outcome === 'Details Updated' ? '📝' : '📞'}</i>
                  <div>
                    <b>{c.outcome}{c.rating ? ` · ${'⭐'.repeat(Number(c.rating))}` : ''}</b>
                    <small>{fmtWhen(c.at)}{c.by ? ` · ${c.by}` : ''}</small>
                    {c.remark && <p>{c.remark}</p>}
                    {c.next && <small className="mk-nx">⏰ go back {fmtWhen(c.next)}</small>}
                  </div>
                </li>
              ))}
            </ul>
            {isAdmin && <button type="button" className="mk-del" onClick={del}><Icon name="trash" size={16} /> Delete this distributor</button>}
          </section>
        )}
        {tab === 'details' && !adding && isAdmin && <button type="button" className="mk-del" onClick={del}><Icon name="trash" size={16} /> Delete this distributor</button>}
      </div>
    </Sheet>
  )
}

function YesNo({ value, onChange }) {
  return (
    <div className="mk-yn">
      {['Yes', 'No'].map((v) => <button key={v} type="button" className={value === v ? 'on' : ''} onClick={() => onChange(value === v ? '' : v)}>{v}</button>)}
    </div>
  )
}

/** the exact shop location: stand at the shop and use GPS, or paste a Google Maps link */
function PinField({ pin, onChange, cur, lead }) {
  const { resolveMapLink, toast } = useApp()
  const [st, setSt] = useState('idle') // idle | busy
  const [acc, setAcc] = useState(null)
  const [link, setLink] = useState('')
  const [open, setOpen] = useState(false)

  const gps = async () => {
    setSt('busy'); setAcc(null)
    try {
      const f = await bestFix({ ms: 10000, good: 15, onUpdate: (b) => setAcc(Math.round(b.acc)) })
      if (!inChennai(f)) { toast('That location is outside Chennai. Check and try again.', 'warn'); return setSt('idle') }
      onChange({ lat: f.lat, lng: f.lng, acc: f.acc, source: 'gps' }); setAcc(Math.round(f.acc)); navigator.vibrate?.(40)
    } catch (e) { toast(e?.message || 'Could not read your location', 'warn') }
    setSt('idle')
  }
  const fromLink = async () => {
    let p = parsePin(link)
    if (!p && isShortLink(link)) {
      setSt('busy'); const r = await resolveMapLink(link.trim()); setSt('idle')
      if (r.error) return toast(r.error, 'warn')
      p = r
    }
    if (!p) return toast('Paste a Google Maps link or “13.04, 80.23”', 'warn')
    if (!inChennai(p)) return toast('That point is outside Chennai', 'warn')
    onChange({ lat: p.lat, lng: p.lng, acc: 0, source: 'link' }); setLink(''); setOpen(false)
  }
  const shown = pin || cur
  return (
    <div className={`mk-pin ${shown ? 'ok' : ''}`}>
      <div className="mk-pin-t">
        <i>{shown ? '📍' : '🧭'}</i>
        <div>
          <b>{pin ? 'New location ready' : shown ? 'Exact location saved' : 'No exact location yet'}</b>
          <small>{pin ? `${pin.source === 'gps' ? `GPS ±${Math.round(pin.acc)} m` : 'From a link'}. Saved when you press Save.` : shown ? 'Update only if it is wrong.' : 'Stand at the shop and tap the GPS button.'}</small>
        </div>
        {shown && <a className="mk-pin-open" href={`https://www.google.com/maps/search/?api=1&query=${shown.lat},${shown.lng}`} target="_blank" rel="noreferrer">Open ↗</a>}
      </div>
      <div className="mk-pin-b">
        <button type="button" className="btn-soft" disabled={st === 'busy'} onClick={gps}>{st === 'busy' ? (acc ? `±${acc} m…` : 'Finding…') : '📡 Use my location'}</button>
        <button type="button" className="btn-soft" onClick={() => setOpen((o) => !o)}>🔗 Paste link</button>
      </div>
      {pin?.source === 'gps' && pin.acc > 60 && <p className="mk-pin-w" style={{ color: accLabel(pin.acc).c }}>Accuracy is {accLabel(pin.acc).t.toLowerCase()}. Step outside the shop and try again for a sharper spot.</p>}
      {open && (
        <div className="mk-add"><input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Google Maps link or 13.04, 80.23" /><button type="button" className="btn-soft sm" onClick={fromLink}>Use</button></div>
      )}
    </div>
  )
}
