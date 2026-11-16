import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../store'
import { Counter, Icon } from '../ui'
import MilkCard from '../components/MilkCard'
import { ZONE_LIST, areaBoard, isMilk } from '../milk'
import { CHENNAI_AREAS, planRoute, pointOf } from '../chennai'
import { FIELD_STATUS, fieldStatusOf } from '../fieldStatus'
import { useGeo } from '../useGeo'
import { bucket, km } from '../utils'

const ALL = 'all'
const VIEWS = [['all', 'All areas'], ['with', 'With distributors'], ['due', 'Follow-up due'], ['empty', 'No distributor yet']]

/**
 * AREAS: every Chennai locality, with the distributors in it (admin list + the ones you found yourself).
 * Pick an area, visit its distributors one by one, add new ones you meet on the way.
 * The open area lives in the page history, so the phone's back button returns to the area list.
 */
export default function FieldAreas() {
  const { leads, session, sub, go } = useApp()
  const milk = useMemo(() => leads.filter(isMilk), [leads])
  const board = useMemo(() => areaBoard(milk, session), [milk, session])
  const open = sub && sub !== ALL ? board.find((b) => b.area === sub) : null
  return open ? <AreaDetail key={open.area} a={open} back={() => go('areas', ALL)} /> : <AreaGrid board={board} milk={milk} open={(a) => go('areas', a)} />
}

/* ======================= all Chennai areas ======================= */
function AreaGrid({ board, milk, open }) {
  const { session, openMilkForm } = useApp()
  const [q, setQ] = useState('')
  const [zone, setZone] = useState('all')
  const [view, setView] = useState(() => localStorage.getItem('sridhi.areaView') || 'with')
  useEffect(() => { try { localStorage.setItem('sridhi.areaView', view) } catch { /* ignore */ } }, [view])

  const total = milk.length
  const doneN = milk.filter((l) => ['visited', 'notint'].includes(fieldStatusOf(l).id)).length
  const dueN = milk.filter((l) => ['overdue', 'today'].includes(bucket(l))).length
  const ownN = milk.filter((l) => l.source === 'Own source').length
  const withN = board.filter((b) => b.n > 0).length
  const todayN = board.reduce((n, b) => n + b.today, 0)
  const pct = total ? Math.round((doneN / total) * 100) : 0

  const s = q.trim().toLowerCase()
  const inZone = (b) => zone === 'all' || b.zone === zone
  const match = (b) => (!s || `${b.area} ${b.zone}`.toLowerCase().includes(s))
  const shown = board.filter((b) => inZone(b) && match(b) && (view === 'all' || (view === 'with' && b.n > 0) || (view === 'due' && b.follow > 0) || (view === 'empty' && b.n === 0)))
    .sort((a, b) => (b.follow - a.follow) || (b.n - a.n) || a.area.localeCompare(b.area))
  const zoneCount = (z) => board.filter((b) => b.zone === z && (view === 'all' || (view === 'with' && b.n > 0) || (view === 'due' && b.follow > 0) || (view === 'empty' && b.n === 0))).length
  const cnt = { all: board.length, with: withN, due: board.filter((b) => b.follow > 0).length, empty: board.length - withN }

  return (
    <div className="page ma">
      <section className="fh-hero ma-hero">
        <div>
          <small>🥛 CHENNAI · MILK DISTRIBUTORS</small>
          <h1>Pick an area, visit, update.</h1>
          <p><b>{doneN}</b> of <b>{total}</b> distributors done · <b>{withN}</b> areas covered by the list · <b>{board.length}</b> Chennai areas in all.</p>
        </div>
        <div className="fh-ring" style={{ '--p': pct }}><b>{pct}%<small>DONE</small></b></div>
      </section>

      <div className="kpis">
        <div className="kpi"><em>🥛</em><b><Counter value={total} /></b><span>Distributors</span></div>
        <div className="kpi"><em>⏰</em><b><Counter value={dueN} /></b><span>Follow-up due</span></div>
        <div className="kpi"><em>📍</em><b><Counter value={todayN} /></b><span>Visited today</span></div>
        <div className="kpi"><em>🧭</em><b><Counter value={ownN} /></b><span>Own source</span></div>
      </div>

      <div className="search">
        <Icon name="search" size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search any of ${board.length} Chennai areas…`} />
        {q && <button onClick={() => setQ('')} aria-label="Clear search"><Icon name="x" size={16} /></button>}
      </div>

      <div className="chips scroll">
        {VIEWS.map(([id, t]) => <button key={id} className={`chip ${view === id ? 'on' : ''}`} onClick={() => setView(id)}>{t} <b>{cnt[id]}</b></button>)}
      </div>
      <div className="chips scroll ma-zones">
        <button className={`chip ${zone === 'all' ? 'on' : ''}`} onClick={() => setZone('all')}>🗺 All Chennai</button>
        {ZONE_LIST.filter((z) => board.some((b) => b.zone === z)).map((z) => (
          <button key={z} className={`chip ${zone === z ? 'on' : ''}`} onClick={() => setZone(zone === z ? 'all' : z)}>{z} <b>{zoneCount(z)}</b></button>
        ))}
      </div>

      <div className="ma-grid">
        {shown.map((b, i) => (
          <motion.button key={b.area} type="button" className={`ma-tile ${b.state}`} onClick={() => open(b.area)}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 14) * 0.02 }} whileTap={{ scale: 0.97 }}>
            <span className="ma-z">{b.zone.replace(' Chennai', '').replace(' (Ambattur - Avadi belt)', '')}</span>
            <b className="ma-name">{b.area}</b>
            {b.n > 0 ? (
              <>
                <div className="ma-num"><strong>{b.n}</strong><small>distributor{b.n > 1 ? 's' : ''}</small></div>
                <div className="ma-bar"><i style={{ width: `${b.pct}%` }} /></div>
                <div className="ma-tags">
                  {b.state === 'done' && <span className="ok">✅ All done</span>}
                  {b.follow > 0 && <span className="due">⏰ {b.follow} due</span>}
                  {b.admin > 0 && <span>🏢 {b.admin}</span>}
                  {b.own > 0 && <span>🧭 {b.own}</span>}
                </div>
              </>
            ) : (
              <div className="ma-empty"><em>＋</em><small>No distributor yet</small></div>
            )}
          </motion.button>
        ))}
      </div>

      {!shown.length && (
        <div className="card empty">
          <div className="empty-ico">🗺</div>
          <h3>{s ? `No area called “${q}”` : 'Nothing here'}</h3>
          <p>{s ? 'Check the spelling, or add a distributor and type this area name. It is saved for everyone.' : 'Try another filter.'}</p>
          <div className="mk-empty-b">
            {s && <button className="btn-soft" onClick={() => openMilkForm({ area: q.trim() })}>＋ Add distributor in “{q.trim()}”</button>}
            {view !== 'all' && <button className="btn-soft" onClick={() => setView('all')}>Show all areas</button>}
          </div>
        </div>
      )}

      {!milk.length && (
        <div className="card empty">
          <div className="empty-ico">🥛</div>
          <h3>No distributors assigned to you yet</h3>
          <p>{session?.name?.split(' ')[0] || 'Hi'}, the admin will assign the distributor list to you. Meanwhile you can add distributors you find yourself with the green button.</p>
        </div>
      )}

      <button type="button" className="ma-add" onClick={() => openMilkForm()}><Icon name="plus" size={20} /> Add distributor</button>
    </div>
  )
}

/* ======================= one area ======================= */
function AreaDetail({ a, back }) {
  const { openMilkForm } = useApp()
  const { me, state, locate } = useGeo()
  const [src, setSrc] = useState('all') // all | admin | own
  const [st, setSt] = useState('all')
  const [route, setRoute] = useState(false)

  const info = CHENNAI_AREAS.find((x) => x.a === a.area)
  const rows = useMemo(() => a.list.map((l) => ({ l, fs: fieldStatusOf(l).id, own: l.source === 'Own source' })), [a.list])
  const pass = (r, skip) => (skip === 'src' || src === 'all' || (src === 'own') === r.own) && (skip === 'st' || st === 'all' || r.fs === st)
  const stCount = (id) => rows.filter((r) => pass(r, 'st') && r.fs === id).length
  const srcCount = (own) => rows.filter((r) => pass(r, 'src') && r.own === own).length
  const list = rows.filter((r) => pass(r))

  // nearest-first visiting order (from the live position, else from the area centre)
  const ordered = useMemo(() => {
    const open = list.filter((r) => r.fs === 'todo' || r.fs === 'followup').map((r) => r.l)
    const rest = list.filter((r) => !(r.fs === 'todo' || r.fs === 'followup')).map((r) => r.l)
    const start = me || (info ? { lat: info.lat, lng: info.lng } : null)
    const r = route ? planRoute(start, open) : open.map((l) => ({ l, pt: pointOf(l), leg: null })).sort((x, y) => (x.l.nextFollowUp || '9').localeCompare(y.l.nextFollowUp || '9'))
    return { open: r, rest }
  }, [list, route, me, info])

  const mapsRoute = () => {
    const pts = ordered.open.map((x) => x.pt).filter(Boolean)
    if (!pts.length) return
    const f = (p) => `${p.lat},${p.lng}`
    const dest = pts[pts.length - 1], way = pts.slice(0, -1).slice(0, 9)
    const u = `https://www.google.com/maps/dir/?api=1&travelmode=driving${me ? `&origin=${f(me)}` : ''}&destination=${f(dest)}${way.length ? `&waypoints=${encodeURIComponent(way.map(f).join('|'))}` : ''}`
    window.open(u, '_blank', 'noopener')
  }
  const findMe = async () => { await locate(); setRoute(true) }
  const dist = (l) => { const p = pointOf(l); return me && p ? km(me, p) : null }
  const away = (l) => (route ? undefined : dist(l))

  return (
    <div className="page ma">
      <div className="ma-back">
        <button type="button" className="ma-back-b" onClick={back}><Icon name="chevron" size={18} style={{ transform: 'rotate(180deg)' }} /> All areas</button>
        <button type="button" className="btn-soft sm" onClick={() => openMilkForm({ area: a.area })}><Icon name="plus" size={15} /> Add here</button>
      </div>

      <section className={`fh-hero ma-hero ${a.state}`}>
        <div>
          <small>{a.zone.toUpperCase()}</small>
          <h1>{a.area}</h1>
          <p>{a.n ? <><b>{a.done}</b> of <b>{a.n}</b> done{a.follow ? <> · <b>{a.follow}</b> follow-up due</> : ''}</> : 'No distributor in this area yet.'}</p>
        </div>
        {a.n > 0 && <div className="fh-ring" style={{ '--p': a.pct }}><b>{a.pct}%<small>DONE</small></b></div>}
      </section>

      {a.n > 0 && (
        <>
          <div className="ma-split">
            <button className={`${src === 'all' ? 'on' : ''}`} onClick={() => setSrc('all')}><b>{a.n}</b><span>All</span></button>
            <button className={`${src === 'admin' ? 'on' : ''}`} onClick={() => setSrc(src === 'admin' ? 'all' : 'admin')}><b>{srcCount(false)}</b><span>🏢 Admin list</span></button>
            <button className={`${src === 'own' ? 'on' : ''}`} onClick={() => setSrc(src === 'own' ? 'all' : 'own')}><b>{srcCount(true)}</b><span>🧭 Own source</span></button>
          </div>
          <div className="chips scroll fp-st">
            <button className={`chip ${st === 'all' ? 'on' : ''}`} onClick={() => setSt('all')}>All status</button>
            {FIELD_STATUS.map((o) => <button key={o.id} className={`chip st-${o.id} ${st === o.id ? 'on' : ''}`} onClick={() => setSt(st === o.id ? 'all' : o.id)}>{o.icon} {o.label} <b>{stCount(o.id)}</b></button>)}
          </div>
          {ordered.open.length > 1 && (
            <div className="ma-route">
              <button type="button" className={`btn-soft ${route ? 'on' : ''}`} disabled={state === 'loading'} onClick={route ? () => setRoute(false) : findMe}>{state === 'loading' ? 'Finding you…' : route ? '✓ Nearest first' : '📍 Plan nearest-first route'}</button>
              {route && <button type="button" className="btn-soft" onClick={mapsRoute}><Icon name="send" size={15} /> Open route in Maps</button>}
            </div>
          )}
        </>
      )}

      {ordered.open.length > 0 && <div className="fp-sec ok"><i>📋</i><div><b>To do in {a.area} <em>{ordered.open.length}</em></b><small>{route ? 'In the order to visit them' : 'Follow-ups due first'}</small></div></div>}
      {ordered.open.map((x, i) => <MilkCard key={x.l.id} lead={x.l} n={route ? i + 1 : undefined} leg={route ? x.leg : undefined} d={away(x.l)} />)}

      {ordered.rest.length > 0 && <div className="fp-sec"><i>✅</i><div><b>Done <em>{ordered.rest.length}</em></b><small>Visited or not interested</small></div></div>}
      {ordered.rest.map((l) => <MilkCard key={l.id} lead={l} d={dist(l)} />)}

      {!list.length && a.n > 0 && (
        <div className="card empty"><div className="empty-ico">🔎</div><h3>No distributor matches</h3><p>Clear a filter to see more.</p><button className="btn-soft" onClick={() => { setSrc('all'); setSt('all') }}>Clear filters</button></div>
      )}

      {a.n === 0 && (
        <div className="card empty ma-none">
          <div className="empty-ico">🥛</div>
          <h3>No distributor in {a.area} yet</h3>
          <p>The admin has not listed one here. If you meet a milk distributor in this area, add it now. It is saved as <b>Own source</b> and admin can see it.</p>
          <button className="btn3d lime" onClick={() => openMilkForm({ area: a.area })}><Icon name="plus" size={18} /> Add distributor in {a.area}</button>
        </div>
      )}
    </div>
  )
}
