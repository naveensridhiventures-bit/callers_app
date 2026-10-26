import { Fragment, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../store'
import { Icon } from '../ui'
import HotelRow from '../components/HotelRow'
import VisitMode from '../components/VisitMode'
import { useQuickRemark } from '../components/QuickRemark'
import { KG_BANDS, REASON, REASONS, kgBandOf, kgOf, reasonsOf } from '../cancelled'
import { useGeo } from '../useGeo'
import { pointOf } from '../chennai'
import { areaOfLead, buildFieldReport, rangeFor } from '../fieldReport'
import { bucket, km } from '../utils'
import { CLOSED } from '../constants'
import { FIELD_STATUS, fieldStatusOf, hasPin } from '../fieldStatus'

const PAGE = 25
const TABS = [['todo', 'To visit'], ['due', 'Follow-up due'], ['done', 'Done today'], ['all', 'All hotels']]

/**
 * PLAN: the field person's first screen of work.
 *  1. choose the list (To visit / Follow-up due / Done today)  2. filter by area, reason, KG
 *  3. tick the hotels (or none = all shown)                    4. Start visit
 */
export default function FieldPlan() {
  const { leads, session, openForm, toast } = useApp()
  const { me, state, locate } = useGeo()
  const quick = useQuickRemark()

  const [tab, setTab] = useState('todo')
  const [area, setArea] = useState(() => { const a = localStorage.getItem('sridhi.planArea') || 'all'; localStorage.removeItem('sridhi.planArea'); return a })
  const [reason, setReason] = useState('all')
  const [band, setBand] = useState('all')
  const [pinF, setPinF] = useState(() => { const v = localStorage.getItem('sridhi.planPin') || 'all'; localStorage.removeItem('sridhi.planPin'); return v }) // all | pin | lock
  const [stF, setStF] = useState('all') // all | visited | followup | notint | todo
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('near')
  const [more, setMore] = useState(false)
  const [sel, setSel] = useState(() => new Set())
  const [shown, setShown] = useState(PAGE)
  const [run, setRun] = useState(null)

  const hotels = useMemo(() => leads.filter((l) => l.type === 'hotel'), [leads])
  const today = useMemo(() => buildFieldReport({ leads: hotels, session, range: rangeFor('today') }), [hotels, session])
  const visitedIds = useMemo(() => new Set(today.entries.filter((e) => e.mode === 'visit').map((e) => e.lead.id)), [today])

  // the three lists
  const lists = useMemo(() => {
    const open = hotels.filter((l) => !CLOSED.includes(l.status))
    return {
      todo: open.filter((l) => !visitedIds.has(l.id)),
      due: open.filter((l) => ['overdue', 'today'].includes(bucket(l)) && !visitedIds.has(l.id)),
      done: hotels.filter((l) => visitedIds.has(l.id)),
      all: hotels,
    }
  }, [hotels, visitedIds])
  const base = lists[tab]

  const rows = useMemo(() => base.map((l) => {
    const p = pointOf(l)
    return { l, ids: reasonsOf(l.stopReason), kg: kgOf(l), band: kgBandOf(l), area: areaOfLead(l), d: me && p ? km(me, p) : null, pin: hasPin(l), fs: fieldStatusOf(l).id }
  }), [base, me])

  // every filter's counts ignore itself, so the number on a chip always matches what you will see
  const pass = (r, skip) => {
    const s = q.trim().toLowerCase()
    return (skip === 'reason' || reason === 'all' || r.ids.includes(reason))
      && (skip === 'area' || area === 'all' || r.area === area)
      && (skip === 'band' || band === 'all' || r.band === band)
      && (skip === 'pin' || pinF === 'all' || (pinF === 'pin') === r.pin)
      && (skip === 'st' || stF === 'all' || r.fs === stF)
      && (!s || `${r.l.name} ${r.l.phone} ${r.l.area} ${r.l.stopReason}`.toLowerCase().includes(s))
  }
  const list = useMemo(() => {
    const by = {
      near: (a, b) => (a.d ?? 1e9) - (b.d ?? 1e9) || b.kg - a.kg || (a.l.name || '').localeCompare(b.l.name || ''),
      kg: (a, b) => b.kg - a.kg || (a.l.name || '').localeCompare(b.l.name || ''),
      area: (a, b) => a.area.localeCompare(b.area) || b.kg - a.kg,
      follow: (a, b) => (a.l.nextFollowUp || '9').localeCompare(b.l.nextFollowUp || '9') || b.kg - a.kg,
    }
    const sorted = rows.filter((r) => pass(r)).sort(by[sort])
    return [...sorted.filter((r) => r.pin), ...sorted.filter((r) => !r.pin)]
  }, [rows, reason, area, band, pinF, stF, q, sort]) // eslint-disable-line react-hooks/exhaustive-deps

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
  const pinFc = facet('pin', (r) => (r.pin ? 'pin' : 'lock'))
  const stFc = facet('st', (r) => r.fs)
  const nPin = list.filter((r) => r.pin).length, nLock = list.length - nPin
  const areas = [...areaF].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]))
  const nArea = [...areaF.values()].reduce((n, o) => n + o.n, 0)

  const filterCount = (reason !== 'all') + (area !== 'all') + (band !== 'all') + (pinF !== 'all') + (stF !== 'all') + (q.trim() ? 1 : 0)
  const reset = () => { setReason('all'); setArea('all'); setBand('all'); setPinF('all'); setStF('all'); setQ(''); setShown(PAGE) }
  const f = (fn) => (v) => { fn(v); setShown(PAGE) }
  const changeTab = (t) => { setTab(t); setSel(new Set()); setShown(PAGE) }

  // selection
  const rowIds = useMemo(() => new Set(rows.map((r) => r.l.id)), [rows])
  const picked = rows.filter((r) => sel.has(r.l.id))
  const hidden = picked.filter((r) => !list.includes(r)).length
  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allShownOn = list.length > 0 && list.every((r) => sel.has(r.l.id))
  const selectAll = () => setSel((s) => { const n = new Set(s); list.forEach((r) => (allShownOn ? n.delete(r.l.id) : n.add(r.l.id))); return n })
  useEffect(() => { setSel((s) => { const n = new Set([...s].filter((id) => rowIds.has(id))); return n.size === s.size ? s : n }) }, [rowIds])

  const startRows = picked.length ? picked : list
  const startKg = startRows.reduce((n, r) => n + r.kg, 0)
  const label = picked.length ? `${picked.length} selected` : [area === 'all' ? '' : area, reason === 'all' ? '' : REASON[reason].label].filter(Boolean).join(' · ') || 'All hotels'

  const near = async () => {
    const p = await locate()
    setSort('near')
    toast(p ? 'Sorted by distance from you 📍' : 'Allow location access to sort by distance', p ? 'ok' : 'warn')
  }

  return (
    <div className="page fp">
      <div className="page-h">
        <h1>Plan <small>{list.length}</small></h1>
        <div className="fp-h-r">
          <button className="btn-soft sm" disabled={state === 'loading'} onClick={near}>{state === 'loading' ? 'Finding…' : me ? '📍 Refresh' : '📍 Nearest'}</button>
          <button className="btn-soft sm" onClick={() => openForm()}><Icon name="plus" size={15} /> Hotel</button>
        </div>
      </div>

      <div className="fp-tabs" role="tablist">
        {TABS.map(([id, t]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => changeTab(id)}>
            {t}<b>{lists[id].length}</b>
          </button>
        ))}
      </div>

      <div className="fp-map" aria-label="Map status">
        <button type="button" className={`ok ${pinF === 'pin' ? 'on' : ''}`} onClick={() => f(setPinF)(pinF === 'pin' ? 'all' : 'pin')}>
          <i>📍</i><b>{pinFc.get('pin')?.n || 0}</b><span>Map ready<small>navigate exactly</small></span>
        </button>
        <button type="button" className={`lock ${pinF === 'lock' ? 'on' : ''}`} onClick={() => f(setPinF)(pinF === 'lock' ? 'all' : 'lock')}>
          <i>🧭</i><b>{pinFc.get('lock')?.n || 0}</b><span>Needs location<small>tap to add it yourself</small></span>
        </button>
      </div>

      <div className="search">
        <Icon name="search" size={18} />
        <input value={q} onChange={(e) => f(setQ)(e.target.value)} placeholder="Search hotel, phone, area, reason…" />
        {q && <button onClick={() => f(setQ)('')} aria-label="Clear search"><Icon name="x" size={16} /></button>}
      </div>

      <div className="chips scroll">
        <button className={`chip ${area === 'all' ? 'on' : ''}`} onClick={() => f(setArea)('all')}>🗺 All areas <b>{nArea}</b></button>
        {areas.map(([a, o]) => <button key={a} className={`chip ${area === a ? 'on' : ''}`} onClick={() => f(setArea)(area === a ? 'all' : a)}>{a} <b>{o.n}</b></button>)}
      </div>

      <div className="chips scroll fp-st">
        <button className={`chip ${stF === 'all' ? 'on' : ''}`} onClick={() => f(setStF)('all')}>All status</button>
        {FIELD_STATUS.map((o) => (
          <button key={o.id} className={`chip st-${o.id} ${stF === o.id ? 'on' : ''}`} onClick={() => f(setStF)(stF === o.id ? 'all' : o.id)}>{o.icon} {o.label} <b>{stFc.get(o.id)?.n || 0}</b></button>
        ))}
      </div>

      <button type="button" className={`fp-more ${more ? 'open' : ''}`} onClick={() => setMore((m) => !m)}>
        <span>🎚 Filter by reason, KG, sort</span>
        {filterCount > 0 && <em>{filterCount} active</em>}
        <i>{more ? '▴' : '▾'}</i>
      </button>
      {more && (
        <motion.section className="card fp-panel" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
          <h4>Why did they stop?</h4>
          <div className="chips">
            <button className={`chip ${reason === 'all' ? 'on' : ''}`} onClick={() => f(setReason)('all')}>All</button>
            {REASONS.filter((r) => reasonF.has(r.id)).sort((a, b) => reasonF.get(b.id).n - reasonF.get(a.id).n).map((r) => (
              <button key={r.id} className={`chip ${reason === r.id ? 'on' : ''}`} onClick={() => f(setReason)(reason === r.id ? 'all' : r.id)}>{r.icon} {r.label} <b>{reasonF.get(r.id).n}</b></button>
            ))}
          </div>
          {reason !== 'all' && <div className="fp-tip" style={{ '--tc': REASON[reason].color, '--tb': REASON[reason].bg }}><b>{REASON[reason].icon} How to win them back</b><p>{REASON[reason].tip}</p></div>}
          <h4>KG per order</h4>
          <div className="chips">
            <button className={`chip ${band === 'all' ? 'on' : ''}`} onClick={() => f(setBand)('all')}>Any KG</button>
            {KG_BANDS.filter((b) => bandF.has(b.id)).map((b) => <button key={b.id} className={`chip ${band === b.id ? 'on' : ''}`} onClick={() => f(setBand)(band === b.id ? 'all' : b.id)}>{b.label} <b>{bandF.get(b.id).n}</b></button>)}
          </div>
          <h4>Sort</h4>
          <div className="chips">
            {[['near', '📍 Nearest'], ['kg', '⚖️ Biggest KG'], ['follow', '⏰ Follow-up date'], ['area', '🗺 Area A–Z']].map(([id, t]) => (
              <button key={id} className={`chip ${sort === id ? 'on' : ''}`} onClick={() => { setSort(id); if (id === 'near' && !me) near() }}>{t}</button>
            ))}
          </div>
        </motion.section>
      )}

      <div className="fp-sel">
        <button type="button" className="fp-all" onClick={selectAll} disabled={!list.length || tab === 'done'}>
          <span className={`hr-chk sm ${allShownOn ? 'on' : ''}`}><Icon name="check" size={14} /></span>
          {allShownOn ? 'Unselect all' : `Select all ${list.length}`}
        </button>
        {filterCount > 0 && <button className="btn-soft sm" onClick={reset}>Clear filters</button>}
      </div>

      {list.slice(0, shown).map((r, i, arr) => (
        <Fragment key={r.l.id}>
          {(i === 0 || arr[i - 1].pin !== r.pin) && (
            <div className={`fp-sec ${r.pin ? 'ok' : 'lock'}`}>
              <i>{r.pin ? '📍' : '🧭'}</i>
              <div><b>{r.pin ? 'Map ready' : 'Needs an exact location'} <em>{r.pin ? nPin : nLock}</em></b>
                <small>{r.pin ? 'Exact location saved. Tap Map to navigate.' : 'Tap Add location on a card: use GPS at the hotel, find it online or paste a Google Maps link.'}</small></div>
            </div>
          )}
          <HotelRow lead={r.l} d={r.d} selected={sel.has(r.l.id)} onToggle={tab === 'done' ? undefined : () => toggle(r.l.id)} onRemark={quick.open} onVisit={tab === 'done' ? undefined : (l) => setRun({ stops: [l], label: l.name })} />
        </Fragment>
      ))}
      {list.length > shown && <button className="btn-soft wide" onClick={() => setShown((n) => n + PAGE)}>Show {Math.min(PAGE, list.length - shown)} more</button>}
      {!list.length && (
        <div className="card empty">
          <div className="empty-ico">{tab === 'done' ? '🌱' : filterCount ? '🔎' : '🎉'}</div>
          <h3>{tab === 'done' ? 'No visits yet today' : filterCount ? 'No hotels match' : tab === 'due' ? 'No follow-ups due' : 'Nothing left to visit'}</h3>
          <p>{filterCount ? 'Clear a filter to see more.' : tab === 'done' ? 'Select hotels in To visit, then press Start visit.' : 'HR will assign more, or tap + Hotel to add one you find on the road.'}</p>
          {filterCount > 0 && <button className="btn-soft" onClick={reset}>Clear filters</button>}
        </div>
      )}

      {tab !== 'done' && list.length > 0 && (
        <div className="fp-bar">
          <div className="fp-bar-t">
            <b>{picked.length ? `${picked.length} selected` : `${list.length} shown`}</b>
            <small>{startKg ? `${startKg} kg to win back` : 'Nearest hotel comes first'}{hidden ? ` · ${hidden} hidden by filters` : ''}</small>
          </div>
          {picked.length > 0 && <button className="fp-clear" onClick={() => setSel(new Set())}>Clear</button>}
          <motion.button whileTap={{ scale: 0.96, y: 2 }} className="fp-go" onClick={() => setRun({ stops: startRows.map((r) => r.l), label })}>
            <Icon name="play" size={18} /> Start visit
          </motion.button>
        </div>
      )}

      {quick.node}
      {run && <VisitMode stops={run.stops} areaLabel={run.label} onClose={() => setRun(null)} />}
    </div>
  )
}
