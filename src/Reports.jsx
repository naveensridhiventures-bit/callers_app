import { useMemo, useState } from 'react'
import { addDays, inr, packetValue, prettyDate, todayStr, toCSV } from './ledger'

const RANGES = [['7', 'Last 7 days'], ['30', 'Last 30 days'], ['month', 'This month'], ['all', 'All']]

function download(name, text, type = 'text/csv') {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

export default function Reports({ app, ledger, goDay }) {
  const { settings } = app.state
  const pv = packetValue(settings)
  const [range, setRange] = useState('7')
  const today = todayStr()

  const rows = useMemo(() => {
    let from = '0000'
    if (range === '7') from = addDays(today, -6)
    else if (range === '30') from = addDays(today, -29)
    else if (range === 'month') from = today.slice(0, 8) + '01'
    return ledger.rows.filter((r) => r.date >= from && r.date <= today)
  }, [ledger, range, today])

  const sum = (k) => rows.reduce((a, r) => a + r[k], 0)
  const totals = { purchase: sum('purchase'), sold: sum('sold'), damage: sum('damage'), sampling: sum('sampling'), mixing: sum('mixing'), sentOut: sum('sentOut'), ret: sum('ret') }
  const lastClosing = rows.length ? rows[rows.length - 1].closing : 0

  // chart
  const W = 340, H = 150, pad = 18
  const max = Math.max(1, ...rows.map((r) => Math.max(r.sold, r.purchase, r.damage)))
  const bw = Math.min(26, (W - pad * 2) / Math.max(rows.length, 1) / 3.2)
  const step = (W - pad * 2) / Math.max(rows.length, 1)
  const y = (v) => H - 22 - (v / max) * (H - 40)
  const labelEvery = Math.ceil(rows.length / 7)

  const shareRange = () => {
    const text = `🥣 *${settings.business}* – ${RANGES.find((r) => r[0] === range)[1]}\n\nPurchased: ${totals.purchase}\nSold: ${totals.sold} pkt = ${inr(totals.sold * pv)}\nDamage: ${totals.damage} pkt (${inr(totals.damage * pv)})\nSampling: ${totals.sampling}   Mixing: ${totals.mixing}\n✅ Closing stock: ${lastClosing}`
    if (navigator.share) navigator.share({ text }).catch(() => {})
    else window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank')
  }

  return (
    <div className="screen">
      <h1 className="title">📊 Date-wise Report</h1>
      <div className="chips scroll">
        {RANGES.map(([k, l]) => <button key={k} className={`chip ${range === k ? 'on' : ''}`} onClick={() => setRange(k)}>{l}</button>)}
      </div>

      <div className="kpis four">
        <div className="kpi"><span>Purchased</span><b style={{ color: '#16a34a' }}>{totals.purchase}</b></div>
        <div className="kpi"><span>Sold</span><b style={{ color: '#2563eb' }}>{totals.sold}</b><em>{inr(totals.sold * pv)}</em></div>
        <div className="kpi"><span>Damage</span><b style={{ color: '#dc2626' }}>{totals.damage}</b><em>{inr(totals.damage * pv)}</em></div>
        <div className="kpi"><span>Closing</span><b>{lastClosing}</b><em>now</em></div>
      </div>

      <section className="card">
        <div className="chart-h"><b className="small">Purchase vs Sold vs Damage</b>
          <span className="legend"><span><i style={{ background: '#16a34a' }} />Buy</span><span><i style={{ background: '#2563eb' }} />Sold</span><span><i style={{ background: '#dc2626' }} />Dmg</span></span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Chart of purchase, sold and damage">
          <line x1={pad} x2={W - pad} y1={H - 22} y2={H - 22} stroke="#e2e8f0" />
          {rows.map((r, i) => {
            const cx = pad + step * i + step / 2
            return (
              <g key={r.date} onClick={() => goDay(r.date)} style={{ cursor: 'pointer' }}>
                {[['purchase', '#16a34a', -1], ['sold', '#2563eb', 0], ['damage', '#dc2626', 1]].map(([k, c, o]) => (
                  <rect key={k} x={cx + o * bw - bw / 2} y={y(r[k])} width={bw} height={Math.max(0, H - 22 - y(r[k]))} rx="2" fill={c} />
                ))}
                {i % labelEvery === 0 && <text x={cx} y={H - 7} textAnchor="middle" fontSize="9" fill="#64748b">{prettyDate(r.date, { day: 'numeric', month: 'short' })}</text>}
              </g>
            )
          })}
        </svg>
      </section>

      <div className="btn-row">
        <button className="btn" onClick={() => download(`batter-stock-${today}.csv`, toCSV(rows, settings))}>⬇ Excel / CSV</button>
        <button className="btn" onClick={shareRange}>📤 Share</button>
      </div>

      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr><th>Date</th><th>Open</th><th>Buy</th><th>Load</th><th>Extra</th><th>Back</th><th>Sold</th><th>₹ Sales</th><th>Dmg</th><th>Samp</th><th>Mix</th><th>Close</th></tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((r) => (
              <tr key={r.date} onClick={() => goDay(r.date)}>
                <td>{prettyDate(r.date, { day: 'numeric', month: 'short' })}<small>{prettyDate(r.date, { weekday: 'short' })}</small></td>
                <td>{r.opening}</td><td className="g">{r.purchase || '–'}</td><td>{r.load || '–'}</td><td>{r.extra || '–'}</td><td>{r.ret || '–'}</td>
                <td className="b">{r.sold}</td><td>{r.sold * pv ? inr(r.sold * pv) : '–'}</td>
                <td className="r">{r.damage || '–'}</td><td>{r.sampling || '–'}</td><td>{r.mixing || '–'}</td>
                <td className="cl">{r.closing}{r.counted && r.variance !== 0 && <small className={r.variance < 0 ? 'neg' : 'pos'}>{r.variance > 0 ? '+' : ''}{r.variance}</small>}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td>Total</td><td></td><td>{totals.purchase}</td><td></td><td></td><td>{totals.ret}</td><td>{totals.sold}</td><td>{inr(totals.sold * pv)}</td><td>{totals.damage}</td><td>{totals.sampling}</td><td>{totals.mixing}</td><td></td></tr>
          </tfoot>
        </table>
      </div>
      <p className="muted small center">Tap a row or bar to open that day. Red/green small number under Close = count difference.</p>
    </div>
  )
}
