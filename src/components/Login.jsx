import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useApp } from '../store'
import { Avatar, Icon, PinPad, Sheet, Tilt } from '../ui'

/** Caller sign-in. Tap the logo 5 times to reveal the hidden HR admin entry. */
export default function Login() {
  const { gate, loginList, loginErr, retryGate, login, adminLogin } = useApp()
  const [pick, setPick] = useState(null)
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [shake, setShake] = useState(0)
  const [admin, setAdmin] = useState(false)
  const [apin, setApin] = useState('')
  const taps = useRef({ n: 0, t: null })

  const logoTap = () => {
    clearTimeout(taps.current.t)
    taps.current.n += 1
    if (taps.current.n >= 5) {
      taps.current.n = 0
      setAdmin(true); setPick(null); setErr('')
    } else taps.current.t = setTimeout(() => (taps.current.n = 0), 1800)
  }

  const onPin = async (v) => {
    setPin(v)
    if (v.length < 4 || busy) return
    setBusy(true); setErr('')
    const r = await login(pick.id, v)
    setBusy(false)
    if (!r.ok) { setErr(r.error); setPin(''); setShake((s) => s + 1) }
  }

  const submitAdmin = async (e) => {
    e.preventDefault()
    if (!apin) return
    setBusy(true); setErr('')
    const r = await adminLogin(apin)
    setBusy(false)
    if (!r.ok) { setErr(r.error); setShake((s) => s + 1) }
  }

  return (
    <div className="login">
      <div className="bubbles">{Array.from({ length: 10 }).map((_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${i * 0.7}s`, width: 12 + (i % 4) * 9, height: 12 + (i % 4) * 9 }} />)}</div>

      <motion.button className="login-logo" onClick={logoTap} whileTap={{ scale: 0.9, rotate: -8 }} initial={{ scale: 0, rotate: -120 }} animate={{ scale: 1, rotate: -6 }} transition={{ type: 'spring', stiffness: 220, damping: 14 }} aria-label="Sridhi">S</motion.button>
      <h1>Sridhi <span>Caller</span></h1>

      <AnimatePresence mode="wait">
        {gate === 'loading' && (
          <motion.div key="load" className="login-box center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <em className="spin big" /><p>Connecting…</p>
          </motion.div>
        )}

        {gate !== 'loading' && admin && (
          <motion.form key="admin" className="login-box" onSubmit={submitAdmin} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
            <p className="lt"><Icon name="gear" size={16} /> HR admin</p>
            <motion.input key={shake} animate={{ x: shake ? [0, -10, 10, -8, 8, 0] : 0 }} type="password" autoFocus value={apin} onChange={(e) => setApin(e.target.value)} placeholder="Admin password" />
            {err && <div className="login-err">{err}</div>}
            <motion.button whileTap={{ scale: 0.97, y: 3 }} className="btn3d lime big" disabled={busy}>{busy ? 'Checking…' : 'Enter admin'}</motion.button>
            <button type="button" className="link-btn" onClick={() => { setAdmin(false); setErr(''); setApin('') }}>← Back to caller sign-in</button>
          </motion.form>
        )}

        {gate !== 'loading' && !admin && !pick && (
          <motion.div key="list" className="login-box" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
            <p className="lt">Who is calling today?</p>
            {loginErr && <div className="login-err">{loginErr}<button className="link-btn" onClick={retryGate}>Retry</button></div>}
            <div className="caller-grid">
              {loginList.map((c, i) => (
                <Tilt key={c.id} className="cg" max={12} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} whileTap={{ scale: 0.94 }} onClick={() => { setPick(c); setPin(''); setErr('') }}>
                  <Avatar name={c.name} size={54} />
                  <b>{c.name}</b>
                </Tilt>
              ))}
            </div>
          </motion.div>
        )}

        {gate !== 'loading' && !admin && pick && (
          <motion.div key="pin" className="login-box" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <Avatar name={pick.name} size={64} />
            <p className="lt">Hi {pick.name}! Enter your PIN</p>
            <motion.div key={shake} animate={{ x: shake ? [0, -12, 12, -8, 8, 0] : 0 }}>
              <PinPad value={pin} onChange={onPin} disabled={busy} />
            </motion.div>
            {err && <div className="login-err">{err}</div>}
            <button className="link-btn" onClick={() => { setPick(null); setPin(''); setErr('') }}>← Not me</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Hidden admin sign-in opened from inside the app (tap the logo 5 times). */
export function AdminPrompt({ onClose }) {
  const { adminLogin, toast, go } = useApp()
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setErr('')
    const r = await adminLogin(pin)
    setBusy(false)
    if (!r.ok) return setErr(r.error)
    toast('Admin mode on 🛡')
    onClose()
    go('more', 'admin')
  }
  return (
    <Sheet onClose={onClose}>
      <form className="sheet-body" onSubmit={submit}>
        <div className="sheet-title"><h2>🛡 HR admin</h2><button type="button" className="icon-btn" onClick={onClose}><Icon name="x" /></button></div>
        <input type="password" autoFocus value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Admin password" />
        {err && <div className="warn">{err}</div>}
        <motion.button whileTap={{ scale: 0.97, y: 3 }} className="btn3d big" disabled={busy || !pin}>{busy ? 'Checking…' : 'Enter admin'}</motion.button>
      </form>
    </Sheet>
  )
}
