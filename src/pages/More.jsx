import { motion } from 'framer-motion'
import { useApp } from '../store'
import { Segmented } from '../ui'
import Reports from './Reports'
import Scripts from './Scripts'
import Settings from './Settings'

export default function More() {
  const { sub, go } = useApp()
  const key = ['reports', 'scripts', 'settings'].includes(sub) ? sub : 'reports'
  const C = { reports: Reports, scripts: Scripts, settings: Settings }[key]
  const options = [
    { value: 'reports', label: '📊 Reports' },
    { value: 'scripts', label: '🎙 Scripts' },
    { value: 'settings', label: '⚙️ Settings' },
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
