import { AnimatePresence, motion } from 'framer-motion'
import { useApp } from '../store'
import { Segmented } from '../ui'
import Reports from './Reports'
import Scripts from './Scripts'
import Settings from './Settings'

export default function More() {
  const { sub, go } = useApp()
  const C = { reports: Reports, scripts: Scripts, settings: Settings }[sub] || Reports
  return (
    <div className="page">
      <div className="page-h"><h1>More</h1></div>
      <Segmented id="more-tab" value={sub} onChange={(v) => go('more', v)}
        options={[{ value: 'reports', label: '📊 Reports' }, { value: 'scripts', label: '🎙 Scripts' }, { value: 'settings', label: '⚙️ Settings' }]} />
      <AnimatePresence mode="wait">
        <motion.div key={sub} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
          <C />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
