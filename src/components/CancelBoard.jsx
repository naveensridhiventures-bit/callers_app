import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useApp } from '../store'
import { Counter, Icon } from '../ui'
import { KG_BANDS, REASON, REASONS, kgBandOf, kgOf, reasonsOf } from '../cancelled'
import { KgBadge, ReasonChips } from './ReasonChips'
import { RemarkSheet } from './VisitMode'
import { StarsRO, ratingToPriority } from './Stars'
import { pointOf } from '../chennai'
import { areaOfLead } from '../fieldReport'
import { fmtKm, km, mapDirections, telHref, waHref } from '../utils'

const PAGE = 30

/** the field person's cancelled-order board: reasons, area and KG filters, then start the field work */
export default function CancelBoard({ hotels, doneToday = 0, me, locating, onNear, onStart }) {
  const { logCall, toast, openLead } = useApp()
  const [reason, setReason] = useState('all')
  const [area, setArea] = useState('all')
  const [band, setBand] = useState('all')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('kg')
  const [shown, setShown] = useState(PAGE)
  const [remark, setRemark] = useState(null)
  const [busy, setBusy] = useState(false)

  const rows = useMemo(() => hotels.map((l) => {
    const p = pointOf(l)
    return { l, ids: reasonsOf(l.stopReason), kg: kgOf(l), band: kgBandOf(l), area: areaOfLead(l), d: me && p ? km(me, p) : null }
  }), [hotels, me])

  // each filter's counts ignore itself, so the numbers on the chips always match what you will see
  const pass = (r, skip) => {
    const s = q.trim().toLowerCase()
    return (skip === 'reason' || reason === 'all' || r.ids.includes(reason))
      && (skip === 'area' || area === 'all' || r.area === area)
      && (skip === 'band' || band === 'all' || r.band === band)
      && (!s || `${r.l.name} ${r.l.phone} ${r.l.area} ${r.l.stopReason}`.toLowerCase().includes(s))
  }
  const list = useMemo(() => {
    const out = rows.filter((r) => pass(r))
    const by = {
      kg: (a, b) => b.kg - a.kg || (a.l.name || '').localeCompare(b.l.name || ''),
      near: (a, b) => (a.d ?? 1e9) - (b.d ?? 1e9) || b.kg - a.kg,
      area: (a, b) => a.area.localeCompare(b.area) || b.kg - a.kg,
    }
    return out.sort(by[sort])
  }, [rows, reason, area, band, q, sort]) // eslint-disable-line react-hooks/exhaustive-deps

  const facet = (skip, keyFn) => {
    const m = new Map()
    rows.filter((r) => pass(r, skip)).forEach((r) => (Array.isArray(keyFn(r)) ? keyFn(r) : [keyFn(r)]).forEach((k) => {
      const o = m.get(k) || { n: 0, kg: 0 }; o.n++; o.kg += r.kg; m.set(k, o)
    }))
    return m
  }
  const reasonF = facet('reason', (r) => r.ids)
  const areaF = facet('area', (r) => r.area)
  const bandF = facet('band', (r) => r.band)
  const areas = [...areaF].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]))
  const totalKg = list.reduce((n, r) => n + r.kg, 0)
  const allKg = rows.reduce((n, r) => n + r.kg, 0)
  const top = [...reasonF].filter(([id]) => id !== 'none').sort((a, b) => b[1].n - a[1].n)[0]
  const filtered = reason !== 'all' || area !== 'all' || band !== 'all' || q.trim()
  const reset = () => { setReason('all'); setArea('all'); setBand('all'); setQ(''); setShown(PAGE) }
  const set = (fn) => (v) => { fn(v); setShown(PAGE) }
  const label = [area === 'all' ? '' : area, reason === 'all' ? '' : REASON[reason].label, band === 'all' ? '' : KG_BANDS.find((b) => b.id === band)?.label].filter(Boolean).join(' · ') || 'All cancelled'

  const saveRemark = async ({ outcome, rating, remark: note, next, extra }) => {
    setBusy(true)
    const l = remark
    logCall(l, { outcome, rating, remark: note, next, extra, priority: ratingToPriority(rating) || undefined, mode: 'visit' })
    toast(outcome === 'Order Restarted' ? '🎉 Order restarted. Great work!' : 'Remark saved ✓')
    setRemark(null); setBusy(false)
  }

  return (
    <>
      <section className="card cb-hero">
        <div className="cb-hero-t"><h3>🚫 Cancelled orders</h3><span>Win these hotels back</span></div>
        <div className="cb-kpis">
          <div><b><Counter value={rows.length} /></b><small>Hotels</small></div>
          <div><b><Counter value={allKg} /></b><small>KG lost</small></div>
          <div><b>{top ? `${REASON[top[0]].icon} ${top[1].n}` : '-'}</b><small>{top ? REASON[top[0]].label : 'Top reason'}</small></div>
          <div><b><Counter value={doneToday} /></b><small>Visited today</small></div>
        </div>
      </section>

      <section className="card cb-filters">
        <h4>Why did they cancel? <small>tap to focus</small></h4>
        <div className="cb-reasons">
          <button className={`cb-tile all ${reason === 'all' ? 'on' : ''}`} onClick={() => set(setReason)('all')}>
            <em>📋</em><b>All</b><small>{[...reasonF.values()].length ? rows.filter((r) => pass(r, 'reason')).length : 0} hotels</small>
          </button>
          {REASONS.filter((r) => reasonF.has(r.id)).sort((a, b) => reasonF.get(b.id).n - reasonF.get(a.id).n).map((r) => {
            const f = reasonF.get(r.id)
            return (
              <button key={r.id} className={`cb-tile ${reason === r.id ? 'on' : ''}`} style={{ '--tc': r.color, '--tb': r.bg }} onClick={() => set(setReason)(reason === r.id ? 'all' : r.id)}>
                <em>{r.icon}</em><b>{r.label}</b><small>{f.n} hotels · {f.kg} kg</small>
              </button>
            )
          })}
        </div>

        <AnimatePresence>
          {reason !== 'all' && (
            <motion.div className="cb-tip" style={{ '--tc': REASON[reason].color, '--tb': REASON[reason].bg }} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <b>{REASON[reason].icon} How to win them back</b>
              <p>{REASON[reason].tip}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <h4>Area</h4>
        <div className="chips scroll">
          <button className={`chip ${area === 'all' ? 'on' : ''}`} onClick={() => set(setArea)('all')}>All areas <b>{[...areaF.values()].reduce((n, o) => n + o.n, 0)}</b></button>
          {areas.map(([a, f]) => <button key={a} className={`chip ${area === a ? 'on' : ''}`} onClick={() => set(setArea)(area === a ? 'all' : a)}>{a} <b>{f.n}</b></button>)}
        </div>

        <h4>KG per order</h4>
        <div className="chips scroll">
          <button className={`chip ${band === 'all' ? 'on' : ''}`} onClick={() => set(setBand)('all')}>Any KG</button>
          {KG_BANDS.filter((b) => bandF.has(b.id)).map((b) => (
            <button key={b.id} className={`chip ${band === b.id ? 'on' : ''}`} onClick={() => set(setBand)(band === b.id ? 'all' : b.id)}>{b.label} <b>{bandF.get(b.id).n}</b></button>
          ))}
        </div>

        <div className="cb-find">
          <input value={q} onChange={(e) => set(setQ)(e.target.value)} placeholder="Search hotel, phone, remark…" />
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
            <option value="kg">Biggest KG first</option>
            <option value="near">Nearest first</option>
            <option value="area">Area A to Z</option>
          </select>
        </div>
        {sort === 'near' && !me && <button className="btn-soft sm" disabled={locating} onClick={onNear}>{locating ? 'Finding…' : '📍 Allow location for nearest'}</button>}
      </section>

      <motion.button whileTap={{ scale: 0.97, y: 3 }} className="btn3d lime big fh-go" disabled={!list.length} onClick={() => onStart(list.map((r) => r.l), label)}>
        <Icon name="play" size={20} /> {list.length ? `Start field work · ${list.length} hotel${list.length > 1 ? 's' : ''} · ${totalKg} kg` : 'No hotels match these filters'}
      </motion.button>
      <p className="mini-note">The app takes you to the nearest hotel first, asks for your remark when you reach, then offers the next nearest.</p>

      <div className="sel-bar">
        <b>{list.length} hotel{list.length === 1 ? '' : 's'} · {totalKg} kg{filtered ? ' (filtered)' : ''}</b>
        {filtered && <button className="btn-soft sm" onClick={reset}>Clear filters</button>}
      </div>

      {list.slice(0, shown).map((r, i) => {
        const l = r.l
        const main = REASON[r.ids[0]]
        return (
          <motion.div key={l.id} layout className="cb-card" style={{ '--tc': main.color }} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03 }}>
            <div className="cb-top" onClick={() => openLead(l.id)}>
              <div className="cb-name">
                <b>{l.name}</b>
                <small>📍 {r.area === '(no area)' ? 'Area not given' : r.area}{r.d != null ? ` · ${fmtKm(r.d)} away` : ''}{l.phone ? ` · ${l.phone}` : ' · no number'}</small>
              </div>
              <KgBadge lead={l} big />
            </div>
            <div className="cb-why" onClick={() => openLead(l.id)}>
              <ReasonChips text={l.stopReason} big />
              {l.stopReason && <p>“{l.stopReason}”</p>}
            </div>
            {l.lastRemark && (
              <div className="cb-last">
                <small>Your last remark{l.lastOutcome ? ` · ${l.lastOutcome}` : ''}</small>
                <p>{l.lastRemark}</p>
                {Number(l.rating) > 0 && <StarsRO value={Number(l.rating)} size={12} />}
              </div>
            )}
            {l.notes && <p className="cb-note">📝 {l.notes}</p>}
            <div className="cb-act">
              {l.phone && <a href={telHref(l.phone)}><Icon name="phone" size={16} /> Call</a>}
              {l.phone && <a href={waHref(l.phone)} target="_blank" rel="noreferrer"><Icon name="whatsapp" size={16} /> Chat</a>}
              <a href={mapDirections(l)} target="_blank" rel="noreferrer"><Icon name="send" size={16} /> Go</a>
              <button className="main" onClick={() => setRemark(l)}>✍️ Remark</button>
            </div>
          </motion.div>
        )
      })}
      {list.length > shown && <button className="btn-soft" style={{ width: '100%' }} onClick={() => setShown((n) => n + PAGE)}>Show {Math.min(PAGE, list.length - shown)} more</button>}
      {!list.length && <div className="card empty"><div className="empty-ico">🔎</div><h3>No hotels match</h3><p>Clear a filter to see more.</p><button className="btn-soft" onClick={reset}>Clear filters</button></div>}

      <AnimatePresence>
        {remark && <RemarkSheet key={remark.id} lead={remark} reached={null} last={false} busy={busy} onSave={saveRemark} onBack={() => setRemark(null)} quick />}
      </AnimatePresence>
    </>
  )
}
