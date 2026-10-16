import { motion } from 'framer-motion'
import { useApp } from '../store'
import { Segmented } from '../ui'
import Reports from './Reports'
import Scripts from './Scripts'
import Settings from './Settings'
import Admin from './Admin'

export default function More() {
  const { sub, go, session } = useApp()
  const isAdmin = session?.role === 'admin'
  const key = sub === 'admin' && !isAdmin ? 'reports' : sub
  const C = { reports: Reports, scripts: Scripts, settings: Settings, admin: Admin }[key] || Reports
  const options = [
    { value: 'reports', label: '📊 Reports' },
    { value: 'scripts', label: '🎙 Scripts' },
    { value: 'settings', label: '⚙️ Settings' },
    ...(isAdmin ? [{ value: 'admin', label: '🛡 Admin' }] : []),
  ]
  return (
    <div className="page">
      <div className="page-h"><h1>More</h1></div>
      <Segmented id="more-tab" value={key} onChange={(v) => go('more', v)} options={options} />
      <motion.div key={key} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        <C />
      </motion.div>
    </div>
  )
}
