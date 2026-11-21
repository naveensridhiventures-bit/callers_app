import { useEffect, useRef, useState } from 'react'
import { DAMAGE_REASONS, TYPES, inr, packetValue, prettyDate } from './ledger'
import { compressPhoto, putPhoto } from './db'
import { Sheet, Stepper, PhotoImg } from './ui'
import { uid } from './store'

export default function EntrySheet({ open, type, preset, date, row, app, onClose, toast }) {
  const { state, actions } = app
  const T = TYPES[type] || TYPES.purchase
  const user = state.users.find((u) => u.id === state.currentUserId)
  const vehicles = state.settings.vehicles
  const [qty, setQty] = useState('')
  const [vehicle, setVehicle] = useState('')
  const [loc, setLoc] = useState('cold')
  const [reason, setReason] = useState(DAMAGE_REASONS[0])
  const [note, setNote] = useState('')
  const [billQty, setBillQty] = useState('')
  const [photos, setPhotos] = useState([])
  const [busy, setBusy] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    if (open) {
      setQty(preset?.qty ?? '')
      setVehicle(preset?.vehicle || vehicles[0] || '')
      setLoc(preset?.loc || 'cold')
      setReason(DAMAGE_REASONS[0]); setNote(''); setBillQty(''); setPhotos([]); setBusy(false)
    }
    // eslint-disable-next-line
  }, [open, type])

  const n = Number(qty) || 0
  const pv = packetValue(state.settings)
  const kg = Number(state.settings.packKg) || 5
  const needsStock = T.sign < 0 && !(type === 'damage' && loc === 'vehicle')
  const short = needsStock && n > row.systemClosing
  const hideSys = !!state.settings.blindCount && state.users.find((u) => u.id === state.currentUserId)?.role !== 'admin'
  const showVeh = T.vehicle || (type === 'damage' && loc === 'vehicle')

  async function addPhotos(files) {
    setBusy(true)
    try {
      const stamp = `${prettyDate(date, { day: 'numeric', month: 'short', year: 'numeric' })}  ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}  •  ${user?.name || ''}  •  ${n || ''} pkt ${type === 'purchase' ? 'bill/challan' : 'damage'}`
      const out = []
      for (const f of files) {
        const data = await compressPhoto(f, stamp)
        const id = 'p_' + uid()
        await putPhoto(id, data)
        out.push(id)
      }
      setPhotos((p) => [...p, ...out])
    } catch (e) { toast('Photo failed – try again') }
    setBusy(false)
  }

  function save() {
    if (n <= 0) return toast('Enter number of packets')
    if (showVeh && !vehicle) return toast('Choose a vehicle')
    actions.addEntry({
      date, type, qty: n,
      vehicle: showVeh ? vehicle : undefined,
      loc: type === 'damage' ? loc : undefined,
      reason: type === 'damage' ? reason : undefined,
      note: note.trim() || undefined,
      billQty: type === 'purchase' && billQty !== '' ? Number(billQty) : undefined,
      photoIds: photos
    })
    toast(`${T.icon} ${T.label}: ${n} packets saved`)
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`${T.icon} ${T.label}`}
      footer={
        <button className="btn primary big" style={{ background: T.color }} onClick={save} disabled={busy}>
          {busy ? 'Please wait…' : `Save ${n ? n + ' packets' : ''}`}
        </button>
      }
    >
      <p className="muted small">{T.hint} · {prettyDate(date)}</p>
      <label className="lbl">Number of packets ({kg} kg each)</label>
      <Stepper value={qty} onChange={setQty} />
      <div className={`calc ${short ? 'warn' : ''}`}>
        <b>{n * kg} kg</b> · {inr(n * pv)}
        {needsStock && (
          <span> · {hideSys ? (short ? '⚠ not enough stock?' : '') : <>cold room now: <b>{row.systemClosing}</b>{short && ' ⚠ not enough stock!'}</>}</span>
        )}
      </div>

      {type === 'purchase' && (
        <>
          <label className="lbl">Packets written on supplier bill / challan <span className="muted">(to catch short supply)</span></label>
          <input className="input" inputMode="numeric" placeholder="Same as received?" value={billQty} onChange={(e) => setBillQty(e.target.value.replace(/\D/g, ''))} />
          {billQty !== '' && n > 0 && Number(billQty) !== n && (
            <div className="calc warn">{Number(billQty) > n ? `⚠ Short supply: bill ${billQty}, received ${n} (${Number(billQty) - n} less)` : `ℹ Received ${n - Number(billQty)} more than the bill`}</div>
          )}
          <label className="lbl">Bill / challan photo <span className="muted">(optional)</span></label>
          <div className="photo-row">
            {photos.map((id) => <PhotoImg key={id} id={id} className="thumb" />)}
            <button className="photo-add" onClick={() => fileRef.current.click()} disabled={busy}><span>🧾</span>{busy ? 'Saving…' : 'Bill photo'}</button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden
              onChange={(e) => { if (e.target.files.length) addPhotos([...e.target.files]); e.target.value = '' }} />
          </div>
        </>
      )}

      {type === 'damage' && (
        <>
          <label className="lbl">Where did it get damaged?</label>
          <div className="chips">
            <button className={`chip big ${loc === 'cold' ? 'on' : ''}`} onClick={() => setLoc('cold')}>❄️ Cold room</button>
            <button className={`chip big ${loc === 'vehicle' ? 'on' : ''}`} onClick={() => setLoc('vehicle')}>🚚 In vehicle</button>
          </div>
        </>
      )}

      {showVeh && (
        <>
          <label className="lbl">Vehicle</label>
          <div className="chips">
            {vehicles.map((v) => (
              <button key={v} className={`chip big ${vehicle === v ? 'on' : ''}`} onClick={() => setVehicle(v)}>🚚 {v}</button>
            ))}
          </div>
        </>
      )}

      {type === 'damage' && (
        <>
          <label className="lbl">Reason</label>
          <div className="chips">
            {DAMAGE_REASONS.map((r) => (
              <button key={r} className={`chip ${reason === r ? 'on' : ''}`} onClick={() => setReason(r)}>{r}</button>
            ))}
          </div>
          <label className="lbl">Photo of damaged packets <span className="muted">(date, time & name get stamped)</span></label>
          <div className="photo-row">
            {photos.map((id) => <PhotoImg key={id} id={id} className="thumb" />)}
            <button className="photo-add" onClick={() => fileRef.current.click()} disabled={busy}>
              <span>📸</span>{busy ? 'Saving…' : 'Take photo'}
            </button>
            <input
              ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden
              onChange={(e) => { if (e.target.files.length) addPhotos([...e.target.files]); e.target.value = '' }}
            />
          </div>
        </>
      )}

      <label className="lbl">Note <span className="muted">(optional)</span></label>
      <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={type === 'purchase' ? 'Supplier / bill no.' : 'Any detail…'} />
    </Sheet>
  )
}
