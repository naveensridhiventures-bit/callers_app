import { useRef, useState } from 'react'
import { Avatar, Sheet } from './ui'
import { COLORS } from './store'
import { inr, packetValue } from './ledger'

export default function Settings({ app, toast, installEvt, onInstall }) {
  const { state, actions } = app
  const { settings, users } = state
  const me = users.find((u) => u.id === state.currentUserId)
  const isAdmin = me?.role === 'admin'
  const [newVeh, setNewVeh] = useState('')
  const [nu, setNu] = useState({ name: '', pin: '', role: 'staff' })
  const [pinFor, setPinFor] = useState(null)
  const [pin, setPin] = useState('')
  const fileRef = useRef()

  const switchTo = (u) => {
    if (u.id === me?.id) return
    if (u.pin) { setPinFor(u); setPin('') } else { actions.switchUser(u.id); toast('Now using: ' + u.name) }
  }
  const checkPin = () => {
    if (pin === pinFor.pin) { actions.switchUser(pinFor.id); toast('Now using: ' + pinFor.name); setPinFor(null) } else toast('Wrong PIN')
  }

  const backup = async () => {
    const txt = await actions.exportAll()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' }))
    a.download = `batter-stock-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    toast('Backup downloaded')
  }
  const restore = async (f) => {
    try { await actions.importAll(await f.text()); toast('Backup restored ✅') } catch (e) { toast(e.message) }
  }

  return (
    <div className="screen">
      <h1 className="title">⚙️ Settings & Team</h1>

      {installEvt && (
        <button className="install" onClick={onInstall}>📲 Install this app on your phone</button>
      )}

      <section className="card">
        <h3 className="h3">👥 Team – who is using the app</h3>
        <p className="muted small">Every entry and photo is stamped with the name of the person who made it.</p>
        {users.map((u) => (
          <div className={`urow ${u.id === me?.id ? 'me' : ''}`} key={u.id} onClick={() => switchTo(u)}>
            <Avatar user={u} size={36} />
            <div className="umid"><b>{u.name}</b><span className="muted small">{u.role === 'admin' ? 'Admin (full access)' : 'Staff'}{u.pin ? ' · 🔒 PIN' : ''}</span></div>
            {u.id === me?.id ? <span className="pill">Using now</span> : <span className="muted small">Tap to switch</span>}
            {isAdmin && u.id !== me?.id && (
              <button className="del" onClick={(e) => { e.stopPropagation(); if (confirm(`Remove ${u.name}? Old entries stay.`)) actions.removeUser(u.id) }}>🗑</button>
            )}
          </div>
        ))}
        {isAdmin && (
          <div className="adduser">
            <input className="input" placeholder="New person name" value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} />
            <input className="input pin" placeholder="PIN" inputMode="numeric" maxLength={4} value={nu.pin} onChange={(e) => setNu({ ...nu, pin: e.target.value.replace(/\D/g, '') })} />
            <select className="input pin" value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value })}>
              <option value="staff">Staff</option><option value="admin">Admin</option>
            </select>
            <button className="btn primary" onClick={() => { if (!nu.name.trim()) return toast('Enter name'); actions.addUser({ name: nu.name.trim(), pin: nu.pin, role: nu.role }); setNu({ name: '', pin: '', role: 'staff' }); toast('Person added') }}>Add</button>
          </div>
        )}
      </section>

      <section className="card">
        <h3 className="h3">🥣 Product & rate</h3>
        <fieldset disabled={!isAdmin} className="fs">
          <label className="lbl">Business name</label>
          <input className="input" value={settings.business} onChange={(e) => actions.updateSettings({ business: e.target.value })} />
          <div className="two">
            <div><label className="lbl">Packet size (kg)</label>
              <input className="input" inputMode="decimal" value={settings.packKg} onChange={(e) => actions.updateSettings({ packKg: e.target.value.replace(/[^0-9.]/g, '') })} /></div>
            <div><label className="lbl">Rate per kg (₹)</label>
              <input className="input" inputMode="decimal" value={settings.ratePerKg} onChange={(e) => actions.updateSettings({ ratePerKg: e.target.value.replace(/[^0-9.]/g, '') })} /></div>
          </div>
          <div className="calc">1 packet = {settings.packKg} kg × ₹{settings.ratePerKg} = <b>{inr(packetValue(settings))}</b></div>
          <label className="lbl">Starting stock (packets in cold room on day 1)</label>
          <input className="input" inputMode="numeric" value={settings.openingStock} onChange={(e) => actions.updateSettings({ openingStock: Number(e.target.value.replace(/\D/g, '')) || 0 })} />
        </fieldset>
        <label className="toggle">
          <input type="checkbox" disabled={!isAdmin} checked={!!settings.blindCount} onChange={(e) => actions.updateSettings({ blindCount: e.target.checked })} />
          <span><b>🙈 Blind closing count</b><small>Staff cannot see the book stock until they count the cold room and close the day. Stops “adjusting” the count to match.</small></span>
        </label>
        {!isAdmin && <p className="muted small">Only Admin can change these.</p>}
      </section>

      <section className="card">
        <h3 className="h3">🚚 Vehicles</h3>
        <div className="chips">
          {settings.vehicles.map((v) => (
            <span className="chip on tag" key={v}>{v}{isAdmin && <button onClick={() => actions.updateSettings({ vehicles: settings.vehicles.filter((x) => x !== v) })}>✕</button>}</span>
          ))}
        </div>
        {isAdmin && (
          <div className="count-row" style={{ marginTop: 10 }}>
            <input className="input" placeholder="Vehicle name / number (e.g. TN 09 AB 1234)" value={newVeh} onChange={(e) => setNewVeh(e.target.value)} />
            <button className="btn primary" onClick={() => { const v = newVeh.trim(); if (v && !settings.vehicles.includes(v)) actions.updateSettings({ vehicles: [...settings.vehicles, v] }); setNewVeh('') }}>Add</button>
          </div>
        )}
      </section>

      <section className="card">
        <h3 className="h3">💾 Data & backup</h3>
        <p className="muted small">Data is saved on this phone. Download a backup (with all damage photos) regularly or to move to another phone.</p>
        <div className="btn-row">
          <button className="btn" onClick={backup}>⬇ Backup</button>
          <button className="btn" onClick={() => fileRef.current.click()} disabled={!isAdmin}>⬆ Restore</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => { if (e.target.files[0]) restore(e.target.files[0]); e.target.value = '' }} />
        </div>
        {isAdmin && (
          <button className="btn danger" style={{ marginTop: 10, width: '100%' }} onClick={() => { if (confirm('Delete ALL data and photos from this phone? This cannot be undone.') && confirm('Really delete everything?')) actions.reset() }}>
            Delete all data
          </button>
        )}
      </section>

      <Sheet open={!!pinFor} onClose={() => setPinFor(null)} title={`🔒 ${pinFor?.name}`}
        footer={<button className="btn primary big" onClick={checkPin}>Unlock</button>}>
        <label className="lbl">Enter PIN</label>
        <input className="input" autoFocus inputMode="numeric" type="password" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
      </Sheet>
    </div>
  )
}
