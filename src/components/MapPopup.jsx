import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { useApp } from '../store'
import { Icon, Sheet } from '../ui'
import { fmtKm, hotelPoint, km, mapDirections, mapEmbed, mapOpen, telHref } from '../utils'

/** Attractive hotel-location popup: live map, address, contact, navigate, share and GPS check-in. */
export function MapPopup({ lead, onClose }) {
  const { session, logCall, toast } = useApp()
  const [gps, setGps] = useState(null) // { state, dist }
  const pt = hotelPoint(lead)
  const canCheckIn = session && session.role !== 'admin'

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
            {lead.lastOrderOn && <span>🕒 Last order {lead.lastOrderOn}</span>}
            {lead.stopReason && <span>⚠️ {lead.stopReason}</span>}
            {lead.monthlyQty && <span>📦 {lead.monthlyQty}/mo before</span>}
          </div>
        </div>

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
        </div>

        <div className="mp-actions">
          <motion.a whileTap={{ scale: 0.95 }} className="mp-go" href={mapDirections(lead)} target="_blank" rel="noreferrer"><Icon name="send" /> Navigate</motion.a>
          <motion.a whileTap={{ scale: 0.95 }} href={mapOpen(lead)} target="_blank" rel="noreferrer">🗺 Open in Maps</motion.a>
          <motion.a whileTap={{ scale: 0.95 }} href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noreferrer"><Icon name="whatsapp" /> Share</motion.a>
          {lead.phone && <motion.a whileTap={{ scale: 0.95 }} href={telHref(lead.phone)}><Icon name="phone" /> Call</motion.a>}
        </div>

        {canCheckIn && (
          <button className="mp-checkin" disabled={gps?.state === 'loading'} onClick={checkIn}>
            {gps?.state === 'loading' ? 'Finding you…' : gps?.state === 'done' ? (gps.dist == null ? '✅ Checked in' : gps.dist < 0.25 ? `✅ Checked in · you are at the hotel (${fmtKm(gps.dist)})` : `⚠️ Checked in · ${fmtKm(gps.dist)} from the hotel pin`) : '📍 I have reached - check in'}
          </button>
        )}
      </div>
    </Sheet>
  )
}

/** A button that opens the popup. Rendered through a portal so cards with transforms can't break the overlay. */
export default function MapButton({ lead, className = 'round map', children, label = 'Location' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={className} aria-label={label} onClick={(e) => { e.stopPropagation(); setOpen(true) }}>{children || <Icon name="pin" size={18} />}</button>
      {open && createPortal(<MapPopup lead={lead} onClose={() => setOpen(false)} />, document.body)}
    </>
  )
}
