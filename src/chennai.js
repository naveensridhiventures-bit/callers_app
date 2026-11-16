import { hotelPoint, km } from './utils'

/** Field sales happen in Chennai only. */
export const FIELD_CITY = 'Chennai'

// Every Chennai locality, by zone (src/chennaiAreas.txt). Centres are approximate: they sort and map
// distributors / hotels that have no exact pin yet. To add a missing area just add a line to that file.
import RAW_AREAS from './chennaiAreas.txt?raw'

export const ZONES = []
export const CHENNAI_AREAS = []
{
  let zone = ''
  RAW_AREAS.split(/\r?\n/).forEach((line) => {
    const t = line.trim()
    if (!t) return
    if (t.startsWith('#')) { const z = t.slice(1).trim(); if (z && !/^Chennai localities/.test(z)) { zone = z; ZONES.push(z) } return }
    const [a, lat, lng, al = ''] = t.split('|')
    CHENNAI_AREAS.push({ a, lat: Number(lat), lng: Number(lng), zone, alias: al.split('~').map((x) => x.trim()).filter(Boolean) })
  })
}

const key = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
const INDEX = new Map()
CHENNAI_AREAS.forEach((x) => { INDEX.set(key(x.a), x); x.alias.forEach((al) => INDEX.set(key(al), x)) })

/** the official spelling of a typed area ("Kialpauk" -> "Kilpauk"), or the text as typed if unknown */
export const canonArea = (label) => { const x = INDEX.get(key(label)); return x ? x.a : String(label || '').trim() }
export const zoneOf = (label) => INDEX.get(key(label))?.zone || 'Other'

/** the known Chennai locality for a typed area (exact first, then loose match) */
export function areaInfo(label) {
  const k = key(label)
  if (!k) return null
  if (INDEX.has(k)) return INDEX.get(k)
  if (k.length < 4) return null
  for (const [ak, v] of INDEX) if (ak.includes(k) || (ak.length >= 5 && k.includes(ak))) return v
  return null
}

/** where is this hotel? exact pin first (lat/lng or Google Maps link), else the centre of its locality */
export function pointOf(l) {
  const p = hotelPoint(l)
  if (p) return { ...p, approx: false }
  const a = areaInfo(l.area)
  return a ? { lat: a.lat, lng: a.lng, approx: true } : null
}

const ROAD = 1.35 // straight line to road distance in a city
const SPEED = 20 // km/h, typical Chennai traffic
export const roadKm = (straight) => straight * ROAD
export const etaMin = (straight) => Math.max(1, Math.round(((straight * ROAD) / SPEED) * 60))
export const fmtEta = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`)

const pathLen = (start, pts) => {
  let d = 0, cur = start
  for (const p of pts) { if (cur) d += km(cur, p); cur = p }
  return d
}

/**
 * Visiting order: nearest-neighbour from the person's position, then a 2-opt pass that removes
 * crossings so the walk/ride is short. Hotels without any location go last.
 * returns [{ l, pt, leg }]  (leg = km from the previous stop, or from the person for the first stop)
 */
export function planRoute(me, leads) {
  const all = leads.map((l) => ({ l, pt: pointOf(l) }))
  const placed = all.filter((x) => x.pt)
  const lost = all.filter((x) => !x.pt)
  let start = me && me.lat != null ? { lat: me.lat, lng: me.lng } : null
  if (!start && placed.length) start = [...placed].sort((a, b) => a.pt.lng - b.pt.lng)[0].pt // no GPS: begin at the western end

  const left = [...placed]
  let order = [], cur = start
  while (left.length) {
    let bi = 0, bd = Infinity
    left.forEach((x, i) => { const d = km(cur, x.pt); if (d < bd) { bd = d; bi = i } })
    const [x] = left.splice(bi, 1)
    order.push(x); cur = x.pt
  }

  // 2-opt: keep trying to reverse a stretch while it makes the whole route shorter
  if (order.length > 3 && order.length <= 60) {
    let improved = true, guard = 0
    while (improved && guard++ < 40) {
      improved = false
      for (let i = 0; i < order.length - 1; i++) {
        for (let j = i + 1; j < order.length; j++) {
          const cand = [...order.slice(0, i), ...order.slice(i, j + 1).reverse(), ...order.slice(j + 1)]
          if (pathLen(start, cand.map((x) => x.pt)) + 1e-9 < pathLen(start, order.map((x) => x.pt))) { order = cand; improved = true }
        }
      }
    }
  }

  let prev = start
  const out = order.map((x) => { const leg = prev ? km(prev, x.pt) : null; prev = x.pt; return { ...x, leg } })
  return [...out, ...lost.map((x) => ({ ...x, leg: null }))]
}
