import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../store'
import { Icon, Sheet } from '../ui'
import { bestFix, inChennai } from '../location'
import { CREDIT_DAYS, RATE, deliveryCall, dueAtFor, dueState, dueText, inr, ledger, paymentCall } from '../stock'
import { waHref } from '../utils'
import { fmtDay } from '../reports'

/**
 * Stock delivered to a distributor + cash collected, in one simple screen.
 *   mode 'deliver': pick distributor > packets (₹35 each) > returned packets > cash or credit > save
 *   mode 'pay'    : pick distributor > amount received > save
 */
export default function StockSheet({ preset = {}, onClose }) {
  const { leads, session, logStock, toast } = useApp()
  const dists = useMemo(() => leads.filter((l) => l.type === 'milk'), [leads])
  const [mode, setMode] = useState(preset.mode || 'deliver')
  const [id, setId] = useState(preset.id || '')
  const [q, setQ] = useState('')
  const [packets, setPackets] = useState('')
  const [returned, setReturned] = useState('')
  const [pay, setPay] = useState('Cash')
  const [collected, setCollected] = useState('')
  const [touched, setTouched] = useState(false)
  const [days, setDays] = useState(3)
  const [note, setNote] = useState('')
  const [amount, setAmount] = useState('')
  const [via, setVia] = useState('Cash')
  const [loc, setLoc] = useState(null)
  const [done, setDone] = useState(null)

  const lead = dists.find((l) => l.id === id)
  const L = lead ? ledger(lead) : null
  const P = Number(packets) || 0, R = Number(returned) || 0
  const bill = (P - R) * RATE
  const col = touched ? Number(collected) || 0 : pay === 'Cash' ? Math.max(bill, 0) : 0
  const open = Math.max(0, bill - Math.min(col, Math.max(bill, 0)))

  useEffect(() => { bestFix({ ms: 10000, good: 30 }).then((f) => inChennai(f) && setLoc(f)).catch(() => {}) }, [])
  useEffect(() => { if (L && mode === 'pay' && !amount) setAmount(String(L.outstanding || '')) /* eslint-disable-next-line */ }, [id, mode])

  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    return dists.filter((l) => !t || `${l.name} ${l.area} ${l.phone} ${l.contactName || ''}`.toLowerCase().includes(t))
      .sort((a, b) => (a.area || '').localeCompare(b.area || '') || a.name.localeCompare(b.name)).slice(0, 40)
  }, [dists, q])

  const saveDelivery = () => {
    if (!lead) return toast('Select the distributor', 'warn')
    if (P <= 0) return toast('Enter how many packets were delivered', 'warn')
    if (R > 0 && R > P + 5000) return toast('Check the returned packets', 'warn')
    if (pay === 'Credit' && open <= 0 && bill > 0 && touched && col >= bill) { /* fully paid: fine */ }
    const e = deliveryCall({ packets: P, returned: R, collected: col, pay, days, note: note.trim() })
    logStock(lead, e, loc)
    navigator.vibrate?.(40)
    setDone({ kind: 'deliver', e, lead, bill, open })
  }
  const savePayment = () => {
    const a = Number(amount) || 0
    if (!lead) return toast('Select the distributor', 'warn')
    if (a <= 0) return toast('Enter the amount received', 'warn')
    logStock(lead, paymentCall({ amount: a, via, note: note.trim() }), loc)
    navigator.vibrate?.(40)
    setDone({ kind: 'pay', lead, amount: a, left: Math.max(0, L.outstanding - a) })
  }

  /* ---------- success ---------- */
  if (done) {
    const d = done.lead
    const msg = done.kind === 'deliver'
      ? `Hi ${d.contactName || d.name}, Sridhi Idli & Dosa Batter delivery:\n${done.e.dlPackets} packets × ${inr(RATE)}${done.e.dlReturned ? `\nReturned: ${done.e.dlReturned} packets` : ''}\n*Bill: ${inr(done.bill)}*\n${done.open > 0 ? `Credit: ${inr(done.open)} - please pay by ${fmtDay(done.e.dlDue)}` : 'Paid. Thank you!'}`
      : `Hi ${d.contactName || d.name}, we received ${inr(done.amount)}. ${done.left > 0 ? `Balance: ${inr(done.left)}.` : 'No balance pending. Thank you!'} - Sridhi`
    return (
      <Sheet onClose={onClose} footer={<div className="sheet-foot"><button type="button" className="btn3d lime big" onClick={onClose}><Icon name="check" size={20} /> Done</button></div>}>
        <div className="mk st">
          <div className="st-ok">
            <span>✅</span>
            <h2>{done.kind === 'deliver' ? 'Delivery saved' : 'Payment saved'}</h2>
            <p>{d.name}</p>
            {done.kind === 'deliver'
              ? <><b>{done.e.dlPackets} packets · {inr(done.bill)}</b><small>{done.open > 0 ? `Credit ${inr(done.open)} · collect by ${fmtDay(done.e.dlDue)}. You will be reminded.` : 'Cash received in full'}</small></>
              : <><b>{inr(done.amount)} received</b><small>{done.left > 0 ? `Still pending: ${inr(done.left)}` : 'Nothing pending'}</small></>}
          </div>
          {d.phone && <a className="btn-soft st-wa" href={waHref(d.phone, msg)} target="_blank" rel="noreferrer"><Icon name="whatsapp" size={18} /> Send bill on WhatsApp</a>}
        </div>
      </Sheet>
    )
  }

  const foot = (
    <div className="sheet-foot">
      <button type="button" className="btn3d lime big" onClick={mode === 'deliver' ? saveDelivery : savePayment}>
        <Icon name="check" size={20} /> {mode === 'deliver' ? `Save delivery${P > 0 ? ` · ${inr(bill)}` : ''}` : `Save payment${Number(amount) ? ` · ${inr(amount)}` : ''}`}
      </button>
    </div>
  )

  return (
    <Sheet onClose={onClose} footer={foot}>
      <div className="mk st">
        <header className="mk-head">
          <span className="mk-ico">📦</span>
          <div><small>Sridhi Idli &amp; Dosa Batter · {inr(RATE)} / packet</small><h2>{mode === 'deliver' ? 'Deliver stock' : 'Collect payment'}</h2></div>
          <button type="button" className="ls-x" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </header>

        <div className="mk-tabs st-tabs" role="tablist">
          {[['deliver', '📦 Deliver stock'], ['pay', '💰 Collect payment']].map(([k, t]) => (
            <button key={k} type="button" role="tab" aria-selected={mode === k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}><span>{t}</span></button>
          ))}
        </div>

        {/* distributor */}
        <section className="mk-sec">
          <h3 className="mk-h"><i>1</i> Distributor</h3>
          {lead ? (
            <div className="st-sel">
              <div><b>{lead.name}</b><small>📍 {lead.area || 'Chennai'}{lead.phone ? ` · ${lead.phone}` : ''}</small>
                {L.outstanding > 0 && <em className={`st-owe ${dueState(L).k}`}>Owes {inr(L.outstanding)} · {dueText(dueState(L))}</em>}</div>
              <button type="button" className="btn-soft sm" onClick={() => { setId(''); setAmount('') }}>Change</button>
            </div>
          ) : (
            <>
              <input className="st-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Search name, area or phone" />
              <ul className="st-list">
                {list.map((l) => { const x = ledger(l); return (
                  <li key={l.id}><button type="button" onClick={() => setId(l.id)}>
                    <b>{l.name}</b><small>{l.area || 'Chennai'}{l.phone ? ` · ${l.phone}` : ''}</small>
                    {x.outstanding > 0 && <em>{inr(x.outstanding)} due</em>}
                  </button></li>) })}
                {!list.length && <li className="st-none">No distributor found. Add the distributor from the Areas tab first.</li>}
              </ul>
            </>
          )}
        </section>

        {lead && mode === 'deliver' && (
          <>
            <section className="mk-sec">
              <h3 className="mk-h"><i>2</i> Packets delivered</h3>
              <div className="st-big"><input inputMode="numeric" pattern="[0-9]*" value={packets} onChange={(e) => setPackets(e.target.value.replace(/\D/g, ''))} placeholder="0" aria-label="Packets delivered" autoFocus /><span>packets</span></div>
              <div className="chips">{[50, 100, 150, 200, 300].map((n) => <button key={n} type="button" className="chip" onClick={() => setPackets(String(n))}>{n}</button>)}</div>
              <label className="field"><span>Packets taken back (returned / expired)</span>
                <input inputMode="numeric" pattern="[0-9]*" value={returned} onChange={(e) => setReturned(e.target.value.replace(/\D/g, ''))} placeholder="0" /></label>
            </section>

            <section className="mk-sec st-bill">
              <div><span>{P} × {inr(RATE)}</span><b>{inr(P * RATE)}</b></div>
              {R > 0 && <div className="neg"><span>Returned {R} × {inr(RATE)}</span><b>− {inr(R * RATE)}</b></div>}
              <div className="tot"><span>Bill amount</span><b>{inr(bill)}</b></div>
            </section>

            <section className="mk-sec">
              <h3 className="mk-h"><i>3</i> Payment</h3>
              <div className="st-pay">
                {[['Cash', '💵', 'Paid now'], ['Credit', '🧾', 'Pay later']].map(([k, ic, s]) => (
                  <button key={k} type="button" className={pay === k ? 'on' : ''} onClick={() => { setPay(k); setTouched(false); setCollected('') }}><em>{ic}</em><b>{k}</b><small>{s}</small></button>
                ))}
              </div>
              <label className="field"><span>Cash collected now (₹)</span>
                <input inputMode="numeric" pattern="[0-9]*" value={touched ? collected : String(col || '')} onChange={(e) => { setTouched(true); setCollected(e.target.value.replace(/\D/g, '')) }} placeholder="0" /></label>
              {open > 0 && (
                <div className="st-credit">
                  <p>🧾 <b>{inr(open)}</b> on credit. How many days?</p>
                  <div className="chips">
                    {CREDIT_DAYS.map((n) => <button key={n} type="button" className={`chip ${days === n ? 'on' : ''}`} onClick={() => setDays(n)}>{n} days</button>)}
                  </div>
                  <small>⏰ Collect by <b>{fmtDay(dueAtFor(days))}</b>. The app will remind you.</small>
                </div>
              )}
              {open === 0 && bill > 0 && <p className="mk-when">✅ Fully paid in cash</p>}
            </section>

            <section className="mk-sec">
              <label className="field"><span>Note (optional)</span><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything to remember" /></label>
            </section>
          </>
        )}

        {lead && mode === 'pay' && (
          <section className="mk-sec">
            <h3 className="mk-h"><i>2</i> Amount received</h3>
            {L.outstanding > 0
              ? <p className={`st-owe big ${dueState(L).k}`}>Pending {inr(L.outstanding)} · {dueText(dueState(L))}</p>
              : <p className="mk-hint">Nothing is pending for this distributor. You can still record an advance.</p>}
            <div className="st-big"><input inputMode="numeric" pattern="[0-9]*" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} placeholder="0" aria-label="Amount received" /><span>₹</span></div>
            {L.outstanding > 0 && <div className="chips"><button type="button" className="chip" onClick={() => setAmount(String(L.outstanding))}>Full {inr(L.outstanding)}</button></div>}
            <div className="chips">{['Cash', 'UPI'].map((v) => <button key={v} type="button" className={`chip ${via === v ? 'on' : ''}`} onClick={() => setVia(v)}>{v === 'Cash' ? '💵 Cash' : '📲 UPI'}</button>)}</div>
            <label className="field"><span>Note (optional)</span><input value={note} onChange={(e) => setNote(e.target.value)} /></label>
          </section>
        )}
        <p className="st-loc">{loc ? `📍 Location noted ±${Math.round(loc.acc)} m` : '🛰️ Getting location…'}</p>
      </div>
    </Sheet>
  )
}
