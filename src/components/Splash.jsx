import { useEffect } from 'react'
import { motion } from 'framer-motion'

const FACES = ['S', '🌿', 'Idli', 'Dosa', '100%', '✓']

export default function Splash({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <motion.div className="splash" exit={{ opacity: 0, scale: 1.12 }} transition={{ duration: 0.55 }} onClick={onDone}>
      {Array.from({ length: 14 }).map((_, i) => (
        <i key={i} className="bubble" style={{ left: `${(i * 73) % 100}%`, animationDelay: `${(i % 7) * 0.6}s`, width: 10 + (i % 5) * 8, height: 10 + (i % 5) * 8 }} />
      ))}
      <div className="scene">
        <div className="cube">
          {FACES.map((f, i) => <div key={i} className={`face f${i + 1}`}>{f}</div>)}
        </div>
        <div className="cube-shadow" />
      </div>
      <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, type: 'spring' }}>
        Sridhi <span>Caller</span>
      </motion.h1>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>
        Soft Idlies &amp; Crispy Dosas · Distributor &amp; Sales Follow-up
      </motion.p>
      <div className="loadbar"><motion.i initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 2.4, ease: 'easeInOut' }} /></div>
    </motion.div>
  )
}
