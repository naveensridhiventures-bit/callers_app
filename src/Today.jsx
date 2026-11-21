import { useEffect, useState } from 'react'
import { TYPES, addDays, dayText, inr, packetValue, prettyDate, todayStr } from './ledger'
import { Avatar, PhotoImg, Sheet } from './ui'

const SEG = [
  ['sold', 'Sold', '#2563eb'],
  ['closing', 'Cold room', '#16a34a'],
  ['damage', 'Damage', '#dc2626'],
  ['sampling', 'Sampling', '#d97706'],
  ['mixing', 'Mixing', '#9333ea']
]

export default function Today({ app, date, setDate, row, openEntry, openPhoto, toast, alertCount, goCheck }) {
  const { state, actions } = app
  const { settings, users } = state
  const me = users.find((u) => u.id === state.currentUserId)
  const isAdmin = me?.role === 'admin'
  const pv = packetValue(settings)
  const kg = Number(settings.packKg) || 5
  const isToday = date === todayStr()
  const [count, setCount] = useState('')
  const [reasonFor, setReasonFor] = useState(null) // {kind:'delete'|'reopen', id}
  const [reason, setReason] = useState('')
  const [cashIn, setCashIn] = useState({})
  useEffect(() => { setCount(row.counted ? String(row.closing) : ''); setCashIn({}) }, [date, row.counted, row.closing])
  const locked = row.locked
  const closer = users.find((u) => u.id === row.closedBy)
  const hideSys = !!settings.blindCount && !isAdmin && !locked
  const REASONS = reasonFor?.kind === 'reopen' ? ['Wrong count', 'Entry forgotten', 'Count after return', 'Other'] : ['Wrong quantity', 'Wrong vehicle', 'Entered twice', 'Test entry', 'Other']
  const confirmReason = () => {
    if (!reason) return toast('Choose a reason')
    if (reasonFor.kind === 'delete') actions.deleteEntry(reasonFor.id, reason)
    else actions.reopenDay(date, reason)
    toast(reasonFor.kind === 'delete' ? 'Entry deleted & logged' : 'Day re-opened & logged')
    setReasonFor(null); setReason('')
  }

  const avail = row.opening + row.purchase
  const vals = { sold: Math.max(0, row.sold), closing: Math.max(0, row.closing), damage: row.damage, sampling: row.sampling, mixing: row.mixing }
  const total = Object.values(vals).reduce((a, b) => a + b, 0) || 1

  const vehNames = [...new Set([...settings.vehicles, ...Object.keys(row.vehicles)])]

  const share = () => {
    const text = dayText(row, settings)
    if (navigator.share) navigator.share({ text }).catch(() => {})
    else window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank')
  }

  const journey = [
    { l: 'Opening stock (yesterday closing)', v: row.opening, s: '', c: '#64748b' },
    { l: 'Purchase', v: row.purchase, s: '+', c: TYPES.purchase.color, i: '🛒' },
    { l: 'Loaded in vehicle', v: row.load, s: '−', c: TYPES.load.color, i: '🚚' },
    { l: 'Extra loaded', v: row.extra, s: '−', c: TYPES.extra.color, i: '📦' },
    { l: 'Returned from vehicle', v: row.ret, s: '+', c: TYPES.ret.color, i: '↩️' },
    { l: 'Damage (cold room)', v: row.dmgCold, s: '−', c: TYPES.damage.color, i: '⚠️' },
    { l: 'Sampling', v: row.sampling, s: '−', c: TYPES.sampling.color, i: '🧪' },
    { l: 'Mixing', v: row.mixing, s: '−', c: TYPES.mixing.color, i: '🥄' }
  ]

  return (
    <div className="screen">
      <div className="datebar">
        <button className="icon-btn" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">‹</button>
        <label className="date-pick">
          <span className="date-main">{isToday ? 'Today' : prettyDate(date, { weekday: 'long' })}</span>
          <span className="date-sub">{prettyDate(date, { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          <input type="date" value={date} max={todayStr()} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <button className="icon-btn" onClick={() => setDate(addDays(date, 1))} disabled={isToday} aria-label="Next day">›</button>
      </div>

      {alertCount > 0 && (
        <button className="alert-banner" onClick={goCheck}>
          <span>🔎</span><div><b>{alertCount} thing{alertCount > 1 ? 's' : ''} to check</b><small>Mismatches, missing photos, cash or unclosed days</small></div><i>›</i>
        </button>
      )}
      {locked && (
        <div className="lockbar">
          <span>🔒 Day closed by <b>{closer?.name || '—'}</b> at {new Date(row.closedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}. No more changes.</span>
          {isAdmin && <button onClick={() => { setReasonFor({ kind: 'reopen' }); setReason('') }}>Re-open</button>}
        </div>
      )}

      {/* HERO */}
      <section className="hero">
        <div className="hero-top">
          <span>❄️ Closing stock · cold room</span>
          <button className="hero-share" onClick={share}>Share 📤</button>
        </div>
        {hideSys ? (
          <>
            <div className="hero-num">?<small> count to reveal</small></div>
            <div className="hero-sub">🙈 Blind count is ON – count the packets in the cold room below, then close the day.</div>
          </>
        ) : (
          <>
            <div className="hero-num">{row.closing}<small> packets</small></div>
            <div className="hero-sub">{row.closing * kg} kg · worth {inr(row.closing * pv)} · becomes <b>{prettyDate(addDays(date, 1), { weekday: 'short', day: 'numeric', month: 'short' })}</b> opening</div>
          </>
        )}
        <div className="stackbar" role="img" aria-label="Where the stock went">
          {SEG.map(([k, , c]) => vals[k] > 0 && <div key={k} style={{ width: `${(vals[k] / total) * 100}%`, background: c }} />)}
        </div>
        <div className="legend">
          {SEG.map(([k, l, c]) => (
            <span key={k}><i style={{ background: c }} />{l} <b>{hideSys && k === 'closing' ? '?' : vals[k]}</b></span>
          ))}
        </div>
      </section>

      {/* KPIs */}
      <div className="kpis">
        <div className="kpi"><span>Available</span><b>{avail}</b><em>opening + purchase</em></div>
        <div className="kpi"><span>Sold</span><b style={{ color: '#2563eb' }}>{row.sold}</b><em>{inr(row.sold * pv)}</em></div>
        <div className="kpi"><span>Damage</span><b style={{ color: '#dc2626' }}>{row.damage}</b><em>loss {inr(row.damage * pv)}</em></div>
      </div>

      {/* ACTIONS */}
      <h2 className="h2">Add entry</h2>
      <div className="actions">
        {Object.entries(TYPES).map(([k, t]) => (
          <button key={k} className={`act ${locked ? 'off' : ''}`} onClick={() => openEntry(k)} style={{ '--c': t.color }}>
            <span className="act-ic">{t.icon}</span>
            <span className="act-l">{t.label}</span>
            <span className="act-n">{k === 'damage' ? row.damage : k === 'load' ? row.load : k === 'extra' ? row.extra : k === 'ret' ? row.ret : k === 'purchase' ? row.purchase : k === 'sampling' ? row.sampling : row.mixing}</span>
          </button>
        ))}
      </div>

      {/* VEHICLES */}
      <h2 className="h2">Vehicles</h2>
      <div className="vehs">
        {vehNames.map((v) => {
          const x = row.vehicles[v] || { load: 0, extra: 0, ret: 0, dmg: 0 }
          const sold = x.load + x.extra - x.ret - x.dmg
          return (
            <div className="veh" key={v}>
              <div className="veh-h"><b>🚚 {v}</b><span className="pill">{inr(sold * pv)}</span></div>
              <div className="veh-grid">
                <div><em>Loaded</em><b>{x.load}</b></div>
                <div><em>Extra</em><b>{x.extra}</b></div>
                <div><em>Returned</em><b>{x.ret}</b></div>
                <div><em>Sold</em><b className="blue">{sold}</b></div>
              </div>
              {sold > 0 || x.cash != null ? (
                <div className="cash">
                  <span>💵 Cash expected <b>{inr(sold * pv)}</b></span>
                  {x.cash != null ? (
                    <span className={x.cash === sold * pv ? 'cash-ok' : 'cash-bad'}>
                      {x.cash === sold * pv ? `✅ ${inr(x.cash)} collected` : `${x.cash < sold * pv ? '⚠ Short' : 'ℹ Extra'} ${inr(Math.abs(x.cash - sold * pv))}`}
                      {!locked && <button onClick={() => actions.setCash(date, v, '')}>edit</button>}
                    </span>
                  ) : !locked ? (
                    <span className="cash-in">
                      <input inputMode="numeric" placeholder="₹ collected" value={cashIn[v] ?? ''} onChange={(e) => setCashIn({ ...cashIn, [v]: e.target.value.replace(/\D/g, '') })} />
                      <button onClick={() => { if (cashIn[v] === undefined || cashIn[v] === '') return toast('Enter cash amount'); actions.setCash(date, v, cashIn[v]); toast('Cash saved') }}>Save</button>
                    </span>
                  ) : <span className="cash-bad">not entered</span>}
                </div>
              ) : null}
              {!locked && (
                <div className="veh-btns">
                  <button onClick={() => openEntry('load', { vehicle: v })}>+ Load</button>
                  <button onClick={() => openEntry('extra', { vehicle: v })}>+ Extra</button>
                  <button onClick={() => openEntry('ret', { vehicle: v })}>↩ Return</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* JOURNEY */}
      <h2 className="h2">Stock journey</h2>
      <section className="card journey">
        {journey.map((j) => (
          <div className="jrow" key={j.l}>
            <span className="jl">{j.i && <i>{j.i}</i>}{j.l}</span>
            <b style={{ color: j.c }}>{j.s}{j.v}</b>
          </div>
        ))}
        <div className="jrow total"><span className="jl">= Closing (system)</span><b>{hideSys ? '?' : row.systemClosing}</b></div>
      </section>

      {/* COUNT */}
      <h2 className="h2">Close the day</h2>
      <section className="card">
        {!locked ? (
          <>
            <p className="muted small" style={{ margin: '0 0 10px' }}>Count the packets physically in the cold room and enter it. Closing <b>locks the day</b> – the count becomes tomorrow’s opening stock and any shortage is flagged.</p>
            <div className="count-row">
              <input className="input" inputMode="numeric" placeholder={hideSys ? 'Packets counted' : `System: ${row.systemClosing}`} value={count} onChange={(e) => setCount(e.target.value.replace(/[^0-9]/g, ''))} />
              <button className="btn primary" onClick={() => {
                if (count === '') return toast('Enter the counted packets')
                if (confirm(`Close ${prettyDate(date)} with ${count} packets in cold room?\nThe day will be locked.`)) { actions.setCount(date, count); toast('🔒 Day closed') }
              }}>Close day</button>
            </div>
          </>
        ) : (
          <p className="muted small" style={{ margin: 0 }}>Counted <b>{row.closing}</b> packets in cold room.</p>
        )}
        {row.counted && (
          <div className={`variance ${row.variance === 0 ? 'ok' : row.variance < 0 ? 'bad' : 'extra'}`}>
            {row.variance === 0 ? '✅ Perfect match – cold room matches the book' : row.variance < 0 ? `⚠ Shortage of ${-row.variance} packets (${inr(-row.variance * pv)}) – not explained by entries` : `ℹ ${row.variance} extra packets found in cold room`}
          </div>
        )}
      </section>

      {/* LOG */}
      <h2 className="h2">Today’s entries <span className="muted">({row.entries.length})</span></h2>
      {row.entries.length === 0 && <div className="empty">No entries yet. Tap a button above to start. 👆</div>}
      <div className="log">
        {[...row.entries].sort((a, b) => b.ts - a.ts).map((e) => {
          const t = TYPES[e.type]
          const u = users.find((x) => x.id === e.userId)
          return (
            <div className="entry" key={e.id}>
              <span className="entry-ic" style={{ background: t.color + '1f', color: t.color }}>{t.icon}</span>
              <div className="entry-mid">
                <b>{t.label}{e.vehicle ? ` · ${e.vehicle}` : ''}</b>
                <span className="muted small">
                  {e.type === 'damage' && `${e.reason}${e.loc === 'vehicle' ? ' (vehicle)' : ' (cold room)'} · `}
                  {e.type === 'purchase' && e.billQty != null && e.billQty !== '' && `bill ${e.billQty}${Number(e.billQty) !== e.qty ? ' ⚠' : ' ✓'} · `}
                  {e.note && `${e.note} · `}
                  {new Date(e.ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
                {e.photoIds?.length > 0 && (
                  <div className="mini-photos">
                    {e.photoIds.map((p) => <PhotoImg key={p} id={p} className="mini" onClick={() => openPhoto(p, `${t.label} · ${e.qty} pkt · ${e.reason || ''}`)} />)}
                  </div>
                )}
              </div>
              <div className="entry-r">
                <b style={{ color: t.color }}>{t.sign > 0 ? '+' : '−'}{e.qty}</b>
                <span className="by"><Avatar user={u} size={18} />{u?.name?.split(' ')[0] || '—'}</span>
                {!locked && (isAdmin || e.userId === me?.id) && (
                  <button className="del" onClick={() => { setReasonFor({ kind: 'delete', id: e.id }); setReason('') }}>🗑</button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <Sheet open={!!reasonFor} onClose={() => setReasonFor(null)} title={reasonFor?.kind === 'reopen' ? '🔓 Re-open day' : '🗑 Delete entry'}
        footer={<button className="btn primary big" onClick={confirmReason}>{reasonFor?.kind === 'reopen' ? 'Re-open day' : 'Delete entry'}</button>}>
        <p className="muted small">This is saved in the audit log with your name, so nothing disappears silently.</p>
        <label className="lbl">Reason</label>
        <div className="chips">{REASONS.map((r) => <button key={r} className={`chip ${reason === r ? 'on' : ''}`} onClick={() => setReason(r)}>{r}</button>)}</div>
      </Sheet>
    </div>
  )
}
