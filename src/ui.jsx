import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useMotionValue, useSpring, useTransform, useDragControls, animate } from 'framer-motion'
import { STATUSES } from './constants'

/* ---------- Icons ---------- */
const P = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  users: 'M17 20v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1|M10 11a4 4 0 100-8 4 4 0 000 8z|M21 20v-1a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  chart: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  send: 'M22 2L11 13|M22 2l-7 20-4-9-9-4 20-7z',
  copy: 'M9 9h11v11H9z|M5 15V5a1 1 0 011-1h10',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  gear: 'M12 15a3 3 0 100-6 3 3 0 000 6z|M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-5-5',
  whatsapp: 'M21 12a9 9 0 01-13.4 7.8L3 21l1.3-4.4A9 9 0 1121 12z|M9 9.5c.5 2.5 2.5 4.5 5 5l1.2-1.2-2-1-.8.8a4 4 0 01-1.8-1.8l.8-.8-1-2z',
  mail: 'M3 5h18v14H3zM3 6l9 7 9-7',
  check: 'M5 12l5 5 9-10',
  x: 'M6 6l12 12M18 6L6 18',
  clock: 'M12 7v5l3 2|M12 21a9 9 0 100-18 9 9 0 000 18z',
  bell: 'M6 8a6 6 0 1112 0c0 7 3 8 3 8H3s3-1 3-8|M10 20a2 2 0 004 0',
  flame: 'M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-9z',
  download: 'M12 3v12M7 10l5 5 5-5M4 20h16',
  upload: 'M12 15V3M7 8l5-5 5 5M4 20h16',
  chevron: 'M9 6l6 6-6 6',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  pin: 'M12 21s7-6 7-12a7 7 0 10-14 0c0 6 7 12 7 12z|M12 11a2 2 0 100-4 2 2 0 000 4z',
  spark: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
  play: 'M7 4l13 8-13 8z',
  refresh: 'M20 11a8 8 0 00-14-4L4 9M4 4v5h5M4 13a8 8 0 0014 4l2-2M20 20v-5h-5',
  cloud: 'M7 18a5 5 0 010-10 6 6 0 0111.5 1.5A4 4 0 0118 18z',
  copy: 'M9 9h11v11H9zM5 15V4h11',
  book: 'M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19a2 2 0 012-2h13',
  target: 'M12 21a9 9 0 100-18 9 9 0 000 18z|M12 16a4 4 0 100-8 4 4 0 000 8z',
  skip: 'M5 4l10 8-10 8zM19 5v14',
}
export function Icon({ name, size = 20, ...p }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      {(P[name] || '').split('|').map((d, i) => <path key={i} d={d} />)}
    </svg>
  )
}

/* ---------- 3D tilt wrapper ---------- */
export function Tilt({ children, className = '', max = 10, style, ...rest }) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rx = useSpring(useTransform(y, [-0.5, 0.5], [max, -max]), { stiffness: 200, damping: 18 })
  const ry = useSpring(useTransform(x, [-0.5, 0.5], [-max, max]), { stiffness: 200, damping: 18 })
  const move = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    x.set((e.clientX - r.left) / r.width - 0.5)
    y.set((e.clientY - r.top) / r.height - 0.5)
  }
  const leave = () => { x.set(0); y.set(0) }
  return (
    <motion.div
      className={className}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900, transformStyle: 'preserve-3d', ...style }}
      onPointerMove={move} onPointerLeave={leave} onPointerUp={leave} onPointerCancel={leave}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

/* ---------- animated number ---------- */
export function Counter({ value, duration = 1 }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const c = animate(0, value, { duration, onUpdate: (x) => setV(Math.round(x)) })
    return () => c.stop()
  }, [value, duration])
  return <>{v}</>
}

/* ---------- progress ring ---------- */
export function Ring({ value, max, size = 128, stroke = 12, children }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.min(1, value / Math.max(1, max))
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <defs>
          <linearGradient id="ringg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#d4e83a" />
            <stop offset="1" stopColor="#ffffff" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,.18)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} stroke="url(#ringg)" strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 1.3, ease: 'easeOut' }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-in">{children}</div>
    </div>
  )
}

/* ---------- small bits ---------- */
const GRADS = [
  ['#16a34a', '#065f46'], ['#0ea5e9', '#1e3a8a'], ['#f59e0b', '#b45309'],
  ['#8b5cf6', '#4c1d95'], ['#ec4899', '#9d174d'], ['#14b8a6', '#0f766e'],
]
export function Avatar({ name = '?', size = 46, icon = false }) {
  const g = useMemo(() => GRADS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % GRADS.length], [name])
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.4, background: `linear-gradient(135deg, ${g[0]}, ${g[1]})` }}>
      {icon ? '📞' : name.trim().charAt(0).toUpperCase()}
    </div>
  )
}

export function StatusPill({ status }) {
  const c = STATUSES.find((s) => s.id === status)?.color || '#64748b'
  return <span className="pill" style={{ '--c': c }}>{status}</span>
}

export function Segmented({ id, value, onChange, options }) {
  return (
    <div className="seg">
      {options.map((o) => {
        const val = o.value ?? o
        const label = o.label ?? o
        return (
          <button key={val} type="button" className={value === val ? 'on' : ''} onClick={() => onChange(val)}>
            {value === val && <motion.span layoutId={`${id}-pill`} className="seg-pill" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}

/* ---------- bottom sheet ---------- */
export function Sheet({ onClose, children, footer }) {
  const controls = useDragControls()
  const [closing, setClosing] = useState(false)
  const timer = useRef()
  // CSS animations + a timer (not exit animations) so the overlay can never get stuck on screen
  const close = useCallback(() => {
    if (closing) return
    setClosing(true)
    timer.current = setTimeout(onClose, 190)
  }, [closing, onClose])
  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])
  return (
    <div className={`sheet-back ${closing ? 'out' : ''}`} onClick={close}>
      <motion.div
        className="sheet"
        drag="y" dragListener={false} dragControls={controls}
        dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.7 }}
        onDragEnd={(_, i) => (i.offset.y > 120 || i.velocity.y > 600) && close()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grab" onPointerDown={(e) => controls.start(e)}><i /></div>
        <div className="sheet-scroll">{children}</div>
        {footer}
      </motion.div>
    </div>
  )
}

/* ---------- confetti ---------- */
export function Confetti() {
  const bits = useMemo(
    () => Array.from({ length: 36 }, (_, i) => ({
      i, x: (Math.random() - 0.5) * 460, y: -(120 + Math.random() * 260), r: Math.random() * 720,
      c: ['#d4e83a', '#22c55e', '#ffffff', '#f59e0b', '#38bdf8'][i % 5], s: 6 + Math.random() * 8,
    })),
    []
  )
  return (
    <div className="confetti">
      {bits.map((b) => (
        <motion.i
          key={b.i}
          style={{ background: b.c, width: b.s, height: b.s * 1.6 }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: b.x, y: [0, b.y, b.y + 420], opacity: [1, 1, 0], rotate: b.r }}
          transition={{ duration: 1.9, ease: 'easeOut' }}
        />
      ))}
    </div>
  )
}

/* ---------- PIN keypad ---------- */
export function PinPad({ value, onChange, len = 4, disabled }) {
  const press = (k) => {
    if (disabled) return
    if (k === '⌫') return onChange(value.slice(0, -1))
    if (value.length < len) onChange(value + k)
  }
  return (
    <div className="pinpad">
      <div className="pin-dots">
        {Array.from({ length: len }).map((_, i) => (
          <motion.i key={i} className={i < value.length ? 'on' : ''} animate={{ scale: i === value.length - 1 ? [1, 1.35, 1] : 1 }} />
        ))}
      </div>
      <div className="keys">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) =>
          k === '' ? <span key={i} /> : (
            <motion.button key={i} type="button" whileTap={{ scale: 0.88, y: 3 }} onClick={() => press(k)}>{k}</motion.button>
          )
        )}
      </div>
    </div>
  )
}
