import { CLOUDINARY } from './constants'

/**
 * Visit photos.  The photo is taken on the spot with the phone camera (CameraCapture), uploaded to Cloudinary,
 * and only the picture LINK is saved with the visit (so the Google Sheet stays small).
 * No signal, or Cloudinary not set up yet?  The photo waits in IndexedDB on the phone and uploads later by itself.
 */
export const cloudReady = () => !!(CLOUDINARY.cloudName && CLOUDINARY.uploadPreset)

export async function uploadPhoto(blob, name = 'visit') {
  if (!cloudReady()) throw new Error('Cloudinary is not set up yet')
  const fd = new FormData()
  fd.append('file', blob, `${name}.jpg`)
  fd.append('upload_preset', CLOUDINARY.uploadPreset)
  if (CLOUDINARY.folder) fd.append('folder', CLOUDINARY.folder)
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 45000)
  try {
    const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/image/upload`, { method: 'POST', body: fd, signal: ctl.signal })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || !j.secure_url) throw new Error(j?.error?.message || 'Upload failed')
    return j.secure_url
  } finally { clearTimeout(t) }
}

/** small thumbnail link for lists (Cloudinary resizes on the fly) */
export const thumbUrl = (u, w = 240) => (/res\.cloudinary\.com/.test(u || '') ? u.replace('/upload/', `/upload/c_fill,w_${w},h_${w},q_auto,f_auto/`) : u)

/* ---------- offline queue (IndexedDB) ---------- */
const DB = 'sridhi-photos', ST = 'q'
const open = () => new Promise((res, rej) => {
  if (!window.indexedDB) return rej(new Error('no idb'))
  const r = indexedDB.open(DB, 1)
  r.onupgradeneeded = () => r.result.createObjectStore(ST, { keyPath: 'id' })
  r.onsuccess = () => res(r.result)
  r.onerror = () => rej(r.error)
})
const tx = async (mode, fn) => {
  const db = await open()
  return new Promise((res, rej) => {
    const t = db.transaction(ST, mode); const out = fn(t.objectStore(ST))
    t.oncomplete = () => res(out.result); t.onerror = () => rej(t.error)
  })
}
export const queuePhoto = (item) => tx('readwrite', (s) => s.put(item)).catch(() => null)
export const queuedPhotos = () => tx('readonly', (s) => s.getAll()).then((x) => x || []).catch(() => [])
export const dropPhoto = (id) => tx('readwrite', (s) => s.delete(id)).catch(() => null)
