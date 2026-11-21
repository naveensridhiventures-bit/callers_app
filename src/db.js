// Photos are stored in IndexedDB (localStorage is too small for images).
const DB = 'batterstock-photos'
const ST = 'photos'
const cache = new Map()

function open() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(ST)
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}
const tx = async (mode, fn) => {
  const db = await open()
  return new Promise((res, rej) => {
    const t = db.transaction(ST, mode)
    const out = fn(t.objectStore(ST))
    t.oncomplete = () => res(out && 'result' in out ? out.result : undefined)
    t.onerror = () => rej(t.error)
  })
}

export async function putPhoto(id, data) {
  cache.set(id, data)
  await tx('readwrite', (s) => s.put(data, id))
}
export async function getPhoto(id) {
  if (cache.has(id)) return cache.get(id)
  const v = await tx('readonly', (s) => s.get(id))
  if (v) cache.set(id, v)
  return v
}
export async function delPhoto(id) {
  cache.delete(id)
  await tx('readwrite', (s) => s.delete(id))
}
export async function allPhotos() {
  const db = await open()
  return new Promise((res, rej) => {
    const out = {}
    const t = db.transaction(ST, 'readonly')
    const c = t.objectStore(ST).openCursor()
    c.onsuccess = () => {
      const cur = c.result
      if (cur) { out[cur.key] = cur.value; cur.continue() } else res(out)
    }
    c.onerror = () => rej(c.error)
  })
}
export async function restorePhotos(obj) {
  for (const [k, v] of Object.entries(obj || {})) await putPhoto(k, v)
}
export async function clearPhotos() {
  cache.clear()
  await tx('readwrite', (s) => s.clear())
}

// Shrink the camera photo and stamp date / time / user on it as proof.
export function compressPhoto(file, stamp) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const max = 1100
      const sc = Math.min(1, max / Math.max(img.width, img.height))
      const w = Math.round(img.width * sc)
      const h = Math.round(img.height * sc)
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      const g = c.getContext('2d')
      g.drawImage(img, 0, 0, w, h)
      if (stamp) {
        const fs = Math.max(14, Math.round(w / 32))
        g.fillStyle = 'rgba(0,0,0,.55)'
        g.fillRect(0, h - fs * 1.9, w, fs * 1.9)
        g.fillStyle = '#fff'
        g.font = `600 ${fs}px system-ui, sans-serif`
        g.textBaseline = 'middle'
        g.fillText(stamp, fs * 0.6, h - fs * 0.95)
      }
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', 0.72))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read photo')) }
    img.src = url
  })
}
