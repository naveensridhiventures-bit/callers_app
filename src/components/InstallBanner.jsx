import { useState } from 'react'
import { motion } from 'framer-motion'
import { useInstall } from '../install'
import { Icon } from '../ui'

/** "Install as app" card. Shows only while the app is running in a browser tab. */
export default function InstallBanner({ dismissible = false, dark = false }) {
  const { installed, canInstall, ios, install } = useInstall()
  const [hide, setHide] = useState(() => dismissible && localStorage.getItem('sridhi.installHide') === '1')
  if (installed || hide) return null
  return (
    <motion.div className={`install ${dark ? 'dark' : ''}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
      <div className="install-ico">📲</div>
      <div className="install-txt">
        <b>Install Sridhi Caller as an app</b>
        <small>
          {canInstall
            ? 'Opens full-screen like a real app. Back button works inside it.'
            : ios
              ? 'Tap Share ⬆️ then “Add to Home Screen”.'
              : 'Open the browser menu ⋮ and tap “Install app” / “Add to Home screen”.'}
        </small>
      </div>
      {canInstall && <button className="install-btn" onClick={install}>Install</button>}
      {dismissible && (
        <button className="install-x" aria-label="Hide" onClick={() => { localStorage.setItem('sridhi.installHide', '1'); setHide(true) }}>
          <Icon name="x" size={16} />
        </button>
      )}
    </motion.div>
  )
}
