import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../store'
import { Avatar, Counter, Icon, StatusPill } from '../ui'
import { CORP_COLORS, HUBS, mapLeadsToHubs, mapLink } from '../hubs'
import { nameOf, telHref } from '../utils'

const CORPS = ['All', 'North', 'South', 'East', 'West', 'Central']

export default function Hubs() {
  const { leads, openLead } = useApp()
  const [corp, setCorp] = useState('All')
  const [q, setQ] = useState('')
  const [onlyLeads, setOnlyLeads] = useState(false)
  const [open, setOpen] = useState(null)
  const { byHub, unmapped } = useMemo(() => mapLeadsToHubs(leads), [leads])
  const total = leads.filter((l) => l.type !== 'number').length
  const mapped = total - unmapped.length
  const max = Math.max(1, ...[...byHub.values()].map((v) => v.length))

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return HUBS.filter((h) => (corp === 'All' || h.corp === corp) && (!onlyLeads || byHub.get(h.n).length))
      .filter((h) => !s || h.near.toLowerCase().includes(s) || `hub ${h.n}` === s || String(h.n) === s || h.areas.some((a) => a.a.toLowerCase().includes(s)) || byHub.get(h.n).some((x) => nameOf(x.lead).toLowerCase().includes(s) || (x.lead.area || '').toLowerCase().includes(s)))
      .sort((a, b) => byHub.get(b.n).length - byHub.get(a.n).length || a.n - b.n)
  }, [corp, q, onlyLeads, byHub])

  return (
    <div className="page hubs">
      <div className="page-h"><h1>Hubs</h1></div>

      <div className="hub-hero">
        <div><b><Counter value={HUBS.length} /></b><span>Hubs</span></div>
        <div><b><Counter value={HUBS.reduce((n, h) => n + h.areas.length, 0)} /></b><span>Areas covered</span></div>
        <div><b><Counter value={mapped} /></b><span>Distributors placed</span></div>
        <div className={unmapped.length ? 'warn' : ''}><b><Counter value={unmapped.length} /></b><span>No hub yet</span></div>
        <p>Every area is within <b>5 km by road</b> of its hub. Tap a hub to see its areas and distributors.</p>
      </div>

      <div className="hub-tools">
        <div className="search"><Icon name="search" size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search hub, area or distributor…" /></div>
        <div className="chips scroll datechips">
          {CORPS.map((c) => (
            <button key={c} className={`chip ${corp === c ? 'on' : ''}`} onClick={() => setCorp(c)}>
              {c !== 'All' && <i style={{ background: CORP_COLORS[c] }} />}{c}
            </button>
          ))}
          <button className={`chip ${onlyLeads ? 'on' : ''}`} onClick={() => setOnlyLeads((v) => !v)}>✓ With distributors</button>
        </div>
      </div>

      <div className="hub-grid">
        {list.map((h, i) => {
          const items = byHub.get(h.n)
          const isOpen = open === h.n
          const col = CORP_COLORS[h.corp]
          return (
            <motion.div key={h.n} layout={false} className={`hub-card ${isOpen ? 'open' : ''}`} style={{ '--c': col }}
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }}>
              <button className="hub-head" onClick={() => setOpen(isOpen ? null : h.n)}>
                <span className="hub-no">{h.n}</span>
                <span className="hub-ttl"><b>Hub {h.n}</b><small>near {h.near.replace(/^near /, '')} · {h.corp}</small></span>
                <span className="hub-count"><b>{items.length}</b><small>{items.length === 1 ? 'distributor' : 'distributors'}</small></span>
                <span className="hub-chev"><Icon name="chevron" size={16} /></span>
              </button>
              <div className="hub-bar"><i style={{ width: `${(items.length / max) * 100}%` }} /></div>
              {isOpen && (
                <div className="hub-body">
                  <div className="hub-meta">
                    <span>{h.areas.length} areas</span><span>up to {h.far} km by road</span>
                    <a href={mapLink(h)} target="_blank" rel="noreferrer">📍 Open map</a>
                  </div>
                  <div className="hub-areas">
                    {h.areas.map((a) => {
                      const n = items.filter((x) => (x.lead.area || '').toLowerCase().replace(/[^a-z0-9]/g, '') && a.a.toLowerCase().replace(/[^a-z0-9]/g, '').includes((x.lead.area || '').toLowerCase().replace(/[^a-z0-9]/g, ''))).length
                      return <span key={a.a} className={n ? 'has' : ''}>{a.a}{n ? <em>{n}</em> : null}</span>
                    })}
                  </div>
                  <h4 className="lbl">Distributors under this hub</h4>
                  {!items.length && <p className="hub-empty">No distributors in this hub yet.</p>}
                  {items.map(({ lead, also }) => (
                    <div key={lead.id} className="hub-lead" onClick={() => openLead(lead.id)}>
                      <Avatar name={nameOf(lead)} size={36} />
                      <div className="hl-info">
                        <b>{nameOf(lead)}</b>
                        <span>{lead.area || '—'}{also.length ? ` · also near Hub ${also.join(', ')}` : ''}</span>
                      </div>
                      <StatusPill status={lead.status} />
                      <a className="round call" href={telHref(lead.phone)} onClick={(e) => e.stopPropagation()} aria-label="Call"><Icon name="phone" size={15} /></a>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )
        })}
        {!list.length && <p className="hub-empty">No hubs match.</p>}
      </div>

      {unmapped.length > 0 && !q && corp === 'All' && !onlyLeads && (
        <div className="hub-card unmapped">
          <button className="hub-head" onClick={() => setOpen(open === 'x' ? null : 'x')}>
            <span className="hub-no">?</span>
            <span className="hub-ttl"><b>No hub yet</b><small>area empty or outside the hub plan</small></span>
            <span className="hub-count"><b>{unmapped.length}</b><small>distributors</small></span>
            <span className="hub-chev"><Icon name="chevron" size={16} /></span>
          </button>
          {open === 'x' && (
            <div className="hub-body">
              {unmapped.map((lead) => (
                <div key={lead.id} className="hub-lead" onClick={() => openLead(lead.id)}>
                  <Avatar name={nameOf(lead)} size={36} />
                  <div className="hl-info"><b>{nameOf(lead)}</b><span>{lead.area || 'Area not filled'}</span></div>
                  <StatusPill status={lead.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
