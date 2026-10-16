import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AppProvider, useApp } from './store'
import { Icon } from './ui'
import Login, { AdminPrompt } from './components/Login'
import Splash from './components/Splash'
import LeadForm from './components/LeadForm'
import LeadDetail from './components/LeadDetail'
import Dashboard from './pages/Dashboard'
import Leads from './pages/Leads'
import Followups from './pages/Followups'
import CallMode from './pages/CallMode'
import More from './pages/More'
import { bucket, fmtTime, nameOf } from './utils'

const PAGES = { home: Dashboard, leads: Leads, call: CallMode, follow: Followups, more: More }
const TABS = [
  { id: 'home', icon: 'home', label: 'Home' },
  { id: 'leads', icon: 'users', label: 'Leads' },
  { id: 'call', icon: 'phone', label: 'Call', fab: true },
  { id: 'follow', icon: 'calendar', label: 'Follow-ups' },
  { id: 'more', icon: 'grid', label: 'More' },
]

function Shell() {
  const { page, go, sheet, closeSheet, openForm, leads, toasts, sync, session, gate, openLead, toast } = useApp()
  const [adminAsk, setAdminAsk] = useState(false)
  const logoTaps = useRef({ n: 0, t: null })
  const logoTap = () => {
    clearTimeout(logoTaps.current.t)
    logoTaps.current.n += 1
    if (logoTaps.current.n >= 5) { logoTaps.current.n = 0; setAdminAsk(true) }
    else logoTaps.current.t = setTimeout(() => (logoTaps.current.n = 0), 1800)
  }
  const Page = PAGES[page]
  const notified = useRef(new Set(JSON.parse(localStorage.getItem('sridhi.notified') || '[]')))

  /* due-follow-up reminders while the app is open */
  useEffect(() => {
    const check = () => {
      const now = Date.now()
      leads.forEach((l) => {
        if (!['overdue', 'today'].includes(bucket(l))) return
        const t = new Date(l.nextFollowUp).getTime()
        const key = `${l.id}@${l.nextFollowUp}`
        if (t > now || now - t > 6 * 3600e3 || notified.current.has(key)) return
        notified.current.add(key)
        localStorage.setItem('sridhi.notified', JSON.stringify([...notified.current].slice(-300)))
        toast(`⏰ Call ${nameOf(l)} now (${fmtTime(l.nextFollowUp)})`, 'warn')
        navigator.vibrate?.([120, 60, 120])
        if ('Notification' in window && Notification.permission === 'granted') {
          const n = new Notification('Follow-up due', { body: `${nameOf(l)} · ${l.area || 'Bengaluru'}\n${l.lastRemark || ''}`, icon: '/icon.svg' })
          n.onclick = () => { window.focus(); openLead(l.id) }
        }
      })
    }
    check()
    const t = setInterval(check, 30000)
    return () => clearInterval(t)
  }, [leads, toast, openLead])

  if (gate !== 'ready') return <Login />

  const due = leads.filter((l) => ['overdue', 'today'].includes(bucket(l))).length

  return (
    <div className="app">
      <header className="top">
        <div className="brand" onClick={logoTap}><i>S</i><b>Sridhi <span>Caller</span></b></div>
        <div className="top-r">
          {session && <span className="who">{session.role === 'admin' ? '🛡' : '👤'} {session.name.split(' ')[0]}</span>}
          <span className={`sync ${sync.state}`} title={sync.msg || 'Google Sheets auto-sync'} onClick={() => go('more', 'settings')}>
            <Icon name="cloud" size={16} />{sync.state === 'syncing' ? <em className="spin" /> : null}
          </span>
          <button className="icon-btn" onClick={() => go('more', 'settings')} aria-label="Settings"><Icon name="gear" size={20} /></button>
        </div>
      </header>

      <AnimatePresence mode="wait">
        <motion.main key={page} initial={{ opacity: 0, y: 18, rotateX: -4 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.28 }}>
          <Page />
        </motion.main>
      </AnimatePresence>

      {page !== 'call' && (
        <motion.button className="fab-add" initial={{ scale: 0 }} animate={{ scale: 1 }} whileTap={{ scale: 0.88 }} whileHover={{ scale: 1.08, rotate: 90 }} onClick={() => openForm()} aria-label="Add lead">
          <Icon name="plus" size={26} />
        </motion.button>
      )}

      <nav className="dock">
        {TABS.map((t) => (
          <button key={t.id} className={`${page === t.id ? 'on' : ''} ${t.fab ? 'fab' : ''}`} onClick={() => go(t.id)}>
            {page === t.id && !t.fab && <motion.span layoutId="dock-pill" className="dock-pill" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}
            <motion.span className="ico" whileTap={{ scale: 0.8 }} animate={page === t.id && !t.fab ? { y: -2 } : { y: 0 }}>
              <Icon name={t.icon} size={t.fab ? 26 : 22} />
              {t.id === 'follow' && due > 0 && <b className="badge">{due > 99 ? '99+' : due}</b>}
            </motion.span>
            <small>{t.label}</small>
          </button>
        ))}
      </nav>

      <AnimatePresence>
        {adminAsk && <AdminPrompt key="admin" onClose={() => setAdminAsk(false)} />}
        {sheet?.type === 'form' && <LeadForm key="form" lead={sheet.lead} preset={sheet.preset} onClose={closeSheet} />}
        {sheet?.type === 'detail' && <LeadDetail key={`d-${sheet.id}`} id={sheet.id} calling={sheet.calling} onClose={closeSheet} />}
      </AnimatePresence>

      <div className="toasts">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div key={t.id} className={`toast ${t.type}`} layout initial={{ opacity: 0, y: 30, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }}>
              {t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default function App() {
  const [splash, setSplash] = useState(true)
  return (
    <AppProvider>
      <Shell />
      <AnimatePresence>{splash && <Splash key="splash" onDone={() => setSplash(false)} />}</AnimatePresence>
    </AppProvider>
  )
}
