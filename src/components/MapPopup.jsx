import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { useApp } from '../store'
import { Icon, Sheet } from '../ui'
import { WhyBox } from './ReasonChips'
import { fmtKm, hotelPoint, km, mapDirections, mapEmbed, mapOpen, telHref } from '../utils'
import { mapLocked } from '../fieldStatus'
import { srcOf } from '../location'
import { ago } from '../analytics'
import LocationSheet from './LocationSheet'

/** Attractive hotel-location popup: live map, address, contact, navigate, share and GPS check-in. */
export function MapPopup({ lead, onClose }) {
  const { session, logCall, toast } = useApp()
  const [gps, setGps] = useState(null) // { state, dist }
  const [fix, setFix] = useState(false) // the "wrong spot? update it" sheet
  const pt = hotelPoint(lead)
  const canCheckIn = session && session.role !== 'admin'
  const canFix = session && (session.role === 'field' || session.role === 'admin') && lead.type === 'hotel'
  const src = srcOf(lead)

  const checkIn = () => {
    if (!navigator.geolocation) return toast('GPS is not available on this device', 'warn')
    setGps({ state: 'loading' })
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const me = { lat: p.coords.latitude, lng: p.coords.longitude }
        const dist = pt ? km(me, pt) : null
        logCall(lead, { outcome: 'Checked In', remark: dist != null ? `Checked in ${fmtKm(dist)} from the hotel` : 'Checked in (hotel has no exact pin)', next: lead.nextFollowUp, visit: me })
        setGps({ state: 'done', dist })
        toast('✅ Check-in saved with your location')
      },
      () => { setGps(null); toast('Allow location access to check in', 'warn') },
      { enableHighAccuracy: true, timeout: 12000 }
    )
  }
  const share = `📍 ${lead.name}\n${[lead.address, lead.area].filter(Boolean).join(', ')}\n${mapOpen(lead)}`

  return (
    <Sheet onClose={onClose}>
      <div className="mp">
        <div className="mp-head">
          <button className="icon-btn light" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
          <span className="mp-pin">🏨</span>
          <h2>{lead.name}</h2>
          <p>{[lead.area, 'Chennai'].filter(Boolean).join(' · ')}</p>
          <div className="mp-chips">
            {lead.monthlyQty && lead.source !== 'Cancelled order' && <span>📦 {lead.monthlyQty} /mo before</span>}
          </div>
        </div>

        {lead.type === 'hotel' && <div className="mp-why"><WhyBox lead={lead} /></div>}

        <div className="mp-map">
          <iframe title="Hotel location" src={mapEmbed(lead)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          <div className="mp-offline">Map needs internet. Use <b>Navigate</b> below.</div>
        </div>

        <div className="mp-info">
          {(lead.address || lead.area) && <p><Icon name="pin" size={16} /> {lead.address || lead.area}</p>}
          {(lead.contactName || lead.phone) && (
            <p><Icon name="phone" size={16} /> {lead.contactName ? <b>{lead.contactName}</b> : null}{lead.contactName && lead.phone ? ' · ' : ''}{lead.phone ? <a href={telHref(lead.phone)}>{lead.phone}</a> : null}</p>
          )}
          {!lead.phone && !lead.contactName && <p className="mp-muted">No contact number given. Ask for the owner / manager on arrival and add it with ✏️ Edit.</p>}
          {pt && lead.locBy && <p className="mp-prov"><span>{src?.icon || '📍'}</span><span>Location added by <b>{lead.locBy}</b>{lead.locAt ? ` · ${ago(lead.locAt)}` : ''}{src ? ` · ${src.label}` : ''}{lead.locAcc ? ` · ±${lead.locAcc} m` : ''}</span></p>}
        </div>

        <div className="mp-actions">
          <motion.a whileTap={{ scale: 0.95 }} className="mp-go" href={mapDirections(lead)} target="_blank" rel="noreferrer"><Icon name="send" /> Navigate</motion.a>
          <motion.a whileTap={{ scale: 0.95 }} href={mapOpen(lead)} target="_blank" rel="noreferrer">🗺 Open in Maps</motion.a>
          <motion.a whileTap={{ scale: 0.95 }} href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noreferrer"><Icon name="whatsapp" /> Share</motion.a>
          {lead.phone && <motion.a whileTap={{ scale: 0.95 }} href={telHref(lead.phone)}><Icon name="phone" /> Call</motion.a>}
        </div>

        {canFix && pt && <button type="button" className="mp-fix" onClick={() => setFix(true)}>✏️ Wrong spot? Update this location</button>}

        {canCheckIn && (
          <button className="mp-checkin" disabled={gps?.state === 'loading'} onClick={checkIn}>
            {gps?.state === 'loading' ? 'Finding you…' : gps?.state === 'done' ? (gps.dist == null ? '✅ Checked in' : gps.dist < 0.25 ? `✅ Checked in · you are at the hotel (${fmtKm(gps.dist)})` : `⚠️ Checked in · ${fmtKm(gps.dist)} from the hotel pin`) : '📍 I have reached - check in'}
          </button>
        )}
      </div>
      {fix && <LocationSheet lead={lead} initialTab="gps" onClose={() => setFix(false)} onSaved={onClose} />}
    </Sheet>
  )
}

/**
 * A button that opens the popup. Rendered through a portal so cards with transforms can't break the overlay.
 * A field person's hotel with no exact pin opens the "Add location" sheet instead (GPS, find online, paste link).
 */
export default function MapButton({ lead, className = 'round map', children, label = 'Location', lockedLabel = ' Add location' }) {
  const { session } = useApp()
  const [open, setOpen] = useState(null) // 'add' | 'view' : fixed when opened, so saving a pin does not swap the sheet away
  const locked = mapLocked(session, lead)
  return (
    <>
      <button type="button" className={`${className} ${locked ? 'locked' : ''}`} aria-label={locked ? 'Add location' : label} onClick={(e) => { e.stopPropagation(); setOpen(locked ? 'add' : 'view') }}>
        {locked ? <>📍<b className="plus">+</b>{children ? lockedLabel : ''}</> : children || <Icon name="pin" size={18} />}
      </button>
      {open && createPortal(open === 'add' ? <LocationSheet lead={lead} onClose={() => setOpen(null)} /> : <MapPopup lead={lead} onClose={() => setOpen(null)} />, document.body)}
    </>
  )
}
