import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useApp } from '../store'
import { Avatar, PinPad, Tilt } from '../ui'
import InstallBanner from './InstallBanner'

/** Caller sign-in: pick your name, enter your 4-digit PIN. */
export default function Login() {
  const { gate, loginList, loginErr, retryGate, login } = useApp()
  const [pick, setPick] = useState(null)
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [shake, setShake] = useState(0)

  const onPin = async (v) => {
    setPin(v)
    if (v.length < 4 || busy) return
    setBusy(true); setErr('')
    const r = await login(pick.id, v)
    setBusy(false)
    if (!r.ok) { setErr(r.error); setPin(''); setShake((s) => s + 1) }
  }

  return (
    <div className="login">
      <div className="bubbles">{Array.from({ length: 10 }).map((_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${i * 0.7}s`, width: 12 + (i % 4) * 9, height: 12 + (i % 4) * 9 }} />)}</div>

      <motion.div className="login-logo" initial={{ scale: 0, rotate: -120 }} animate={{ scale: 1, rotate: -6 }} transition={{ type: 'spring', stiffness: 220, damping: 14 }}>S</motion.div>
      <h1>Sridhi <span>Caller</span></h1>

      <AnimatePresence mode="wait">
        {gate === 'loading' && (
          <motion.div key="load" className="login-box center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <em className="spin big" /><p>Connecting…</p>
          </motion.div>
        )}

        {gate !== 'loading' && !pick && (
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

        {gate !== 'loading' && pick && (
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
      <InstallBanner dark />
    </div>
  )
}
