import { useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../store'
import { Icon } from '../ui'
import InstallBanner from './InstallBanner'

/** Hidden HR entry: open  yoursite.com/control  and enter the admin password. */
export default function ControlLogin() {
  const { adminLogin, go, toast } = useApp()
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [shake, setShake] = useState(0)

  const submit = async (e) => {
    e.preventDefault()
    if (!pin) return
    setBusy(true); setErr('')
    const r = await adminLogin(pin)
    setBusy(false)
    if (!r.ok) { setErr(r.error); setShake((s) => s + 1); return }
    toast('Admin mode on 🛡')
    go('more', 'admin')
  }

  return (
    <div className="login">
      <div className="bubbles">{Array.from({ length: 10 }).map((_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${i * 0.7}s`, width: 12 + (i % 4) * 9, height: 12 + (i % 4) * 9 }} />)}</div>
      <motion.div className="login-logo" initial={{ scale: 0, rotate: -120 }} animate={{ scale: 1, rotate: -6 }} transition={{ type: 'spring', stiffness: 220, damping: 14 }}>🛡</motion.div>
      <h1>Sridhi <span>HR Control</span></h1>
      <motion.form className="login-box" onSubmit={submit} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
        <p className="lt"><Icon name="gear" size={16} /> Admin password</p>
        <motion.input key={shake} animate={{ x: shake ? [0, -10, 10, -8, 8, 0] : 0 }} type="password" autoFocus autoComplete="current-password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Enter admin password" />
        {err && <div className="login-err">{err}</div>}
        <motion.button whileTap={{ scale: 0.97, y: 3 }} className="btn3d lime big" disabled={busy || !pin}>{busy ? 'Checking…' : 'Open control'}</motion.button>
        <button type="button" className="link-btn" onClick={() => go('home')}>Open caller app →</button>
      </motion.form>
      <InstallBanner dark />
    </div>
  )
}
