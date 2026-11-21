import { useState } from 'react'

export default function Setup({ app }) {
  const [f, setF] = useState({ business: 'Idli Dosa Batter', name: '', pin: '', packKg: '5', ratePerKg: '40', openingStock: '', vehicles: 'Vehicle 1, Vehicle 2' })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const go = () => {
    if (!f.name.trim()) return setErr('Please enter your name')
    const vehicles = f.vehicles.split(',').map((v) => v.trim()).filter(Boolean)
    app.actions.setup({
      business: f.business.trim() || 'Batter Stock',
      name: f.name.trim(),
      pin: f.pin,
      packKg: Number(f.packKg) || 5,
      ratePerKg: Number(f.ratePerKg) || 40,
      openingStock: Number(f.openingStock) || 0,
      vehicles: vehicles.length ? vehicles : ['Vehicle 1']
    })
  }

  return (
    <div className="setup">
      <div className="setup-hero">
        <div className="logo">🥣</div>
        <h1>Batter Stock</h1>
        <p>Purchase → Vehicle → Cold room → Damage → Closing.<br />Every packet counted, every day.</p>
      </div>
      <div className="card setup-card">
        <label className="lbl">Business name</label>
        <input className="input" value={f.business} onChange={set('business')} />
        <label className="lbl">Your name (Admin)</label>
        <input className="input" placeholder="e.g. Ravi" value={f.name} onChange={set('name')} />
        <label className="lbl">PIN to protect admin <span className="muted">(optional, 4 digits)</span></label>
        <input className="input" inputMode="numeric" maxLength={4} placeholder="••••" value={f.pin} onChange={(e) => setF({ ...f, pin: e.target.value.replace(/\D/g, '') })} />
        <div className="two">
          <div><label className="lbl">Packet size (kg)</label><input className="input" inputMode="decimal" value={f.packKg} onChange={set('packKg')} /></div>
          <div><label className="lbl">Rate per kg (₹)</label><input className="input" inputMode="decimal" value={f.ratePerKg} onChange={set('ratePerKg')} /></div>
        </div>
        <label className="lbl">Packets in cold room right now</label>
        <input className="input" inputMode="numeric" placeholder="0" value={f.openingStock} onChange={(e) => setF({ ...f, openingStock: e.target.value.replace(/\D/g, '') })} />
        <label className="lbl">Vehicles <span className="muted">(separate with comma)</span></label>
        <input className="input" value={f.vehicles} onChange={set('vehicles')} />
        {err && <div className="variance bad">{err}</div>}
        <button className="btn primary big" style={{ marginTop: 16 }} onClick={go}>Start 🚀</button>
      </div>
    </div>
  )
}
