import { useEffect, useState } from 'react'
import { getPhoto } from './db'

export function Avatar({ user, size = 28 }) {
  const name = user?.name || '?'
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.45, background: user?.color || '#94a3b8' }}>
      {name.trim().charAt(0).toUpperCase()}
    </span>
  )
}

export function PhotoImg({ id, className, onClick, alt = 'photo' }) {
  const [src, setSrc] = useState(null)
  useEffect(() => {
    let live = true
    getPhoto(id).then((v) => live && setSrc(v || null))
    return () => { live = false }
  }, [id])
  if (!src) return <div className={`photo-ph ${className || ''}`}>📷</div>
  return <img className={className} src={src} alt={alt} onClick={onClick} />
}

export function Sheet({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = '' }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" />
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Lightbox({ photoId, caption, onClose }) {
  if (!photoId) return null
  return (
    <div className="lightbox" onClick={onClose}>
      <button className="icon-btn light" onClick={onClose}>✕</button>
      <PhotoImg id={photoId} className="lb-img" />
      {caption && <div className="lb-cap">{caption}</div>}
    </div>
  )
}

export function Stepper({ value, onChange, quick = [1, 5, 10, 25] }) {
  const n = Number(value) || 0
  return (
    <div className="stepper-wrap">
      <div className="stepper">
        <button type="button" className="step-btn" onClick={() => onChange(Math.max(0, n - 1))} aria-label="minus">−</button>
        <input
          className="step-input"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          placeholder="0"
          onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, ''))}
        />
        <button type="button" className="step-btn plus" onClick={() => onChange(n + 1)} aria-label="plus">+</button>
      </div>
      <div className="quick">
        {quick.map((q) => (
          <button type="button" key={q} className="chip" onClick={() => onChange(n + q)}>+{q}</button>
        ))}
        <button type="button" className="chip ghost" onClick={() => onChange('')}>Clear</button>
      </div>
    </div>
  )
}

export function Toast({ msg }) {
  if (!msg) return null
  return <div className="toast">{msg}</div>
}
