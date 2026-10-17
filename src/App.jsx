import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AppProvider, useApp } from './store'
import { Icon } from './ui'
import Login from './components/Login'
import ControlLogin from './components/ControlLogin'
import Splash from './components/Splash'
import LeadForm from './components/LeadForm'
import LeadDetail from './components/LeadDetail'
import CallClose from './components/CallClose'
import DueModal from './components/DueModal'
import Dashboard from './pages/Dashboard'
import Leads from './pages/Leads'
import Followups from './pages/Followups'
import CallMode from './pages/CallMode'
import More from './pages/More'
import Settings from './pages/Settings'
import AdminOverview from './pages/AdminOverview'
import AdminTeam from './pages/AdminTeam'
import ReportCenter from './pages/ReportCenter'
import { Assign, Requests } from './pages/Admin'
import { bucket, fmtTime, nameOf } from './utils'

const PAGES = { home: Dashboard, leads: Leads, call: CallMode, follow: Followups, more: More }
const AdminAssign = () => <div className="page adm"><div className="page-h"><h1>Assign leads</h1></div><Assign /></div>
const AdminRequests = () => <div className="page adm"><div className="page-h"><h1>Delete requests</h1></div><Requests /></div>
const AdminSettings = () => <div className="page adm"><div className="page-h"><h1>Settings</h1></div><Settings /></div>
const AdminReports = () => <div className="page adm"><div className="page-h"><h1>Reports</h1></div><ReportCenter admin /></div>
const ADMIN_PAGES = { reports: AdminReports, overview: AdminOverview, team: AdminTeam, assign: AdminAssign, leads: Leads, requests: AdminRequests, settings: AdminSettings }
const ADMIN_TABS = [
  { id: 'overview', icon: 'chart', label: 'Progress' },
  { id: 'team', icon: 'users', label: 'Callers' },
  { id: 'assign', icon: 'send', label: 'Assign' },
  { id: 'leads', icon: 'list', label: 'Leads' },
  { id: 'requests', icon: 'trash', label: 'Requests' },
]
const TABS = [
  { id: 'home', icon: 'home', label: 'Home' },
  { id: 'leads', icon: 'users', label: 'Leads' },
  { id: 'call', icon: 'phone', label: 'Call', fab: true },
  { id: 'follow', icon: 'calendar', label: 'Follow-ups' },
  { id: 'more', icon: 'grid', label: 'More' },
]

function Shell() {
  const { route, page, go, sheet, closeSheet, openForm, leads, allLeads, toasts, sync, session, gate, openLead, toast, logout } = useApp()
  const isAdmin = session?.role === 'admin'
  const Page = isAdmin ? ADMIN_PAGES[page] || AdminOverview : PAGES[page] || Dashboard
  const curPage = isAdmin ? (ADMIN_PAGES[page] ? page : 'overview') : PAGES[page] ? page : 'home'
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
          const n = new Notification('Follow-up due', { body: `${nameOf(l)} · ${l.area || 'Bengaluru'}\n${l.lastRemark || ''}`, icon: '/icon-192.png' })
          n.onclick = () => { window.focus(); openLead(l.id) }
        }
      })
    }
    check()
    const t = setInterval(check, 30000)
    return () => clearInterval(t)
  }, [leads, toast, openLead])

  /* already signed in as admin and opened /control: go straight to the admin panel */
  useEffect(() => {
    if (route === 'control' && session?.role === 'admin') go('overview')
  }, [route, session, go])

  if (route === 'control') return <ControlLogin />
  if (gate !== 'ready') return <Login />

  const reqCount = isAdmin ? allLeads.filter((l) => l.delReq === '1').length : 0
  const due = leads.filter((l) => ['overdue', 'today'].includes(bucket(l))).length
  const formLead = sheet?.type === 'form' && sheet.leadId ? allLeads.find((l) => l.id === sheet.leadId) || null : null

  const tabs = isAdmin ? ADMIN_TABS : TABS
  const active = curPage

  return (
    <div className={`app ${isAdmin ? 'admin-app' : ''}`}>
      {isAdmin && (
        <aside className="side">
          <div className="brand"><i>S</i><b>Sridhi <span>HR Control</span></b></div>
          <nav>
            {ADMIN_TABS.map((t) => (
              <button key={t.id} className={active === t.id ? 'on' : ''} onClick={() => go(t.id)}>
                <Icon name={t.icon} size={20} /><span>{t.label}</span>
                {t.id === 'requests' && reqCount > 0 && <b className="badge static">{reqCount}</b>}
              </button>
            ))}
            <button className={active === 'reports' ? 'on' : ''} onClick={() => go('reports')}><Icon name="download" size={20} /><span>Reports</span></button>
            <button className={active === 'settings' ? 'on' : ''} onClick={() => go('settings')}><Icon name="gear" size={20} /><span>Settings</span></button>
          </nav>
          <div className="side-foot">
            <span className={`sync ${sync.state}`} title={sync.msg || 'Google Sheets auto-sync'}><Icon name="cloud" size={16} /> {sync.state === 'error' ? 'Sync problem' : sync.state === 'syncing' ? 'Syncing…' : 'Synced'}</span>
            <button className="btn-soft sm" onClick={logout}>Exit admin</button>
          </div>
        </aside>
      )}

      <div className="content">
        <header className="top">
          <div className="brand"><i>S</i><b>Sridhi <span>{isAdmin ? 'HR Control' : 'Caller'}</span></b></div>
          <div className="top-r">
            {session && !isAdmin && <span className="who">👤 {session.name.split(' ')[0]}</span>}
            <span className={`sync ${sync.state}`} title={sync.msg || 'Google Sheets auto-sync'} onClick={() => go(isAdmin ? 'settings' : 'more', isAdmin ? undefined : 'settings')}>
              <Icon name="cloud" size={16} />{sync.state === 'syncing' ? <em className="spin" /> : null}
            </span>
            <button className="icon-btn" onClick={() => go(isAdmin ? 'settings' : 'more', isAdmin ? undefined : 'settings')} aria-label="Settings"><Icon name="gear" size={20} /></button>
          </div>
        </header>

        <motion.main key={`${isAdmin ? 'a' : 'c'}-${curPage}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.26 }}>
          <Page />
        </motion.main>
      </div>

      {(!isAdmin ? page !== 'call' : active === 'leads') && (
        <motion.button className="fab-add" initial={{ scale: 0 }} animate={{ scale: 1 }} whileTap={{ scale: 0.88 }} whileHover={{ scale: 1.08, rotate: 90 }} onClick={() => openForm()} aria-label="Add lead">
          <Icon name="plus" size={26} />
        </motion.button>
      )}

      <nav className="dock">
        {tabs.map((t) => (
          <button key={t.id} className={`${active === t.id ? 'on' : ''} ${t.fab ? 'fab' : ''}`} onClick={() => go(t.id)}>
            {active === t.id && !t.fab && <motion.span layoutId="dock-pill" className="dock-pill" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}
            <motion.span className="ico" whileTap={{ scale: 0.8 }} animate={active === t.id && !t.fab ? { y: -2 } : { y: 0 }}>
              <Icon name={t.icon} size={t.fab ? 26 : 22} />
              {t.id === 'follow' && due > 0 && <b className="badge">{due > 99 ? '99+' : due}</b>}
              {t.id === 'requests' && reqCount > 0 && <b className="badge">{reqCount}</b>}
            </motion.span>
            <small>{t.label}</small>
          </button>
        ))}
      </nav>

      {sheet?.type === 'form' && <LeadForm key="form" lead={formLead} preset={sheet.preset} onClose={closeSheet} />}
      {sheet?.type === 'detail' && <LeadDetail key={`d-${sheet.id}`} id={sheet.id} calling={sheet.calling} preset={sheet.outcome} onClose={closeSheet} />}

      {!isAdmin && <><DueModal /><CallClose /></>}

      <div className="toasts">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.type}`}>{t.msg}</div>)}
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
