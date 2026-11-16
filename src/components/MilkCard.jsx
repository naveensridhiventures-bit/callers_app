import { useApp } from '../store'
import { Icon } from '../ui'
import { StarsRO } from './Stars'
import MapButton from './MapPopup'
import { brandsOf, isOwn } from '../milk'
import { fieldStatusOf } from '../fieldStatus'
import { bucket, fmtKm, fmtWhen, hotelPoint, telHref } from '../utils'

/** One milk distributor in a list: who, where, what they handle, what happened last and the 3 things to do next. */
export default function MilkCard({ lead: l, n, leg, d, showArea = false, children }) {
  const { openLead, startCall } = useApp()
  const fs = fieldStatusOf(l)
  const k = bucket(l)
  const own = isOwn(l)
  const brands = brandsOf(l)
  const pinned = !!hotelPoint(l)
  return (
    <div className={`hr mc ${fs.id} ${k === 'overdue' ? 'late' : ''}`} style={{ '--tc': fs.color }}>
      <div className="hr-top mc-top" onClick={() => openLead(l.id)}>
        {n != null && <i className="mc-n">{n}</i>}
        <div className="hr-name mc-name">
          <b>{l.name}</b>
          <small>
            {showArea && l.area ? `📍 ${l.area} · ` : ''}{l.contactName ? `👤 ${l.contactName} · ` : ''}{l.phone || 'no phone'}
            {leg != null ? ` · ${fmtKm(leg)}${n === 1 ? ' from you' : ' next'}` : d != null ? ` · ${fmtKm(d)} away` : ''}
          </small>
        </div>
        <span className={`mk-src ${own ? 'own' : 'adm'}`}>{own ? '🧭 Own' : '🏢 Admin'}</span>
      </div>

      {(brands.length > 0 || l.dailyQty) && (
        <div className="mc-brands" onClick={() => openLead(l.id)}>
          {brands.slice(0, 4).map((b) => <span key={b}>{b}</span>)}
          {l.dailyQty && <span className="lt">🥛 {l.dailyQty} L/day</span>}
          {l.vehicle === 'Yes' && <span className="lt">🚚 Vehicle</span>}
          {l.coldStorage === 'Yes' && <span className="lt">❄️ Cold storage</span>}
        </div>
      )}

      <div className="hr-meta" onClick={() => openLead(l.id)}>
        <span className="hr-fs" style={{ '--fc': fs.color, '--fb': fs.bg }}>{fs.icon} {fs.label}</span>
        {l.lastOutcome && fs.id !== 'todo' && <small className="hr-lo">{l.lastOutcome}</small>}
        {Number(l.rating) > 0 && <StarsRO value={Number(l.rating)} size={12} />}
        {l.nextFollowUp && k !== 'none' && <span className={`due ${k}`}><Icon name="clock" size={12} />{k === 'overdue' ? 'Overdue · ' : ''}{fmtWhen(l.nextFollowUp)}</span>}
        {!pinned && <span className="hr-map lock">📍 No exact pin</span>}
      </div>
      {l.lastRemark && <p className="hr-last" onClick={() => openLead(l.id)}><b>Last remark:</b> {l.lastRemark}</p>}

      <div className="hr-act">
        <MapButton lead={l} className="hr-b"><Icon name="pin" size={16} /> Map</MapButton>
        {l.phone
          ? <a className="hr-b" href={telHref(l.phone)} onClick={(e) => { if (!startCall(l)) e.preventDefault() }}><Icon name="phone" size={16} /> Call</a>
          : <span className="hr-b off">No phone</span>}
        <button type="button" className="hr-b go" onClick={() => openLead(l.id)}>✍️ Visit</button>
      </div>
      {children}
    </div>
  )
}
