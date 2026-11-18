import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../store'
import { Icon, Sheet } from '../ui'
import { StarsRO } from './Stars'
import MapButton from './MapPopup'
import ChennaiAreaPicker from './ChennaiAreaPicker'
import CameraCapture from './CameraCapture'
import { MILK_OUTCOMES, OUT, SRC_OWN, brandsOf, isOwn } from '../milk'
import { canonArea, zoneOf } from '../chennai'
import { FS, fieldStatusOf } from '../fieldStatus'
import { accLabel, bestFix, inChennai, isShortLink, locFields, parsePin } from '../location'
import { cloudReady, queuePhoto, thumbUrl, uploadPhoto } from '../photos'
import { atDay, cleanPhone, fmtWhen, fromLocalInput, hotelPoint, nowISO, telHref, toLocalInput, uid, waHref } from '../utils'

const FOLLOW = [
  { id: 'tom', t: 'Tomorrow', at: () => atDay(1, 11) },
  { id: 'd3', t: 'In 3 days', at: () => atDay(3, 11) },
  { id: 'wk', t: 'Next week', at: () => atDay(7, 11) },
  { id: 'mo', t: 'In 2 weeks', at: () => atDay(14, 11) },
]

/**
 * One milk distributor.
 *   Field person: ONE simple screen. Pick 1 of 4 outcomes, write a remark, take a live photo (camera only), done.
 *                 Location is captured automatically. Name + contact number + address can be added or corrected.
 *   Admin:        Details / History (with photos).
 * With no `id` it adds a NEW distributor the field person found (source = "Own source").
 */
export default function MilkSheet({ id, preset = {}, tab: tab0 = 'visit', onClose }) {
  const { allLeads, leads, session, logCall, saveDetails, removeLead, startCall, toast, openLead, flushPhotos } = useApp()
  const lead = id ? allLeads.find((l) => l.id === id) : null
  const adding = !lead
  const isAdmin = session?.role === 'admin'
  const [tab, setTab] = useState(isAdmin ? (tab0 === 'history' ? 'history' : 'details') : tab0 === 'history' ? 'history' : 'visit')

  const [d, setD] = useState(() => ({
    name: lead?.name || preset.name || '', contactName: lead?.contactName || '', phone: lead?.phone || '', altPhone: lead?.altPhone || '',
    area: lead?.area || preset.area || '', address: lead?.address || '', notes: lead?.notes || '',
  }))
  const set = (k) => (e) => setD((p) => ({ ...p, [k]: e.target.value }))

  const [outcome, setOutcome] = useState('')
  const [remark, setRemark] = useState('')
  const [next, setNext] = useState('')
  const [shot, setShot] = useState(null)      // { blob, url }
  const [cam, setCam] = useState(false)
  const [loc, setLoc] = useState(null)        // { lat, lng, acc }
  const [locErr, setLocErr] = useState('')
  const [pin, setPin] = useState(null)        // admin only
  const [more, setMore] = useState(adding)
  const [busy, setBusy] = useState('')
  const locRef = useRef(null); locRef.current = loc

  const o = OUT[outcome]
  const fs = lead ? fieldStatusOf(lead) : FS.todo
  const own = adding || isOwn(lead)

  /* location is captured the moment the screen opens, so the photo is stamped instantly */
  const getLoc = async () => {
    setLocErr('')
    try {
      const f = await bestFix({ ms: 12000, good: 20, onUpdate: (b) => b?.lat != null && setLoc((c) => (!c || b.acc < c.acc ? { lat: b.lat, lng: b.lng, acc: b.acc } : c)) })
      if (!inChennai(f)) { setLocErr('You seem to be outside Chennai. Check your location.'); return }
      setLoc({ lat: f.lat, lng: f.lng, acc: f.acc })
    } catch (e) { setLocErr(e?.message || 'Location is off. Turn on GPS and try again.') }
  }
  useEffect(() => { if (!isAdmin && tab === 'visit') getLoc() /* eslint-disable-next-line */ }, [])
  useEffect(() => () => { if (shot?.url) URL.revokeObjectURL(shot.url) }, [shot])

  const pick = (x) => {
    setOutcome(x.id)
    if (x.none) setNext('')
    else if (x.need && !next) setNext(FOLLOW[0].at())
    else if (!x.need) setNext('')
  }

  const detailPatch = () => ({ name: d.name.trim(), contactName: d.contactName.trim(), phone: cleanPhone(d.phone) || d.phone.trim(), altPhone: d.altPhone.trim(), area: canonArea(d.area), address: d.address.trim(), notes: d.notes.trim() })

  const checkRecord = () => {
    if (!d.name.trim()) { setMore(true); setTab(isAdmin ? 'details' : 'visit'); toast('Enter the customer name', 'warn'); return false }
    if ((adding || !isAdmin) && cleanPhone(d.phone).length < 10) { setMore(true); toast('Enter the 10-digit contact number', 'warn'); return false }
    if (!d.area.trim()) { setMore(true); toast('Choose the area', 'warn'); return false }
    if (adding) {
      const dup = leads.find((l) => l.type === 'milk' && cleanPhone(l.phone) === cleanPhone(d.phone))
      if (dup) { toast(`Already in your list: ${dup.name}${dup.area ? ` · ${dup.area}` : ''}`, 'warn'); openLead(dup.id); return false }
    }
    return true
  }

  const saveVisit = async () => {
    if (busy) return
    if (!checkRecord()) return
    if (!outcome) return toast('Choose how the visit went', 'warn')
    if (o.remarkReq && !remark.trim()) return toast('Write a short remark for “Other”', 'warn')
    if (o.need && !next) return toast('Pick when to go back', 'warn')
    if (!shot) return toast('Take the shop photo with the camera', 'warn')
    if (!loc && !locErr) return toast('Waiting for your location… one moment', 'warn')

    const base = lead || {
      id: uid(), type: 'milk', city: 'Chennai', bizType: 'Milk Distributor', source: SRC_OWN, status: 'Contacted', priority: 'Warm',
      calls: [], callCount: 0, nextFollowUp: '', createdAt: nowISO(), fieldId: session.id, fieldName: session.name, fieldAt: nowISO(),
    }
    const callId = uid()
    let photo = ''
    setBusy('Saving…')
    if (cloudReady() && navigator.onLine !== false) {
      try { setBusy('Uploading photo…'); photo = await uploadPhoto(shot.blob, callId) } catch { photo = '' }
    }
    if (!photo) await queuePhoto({ id: callId, leadId: base.id, callId, blob: shot.blob })

    const needPin = !hotelPoint(base) && loc
    logCall({ ...base, ...detailPatch() }, {
      id: callId, outcome, remark: remark.trim(), next: o.none ? '' : next, status: o.status, priority: o.id === 'Interested' ? 'Hot' : undefined,
      mode: 'visit', visit: loc ? { lat: loc.lat, lng: loc.lng, acc: loc.acc } : undefined, photo,
      extra: needPin ? locFields(session, base, loc, 'gps', loc.acc) : {},
    })
    navigator.vibrate?.(40)
    toast(!photo ? (cloudReady() ? 'Saved ✓ Photo will upload when network is back' : 'Saved ✓ Photo kept on phone') : adding ? `${d.name.trim()} added ✓` : 'Visit saved ✓')
    setBusy('')
    if (!photo) setTimeout(() => flushPhotos?.(), 4000)
    onClose()
  }

  const saveRecord = () => {
    if (!checkRecord()) return
    saveDetails(lead, { ...lead, ...detailPatch(), ...(pin ? locFields(session, lead, pin, pin.source, pin.acc) : {}) })
    toast('Details saved ✓')
    onClose()
  }

  const del = () => {
    if (!window.confirm(`Delete ${lead.name}? This cannot be undone.`)) return
    removeLead(lead.id); toast('Deleted'); onClose()
  }

  const footer = tab === 'history' ? null : (
    <div className="sheet-foot">
      <button type="button" className="btn3d lime big" disabled={!!busy} onClick={isAdmin && !adding ? saveRecord : saveVisit}>
        {busy ? <em className="spin" /> : <Icon name="check" size={20} />} {busy || (isAdmin && !adding ? 'Save changes' : adding ? 'Save customer & visit' : 'Save visit')}
      </button>
    </div>
  )

  const hist = lead ? (lead.calls || []).filter((c) => !['Checked In'].includes(c.outcome)) : []
  const dpin = loc || (lead ? hotelPoint(lead) : null)

  return (
    <Sheet onClose={onClose} footer={footer}>
      <div className="mk sv">
        <header className="mk-head">
          <span className="mk-ico">🥛</span>
          <div>
            <small>{adding ? 'New customer · your own find' : zoneOf(lead.area) !== 'Other' ? zoneOf(lead.area) : 'Chennai'}</small>
            <h2>{adding ? 'Add customer' : lead.name}</h2>
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
            <div className="mk-act">
              {lead.phone ? <a className="hr-b" href={telHref(lead.phone)} onClick={(e) => { if (!startCall(lead)) e.preventDefault() }}><Icon name="phone" size={17} /> Call</a> : <span className="hr-b off">No phone</span>}
              {lead.phone ? <a className="hr-b" href={waHref(lead.phone, `Hi ${lead.contactName || lead.name}, this is ${session?.name || 'Sridhi'} from Sridhi. `)} target="_blank" rel="noreferrer"><Icon name="whatsapp" size={17} /> WhatsApp</a> : <span className="hr-b off">—</span>}
              <MapButton lead={lead} className="hr-b"><Icon name="pin" size={17} /> {hotelPoint(lead) ? 'Map' : 'Find'}</MapButton>
            </div>
            {lead.lastRemark && <p className="mk-last"><b>Last remark:</b> {lead.lastRemark}</p>}
            {(isAdmin || hist.length > 0) && (
              <div className="mk-tabs" role="tablist">
                {[...(isAdmin ? [] : [['visit', '✍️ Visit']]), ...(isAdmin ? [['details', '📝 Details']] : []), ['history', `🕘 History (${hist.length})`]].map(([k, t]) => (
                  <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
                    {tab === k && <motion.span layoutId="mk-tab" className="mk-tab-bg" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                    <span>{t}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ---------- ADMIN DETAILS ---------- */}
        {tab === 'details' && isAdmin && (
          <section className="mk-sec">
            <label className="field"><span>Distributor / agency name *</span><input value={d.name} onChange={set('name')} /></label>
            <div className="mk-two">
              <label className="field"><span>Contact person</span><input value={d.contactName} onChange={set('contactName')} /></label>
              <label className="field"><span>Phone</span><input inputMode="tel" value={d.phone} onChange={set('phone')} /></label>
            </div>
            <ChennaiAreaPicker value={d.area} onChange={(v) => setD((p) => ({ ...p, area: v }))} />
            <label className="field"><span>Address / landmark</span><input value={d.address} onChange={set('address')} /></label>
            <PinField pin={pin} onChange={setPin} cur={lead ? hotelPoint(lead) : null} lead={lead} />
            <label className="field"><span>Notes</span><textarea rows={2} value={d.notes} onChange={set('notes')} /></label>
            <button type="button" className="mk-del" onClick={del}><Icon name="trash" size={16} /> Delete this distributor</button>
          </section>
        )}

        {/* ---------- FIELD: ONE SIMPLE SCREEN ---------- */}
        {tab === 'visit' && !isAdmin && (
          <>
            {adding && <p className="mk-hint">Found a shop that can sell Sridhi Idli &amp; Dosa Batter? Add it here. Admin will see it as <b>Own source</b>.</p>}

            <section className="mk-sec">
              <h3 className="mk-h"><i>1</i> How did it go?</h3>
              <div className="sv-out">
                {MILK_OUTCOMES.map((x) => (
                  <button key={x.id} type="button" className={`${x.tone} ${outcome === x.id ? 'on' : ''}`} onClick={() => pick(x)} aria-pressed={outcome === x.id}>
                    <em>{x.icon}</em><b>{x.t}</b><small>{x.s}</small>
                  </button>
                ))}
              </div>
            </section>

            <section className="mk-sec">
              <h3 className="mk-h"><i>2</i> Your remark{o?.remarkReq && <em className="mk-req">required</em>}</h3>
              <textarea rows={3} value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Type what they said or what you saw…" />
            </section>

            {o && !o.none && (
              <section className="mk-sec">
                <h3 className="mk-h"><i>3</i> Follow-up date{o.need ? <em className="mk-req">required</em> : <small>optional</small>}</h3>
                <div className="chips">
                  {FOLLOW.map((f) => { const v = f.at(); return <button key={f.id} type="button" className={`chip ${next === v ? 'on' : ''}`} onClick={() => setNext(next === v ? '' : v)}>{f.t}</button> })}
                </div>
                <label className="field"><span>Or pick a date and time</span><input type="datetime-local" value={toLocalInput(next)} onChange={(e) => setNext(fromLocalInput(e.target.value))} /></label>
                {next && <p className="mk-when">⏰ Reminder {fmtWhen(next)}</p>}
              </section>
            )}

            <section className="mk-sec">
              <h3 className="mk-h"><i>{o && !o.none ? 4 : 3}</i> Shop photo<em className="mk-req">camera only</em></h3>
              {shot ? (
                <div className="sv-shot">
                  <img src={shot.url} alt="Visit photo" />
                  <button type="button" className="btn-soft" onClick={() => setCam(true)}>🔄 Retake</button>
                </div>
              ) : (
                <button type="button" className="sv-cam" onClick={() => setCam(true)}>
                  <span>📷</span><b>Take photo now</b><small>Taken live at the shop · GPS and time are stamped on it</small>
                </button>
              )}
              <div className={`sv-loc ${loc ? 'ok' : locErr ? 'bad' : ''}`}>
                <i>{loc ? '📍' : locErr ? '⚠️' : '🛰️'}</i>
                <div>
                  <b>{loc ? 'Location captured' : locErr ? 'Location not available' : 'Capturing location…'}</b>
                  <small>{loc ? `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)} · ±${Math.round(loc.acc)} m (${accLabel(loc.acc).t})` : locErr || 'Keep GPS on. This takes a few seconds.'}</small>
                </div>
                <button type="button" onClick={getLoc}>↻</button>
              </div>
            </section>

            <section className="mk-sec">
              <button type="button" className="sv-more" onClick={() => setMore((m) => !m)} aria-expanded={more}>
                <span>👤 Customer details</span><small>{d.name ? `${d.name}${d.phone ? ` · ${d.phone}` : ''}` : 'Name, number, address'}</small><em>{more ? '▾' : '▸'}</em>
              </button>
              {more && (
                <div className="sv-fields">
                  <label className="field"><span>Customer name *</span><input value={d.name} onChange={set('name')} placeholder="Shop / agency name" autoFocus={adding} /></label>
                  <label className="field"><span>Contact number *</span><input inputMode="tel" value={d.phone} onChange={set('phone')} placeholder="10-digit mobile number" /></label>
                  <ChennaiAreaPicker value={d.area} onChange={(v) => setD((p) => ({ ...p, area: v }))} />
                  <label className="field"><span>Address (type it)</span><input value={d.address} onChange={set('address')} placeholder="Street, landmark" /></label>
                </div>
              )}
            </section>
          </>
        )}

        {cam && (
          <CameraCapture
            loc={locRef.current}
            label={`${d.name || 'Visit'} · ${d.area || 'Chennai'}`}
            onClose={() => setCam(false)}
            onShot={(blob) => { setShot({ blob, url: URL.createObjectURL(blob) }); setCam(false) }}
          />
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
                    <b>{c.outcome}</b>
                    <small>{fmtWhen(c.at)}{c.by ? ` · ${c.by}` : ''}</small>
                    {c.remark && <p>{c.remark}</p>}
                    {c.next && <small className="mk-nx">⏰ go back {fmtWhen(c.next)}</small>}
                    {c.photo && <a href={c.photo} target="_blank" rel="noreferrer" className="mk-ph"><img src={thumbUrl(c.photo, 160)} alt="Visit" loading="lazy" /></a>}
                    {c.lat && <a className="mk-nx" href={`https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`} target="_blank" rel="noreferrer">📍 visit location ↗</a>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
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
