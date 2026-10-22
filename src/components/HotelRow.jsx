import { useApp } from '../store'
import { Icon } from '../ui'
import { StarsRO } from './Stars'
import MapButton from './MapPopup'
import { KgBadge, ReasonChips } from './ReasonChips'
import { REASON, reasonsOf } from '../cancelled'
import { areaOfLead } from '../fieldReport'
import { fieldStatusOf, hasPin, isClosedHotel } from '../fieldStatus'
import { bucket, fmtKm, fmtWhen, telHref } from '../utils'

/**
 * One hotel, built for the field: what they stopped for, what happened last, when to go back,
 * and the 3 things you do next (Map, Call, Remark). Optionally selectable for the visit run.
 */
export default function HotelRow({ lead: l, d, selected = false, onToggle, onRemark, onVisit, children }) {
  const { openLead, startCall, session } = useApp()
  const k = bucket(l)
  const main = REASON[reasonsOf(l.stopReason)[0]]
  const area = areaOfLead(l)
  const fs = fieldStatusOf(l)
  const pin = hasPin(l)
  const field = session?.role === 'field'
  const closed = !pin && isClosedHotel(l)
  const mapState = !field ? '' : pin ? 'pinned' : closed ? 'closed' : 'locked'
  return (
    <div className={`hr ${selected ? 'sel' : ''} ${mapState}`} style={{ '--tc': main.color }}>
      <div className="hr-top">
        {onToggle && (
          <button type="button" className={`hr-chk ${selected ? 'on' : ''}`} onClick={onToggle} aria-pressed={selected} aria-label={selected ? 'Unselect hotel' : 'Select hotel'}>
            <Icon name="check" size={18} />
          </button>
        )}
        <div className="hr-name" onClick={() => openLead(l.id)}>
          <b>{l.name}</b>
          <small>📍 {area === '(no area)' ? 'Area not given' : area}{d != null ? ` · ${fmtKm(d)} away` : ''}{l.phone ? '' : ' · no number'}</small>
        </div>
        <KgBadge lead={l} big />
      </div>

      <div className="hr-why" onClick={() => openLead(l.id)}>
        <span className="hr-lbl">Why they stopped</span>
        <ReasonChips text={l.stopReason} limit={3} />
        {l.stopReason && <p>“{l.stopReason}”</p>}
      </div>

      <div className="hr-meta">
        <span className="hr-fs" style={{ '--fc': fs.color, '--fb': fs.bg }}>{fs.icon} {fs.label}</span>
        {l.lastOutcome && fs.id !== 'todo' && <small className="hr-lo">{l.lastOutcome}</small>}
        {field && (pin
          ? <span className="hr-map ok">📍 Map ready</span>
          : closed ? <span className="hr-map shut">🏚️ Closed · no map</span> : <span className="hr-map lock">🔒 Map locked</span>)}
        {Number(l.rating) > 0 && <StarsRO value={Number(l.rating)} size={12} />}
        {l.nextFollowUp && k !== 'none' && <span className={`due ${k}`}><Icon name="clock" size={12} />{k === 'overdue' ? 'Overdue · ' : ''}{fmtWhen(l.nextFollowUp)}</span>}
      </div>
      {l.lastRemark && <p className="hr-last"><b>Last remark:</b> {l.lastRemark}</p>}

      <div className="hr-act">
        <MapButton lead={l} className={`hr-b ${field ? (pin ? 'map-ok' : 'map-lock') : ''}`}><Icon name="pin" size={16} /> Map</MapButton>
        {l.phone && (
          <a className="hr-b" href={telHref(l.phone)} onClick={(e) => { if (!startCall(l)) return e.preventDefault(); openLead(l.id, { calling: true }) }}>
            <Icon name="phone" size={16} /> Call
          </a>
        )}
        <button type="button" className="hr-b main" onClick={() => onRemark?.(l)}>✍️ Remark</button>
        {onVisit && <button type="button" className="hr-b go" onClick={() => onVisit(l)}><Icon name="play" size={15} /> Visit</button>}
      </div>
      {children}
    </div>
  )
}
