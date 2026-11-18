import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../ui'

const stamp = (loc, label) => {
  const d = new Date()
  const t = d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
  const g = loc ? `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}${loc.acc ? `  ±${Math.round(loc.acc)}m` : ''}` : 'Location not available'
  return [label, t, g]
}

/** draws the camera frame to a canvas, with a date / place / GPS strip burned into the picture */
function snap(video, loc, label) {
  const max = 1280
  const k = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight))
  const w = Math.round(video.videoWidth * k), h = Math.round(video.videoHeight * k)
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const x = c.getContext('2d'); x.drawImage(video, 0, 0, w, h)
  const lines = stamp(loc, label), fs = Math.max(14, Math.round(w / 34)), pad = Math.round(fs * .7)
  const bh = pad * 2 + fs * 1.25 * lines.length
  x.fillStyle = 'rgba(4,32,15,.72)'; x.fillRect(0, h - bh, w, bh)
  x.fillStyle = '#d4e83a'; x.font = `800 ${fs}px system-ui, sans-serif`; x.textBaseline = 'top'
  lines.forEach((l, i) => { x.fillStyle = i === 0 ? '#d4e83a' : '#fff'; x.font = `${i === 0 ? 800 : 600} ${fs}px system-ui, sans-serif`; x.fillText(l, pad, h - bh + pad + i * fs * 1.25, w - pad * 2) })
  return new Promise((res) => c.toBlob((b) => res(b), 'image/jpeg', 0.72))
}

/**
 * Live camera only. There is no "choose from gallery": the picture must be taken at the shop, right now.
 * If the phone blocks the camera we fall back to the system camera (capture="environment").
 */
export default function CameraCapture({ loc, label, onShot, onClose }) {
  const vid = useRef(null), stream = useRef(null), fb = useRef(null)
  const [err, setErr] = useState('')
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let dead = false
    ;(async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('nocam')
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false })
        if (dead) return s.getTracks().forEach((t) => t.stop())
        stream.current = s
        if (vid.current) { vid.current.srcObject = s; await vid.current.play().catch(() => {}) ; setReady(true) }
      } catch (e) { if (!dead) setErr(e?.name === 'NotAllowedError' ? 'Camera is blocked. Allow camera for this site in your browser settings, then try again.' : 'Could not open the camera.') }
    })()
    return () => { dead = true; stream.current?.getTracks().forEach((t) => t.stop()) }
  }, [])

  const shoot = async () => {
    if (busy || !vid.current?.videoWidth) return
    setBusy(true); navigator.vibrate?.(30)
    const blob = await snap(vid.current, loc, label)
    stream.current?.getTracks().forEach((t) => t.stop())
    onShot(blob)
  }

  // fallback: system camera. Stamp it the same way.
  const fromFile = (e) => {
    const f = e.target.files?.[0]; if (!f) return
    const img = new Image()
    img.onload = async () => {
      const v = { videoWidth: img.naturalWidth, videoHeight: img.naturalHeight }
      const c = Object.assign(document.createElement('canvas'), { width: v.videoWidth, height: v.videoHeight })
      c.getContext('2d').drawImage(img, 0, 0)
      const blob = await snap(Object.assign(c, v), loc, label)
      onShot(blob)
    }
    img.src = URL.createObjectURL(f)
  }

  return createPortal(
    <div className="cam" role="dialog" aria-label="Take visit photo">
      <div className="cam-top">
        <button type="button" onClick={onClose} aria-label="Close camera"><Icon name="x" /></button>
        <span>📍 {loc ? `GPS locked ±${Math.round(loc.acc)} m` : 'Finding location…'}</span>
      </div>
      {err ? (
        <div className="cam-err">
          <p>📷 {err}</p>
          <button type="button" className="btn3d lime" onClick={() => fb.current?.click()}>Open phone camera</button>
          <input ref={fb} type="file" accept="image/*" capture="environment" hidden onChange={fromFile} />
        </div>
      ) : (
        <>
          <video ref={vid} playsInline muted autoPlay className="cam-v" />
          <div className="cam-frame" />
          <div className="cam-bar">
            <small>Take the photo at the shop: board, counter or the owner</small>
            <button type="button" className="cam-shot" disabled={!ready || busy} onClick={shoot} aria-label="Take photo"><i /></button>
          </div>
        </>
      )}
    </div>,
    document.body
  )
}
