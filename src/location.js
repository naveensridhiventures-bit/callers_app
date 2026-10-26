import { areaInfo } from './chennai'
import { coordsFromLink, hotelPoint, km, nowISO } from './utils'

/**
 * Everything about adding / updating a hotel's exact location, shared by the field app and HR admin.
 *  - parsePin      "13.0418, 80.2341" or any Google Maps link  ->  { lat, lng }
 *  - searchPlaces  OpenStreetMap search (free, no key)
 *  - bestFix       a GPS reading that keeps improving for a few seconds and returns the most accurate one
 *  - locFields     the fields written to a hotel when somebody pins it (who, when, how, accuracy, old pin)
 */

export const CHENNAI = { lat: 13.0827, lng: 80.2707 }
export const inChennai = (p) => !!p && km(CHENNAI, p) <= 60

export function parsePin(text) {
  const t = String(text || '').trim()
  if (!t) return null
  const m = t.match(/^\(?\s*(-?\d{1,2}\.\d+)\s*[,;\s]\s*(-?\d{1,3}\.\d+)\s*\)?$/)
  if (m) return { lat: Number(m[1]), lng: Number(m[2]) }
  let dec = t
  try { dec = decodeURIComponent(t) } catch { /* keep raw */ }
  return coordsFromLink(t) || coordsFromLink(dec)
}

export const isShortLink = (t) => /(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)\/\S{4,}/i.test(String(t))

export const gSearchUrl = (l) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([l.name, l.address, l.area, 'Chennai'].filter(Boolean).join(', '))}`
export const embedAt = (p, z = 17) => `https://maps.google.com/maps?q=${p.lat},${p.lng}&z=${z}&output=embed`

/* ---------- how a pin was added ---------- */
export const LOC_SRC = {
  gps: { icon: '📡', label: 'GPS at the hotel' },
  visit: { icon: '✅', label: 'Saved during a visit' },
  search: { icon: '🔎', label: 'Found online' },
  link: { icon: '🔗', label: 'Google Maps link' },
  admin: { icon: '🛡️', label: 'Admin' },
}
export const srcOf = (l) => LOC_SRC[l.locSource] || null

/** the fields that go onto a hotel when it is pinned. `prev` lets HR undo a wrong update. */
export function locFields(session, lead, p, source = 'link', acc = 0) {
  const lat = Number(p.lat).toFixed(6), lng = Number(p.lng).toFixed(6)
  const byAdmin = session?.role === 'admin'
  const old = hotelPoint(lead)
  return {
    lat, lng,
    mapUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    locSource: source,
    locBy: byAdmin ? 'Admin' : session?.name || '',
    locById: byAdmin ? 'admin' : session?.id || '',
    locAt: nowISO(),
    locAcc: acc ? String(Math.round(acc)) : '',
    locPrev: old ? `${old.lat.toFixed(6)},${old.lng.toFixed(6)}` : '',
    locReview: byAdmin ? '' : 'new', // 'new' = a field person changed it and HR has not looked yet
  }
}

/** wipe the pin (and who-did-it) from a hotel */
export const clearLoc = () => ({ lat: '', lng: '', mapUrl: '', locSource: '', locBy: '', locById: '', locAt: '', locAcc: '', locPrev: '', locReview: '' })

/** the pin before the last update, if there was one */
export function prevPin(l) {
  const m = String(l.locPrev || '').match(/^(-?\d+\.\d+),(-?\d+\.\d+)$/)
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null
}

/* ---------- GPS ---------- */
export const accLabel = (acc) => (acc <= 20 ? { id: 'great', t: 'Excellent', c: '#15803d' } : acc <= 50 ? { id: 'good', t: 'Good', c: '#65a30d' } : acc <= 100 ? { id: 'fair', t: 'Fair', c: '#d97706' } : { id: 'weak', t: 'Weak', c: '#dc2626' })

/**
 * Listens to the GPS for a few seconds and resolves with the most accurate reading.
 * Stops early once the reading is good (<= `good` metres). onUpdate fires with every better reading.
 * Rejects with { code, message }: 1 = permission off, 0 = no GPS, 3 = no signal.
 */
export function bestFix({ ms = 10000, good = 15, onUpdate } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject({ code: 0, message: 'This phone has no GPS. Use “Find online” instead.' })
    let best = null, done = false, id = null, t = null
    const stop = () => { done = true; if (id != null) navigator.geolocation.clearWatch(id); clearTimeout(t) }
    const finish = () => {
      if (done) return
      stop()
      best ? resolve(best) : reject({ code: 3, message: 'No GPS signal yet. Step outside, wait a few seconds and try again.' })
    }
    id = navigator.geolocation.watchPosition(
      (p) => {
        const c = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy || 999, at: Date.now() }
        if (!best || c.acc < best.acc) { best = c; onUpdate?.(best) }
        if (c.acc <= good) finish()
      },
      (e) => {
        if (done) return
        if (e.code === 1) { stop(); reject({ code: 1, message: 'Location is switched off for this app. Allow location in the browser settings, then try again.' }) }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: ms }
    )
    t = setTimeout(finish, ms)
  })
}

/* ---------- OpenStreetMap search ---------- */
const NOM = 'https://nominatim.openstreetmap.org/search'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Find a place by text inside Chennai. Results are ranked by distance from `near` (your GPS) if given,
 * otherwise from the centre of the hotel's area.
 */
export async function searchPlaces(queries, { area, near } = {}) {
  const base = { format: 'jsonv2', countrycodes: 'in', limit: '6', viewbox: '79.95,13.35,80.45,12.70', bounded: '1' }
  const centre = near || areaInfo(area)
  for (const q of [].concat(queries).filter(Boolean)) {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 9000)
    try {
      const r = await fetch(`${NOM}?${new URLSearchParams({ ...base, q })}`, { headers: { Accept: 'application/json' }, signal: ctl.signal })
      if (!r.ok) throw new Error(`Search service said ${r.status}`)
      const j = await r.json()
      if (j.length) {
        return j.map((x) => {
          const p = { lat: Number(x.lat), lng: Number(x.lon) }
          return { ...p, title: x.name || String(x.display_name).split(',')[0], addr: String(x.display_name).split(',').slice(0, 4).join(','), d: centre ? km(centre, p) : null }
        }).sort((a, b) => (a.d ?? 1e9) - (b.d ?? 1e9))
      }
    } finally { clearTimeout(to) }
    await sleep(1100)
  }
  return []
}

/** the usual two-step search for a hotel record: name + area first, then name alone */
export const findHotelPlaces = (l, near) => searchPlaces([[l.name, l.area, 'Chennai'].filter(Boolean).join(', '), [l.name, 'Chennai'].join(', ')], { area: l.area, near })
