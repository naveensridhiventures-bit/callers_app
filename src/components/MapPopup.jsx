import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { useApp } from '../store'
import { Icon, Sheet } from '../ui'
import { WhyBox } from './ReasonChips'
import { fmtKm, hotelPoint, km, mapDirections, mapEmbed, mapOpen, telHref } from '../utils'
import { ADMIN_CONTACT } from '../constants'
import { isClosedHotel, mapLocked } from '../fieldStatus'

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

/** Shown instead of the map when the admin has not added this hotel's exact location yet. */
export function LockedMap({ lead, onClose }) {
  const { toast } = useApp()
  const num = String(ADMIN_CONTACT || '').replace(/\D/g, '')
  const msg = `Hi, please add the map location for "${lead.name}"${lead.area ? ` (${lead.area})` : ''}, Chennai. I am visiting it and cannot see the exact map.`
  const copy = async () => {
    try { await navigator.clipboard.writeText(msg); toast('Message copied ✓ Send it to admin') } catch { toast('Could not copy. Long-press the text to copy', 'warn') }
  }
  return (
    <Sheet onClose={onClose}>
      <div className="lk">
        <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        <div className="lk-ico"><span>🔒</span></div>
        <h2>Map is locked</h2>
        <p className="lk-name"><b>{lead.name}</b><small>{[lead.area, 'Chennai'].filter(Boolean).join(' · ')}</small></p>
        {isClosedHotel(lead)
          ? <p className="lk-lead">This hotel is marked <b>closed</b>, so no map is needed. If it has reopened, tell admin and ask them to add the map location.</p>
          : <p className="lk-lead">The exact map location of this hotel has not been added yet. <b>Call admin and ask them to add the map location.</b></p>}

        <ol className="lk-steps">
          <li><i>1</i><span>Call or message admin with the hotel name</span></li>
          <li><i>2</i><span>Admin adds the exact pin in <b>HR → Locations</b></span></li>
          <li><i>3</i><span>The map <b>unlocks here by itself</b> after the next sync</span></li>
        </ol>

        {lead.address && <p className="lk-addr"><Icon name="pin" size={15} /> Address on file: {lead.address}</p>}

        <div className="lk-act">
          {num && <a className="lk-call" href={`tel:+${num}`}><Icon name="phone" /> Call admin</a>}
          <a className={num ? '' : 'lk-call'} href={`https://wa.me/${num}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"><Icon name="whatsapp" /> {num ? 'WhatsApp' : 'Message admin on WhatsApp'}</a>
          <button type="button" onClick={copy}><Icon name="copy" /> Copy message</button>
        </div>
        <p className="lk-tip">💡 Standing at the hotel right now? Open <b>✍️ Remark</b> and tick <b>Save this spot as the hotel’s map pin</b>.</p>
      </div>
    </Sheet>
  )
}

/** A button that opens the popup. Rendered through a portal so cards with transforms can't break the overlay. */
export default function MapButton({ lead, className = 'round map', children, label = 'Location', lockedLabel = ' Map locked' }) {
  const { session } = useApp()
  const [open, setOpen] = useState(false)
  const locked = mapLocked(session, lead)
  return (
    <>
      <button type="button" className={`${className} ${locked ? 'locked' : ''}`} aria-label={locked ? `${label} (locked)` : label} onClick={(e) => { e.stopPropagation(); setOpen(true) }}>
        {locked ? <>🔒{children ? lockedLabel : ''}</> : children || <Icon name="pin" size={18} />}
      </button>
      {open && createPortal(locked ? <LockedMap lead={lead} onClose={() => setOpen(false)} /> : <MapPopup lead={lead} onClose={() => setOpen(false)} />, document.body)}
    </>
  )
}
