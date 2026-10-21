import { useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../store'

/** Shown once, right after the first login: collects the Gmail used to send follow-up reminder mails. */
export default function GmailGate() {
  const { session, saveEmail, toast } = useApp()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [later, setLater] = useState(() => sessionStorage.getItem('sridhi.gmailLater') === '1')
  if (!session || session.role === 'admin' || session.email || later) return null

  const submit = async (e) => {
    e.preventDefault()
    const v = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return toast('Enter a valid Gmail ID', 'warn')
    setBusy(true)
    const ok = await saveEmail(v)
    setBusy(false)
    if (ok) toast('Gmail saved ✓ Follow-up mails are ON')
    else toast('Could not save. Check internet and try again', 'warn')
  }

  return (
    <div className="gate-back">
      <motion.form className="gate-card" onSubmit={submit} initial={{ opacity: 0, y: 40, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 22 }}>
        <div className="gate-ico">📧</div>
        <h2>Hi {session.name.split(' ')[0]}, add your Gmail</h2>
        <p>We collect your Gmail <b>only to email your follow-ups</b>: a reminder with the name, phone and map location lands in your inbox before each follow-up is due, even if the app is closed.</p>
        <p className="gate-tag">✅ Your follow-up will never fail.</p>
        <input type="email" inputMode="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="yourname@gmail.com" />
        <motion.button whileTap={{ scale: 0.97, y: 3 }} className="btn3d big" disabled={busy}>{busy ? 'Saving…' : 'Save & turn on reminders'}</motion.button>
        <button type="button" className="link-btn" onClick={() => { sessionStorage.setItem('sridhi.gmailLater', '1'); setLater(true) }}>Ask me again next time</button>
      </motion.form>
    </div>
  )
}
