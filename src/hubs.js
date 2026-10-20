import { HUBS } from './hubData'

const norm = (s) => String(s || '').toLowerCase().replace(/\(part \d+\)/g, '').replace(/[^a-z0-9]/g, '')
const ALIAS = { krpuram: 'krpura', jpnagar: 'jpnagar', rtnagar: 'rtnagar', btmlayout: 'btmlayout' }
// assembly-constituency fallbacks: "BTM Layout" -> the wards of B.T.M Layout etc.
const AC_KEY = (s) => norm(s)

export const CORP_COLORS = { North: '#0ea5e9', South: '#16a34a', East: '#f59e0b', West: '#8b5cf6', Central: '#ef4444' }

const wardIndex = [] // {key, hub, ward}
const acIndex = new Map() // acKey -> Map(hub -> count)
HUBS.forEach((h) => {
  h.corp = (() => {
    const c = {}; h.areas.forEach((a) => { c[a.c] = (c[a.c] || 0) + 1 })
    return Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]
  })()
  h.areas.forEach((a) => {
    wardIndex.push({ key: norm(a.a), hub: h.n, ward: a.a })
    const k = AC_KEY(a.ac)
    if (!acIndex.has(k)) acIndex.set(k, new Map())
    const m = acIndex.get(k); m.set(h.n, (m.get(h.n) || 0) + 1)
  })
})

/** hubs a lead's area belongs to: [{hub, via}] best first, [] when the area is not covered */
export function hubsForArea(text) {
  let k = norm(text)
  if (!k || k.length < 4) return []
  k = ALIAS[k] || k
  const hits = wardIndex.filter((w) => w.key === k)
  const loose = hits.length ? hits : wardIndex.filter((w) => k.length >= 5 && (w.key.includes(k) || (w.key.length >= 5 && k.includes(w.key))))
  if (loose.length) {
    const seen = new Map()
    loose.forEach((w) => { if (!seen.has(w.hub)) seen.set(w.hub, w.ward) })
    return [...seen].map(([hub, via]) => ({ hub, via }))
  }
  for (const [ak, m] of acIndex) {
    if (ak === k || (k.length >= 6 && (ak.includes(k) || k.includes(ak)))) {
      return [...m].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([hub]) => ({ hub, via: 'constituency' }))
    }
  }
  return []
}

/** every selling area of the plan, for the picker */
export const AREA_OPTIONS = HUBS.flatMap((h) => h.areas.map((a) => ({ label: a.a, hub: h.n, near: h.near.replace(/^near /, ''), corp: h.corp, key: norm(a.a), full: String(a.a).toLowerCase().replace(/[^a-z0-9]/g, '') })))
  .sort((a, b) => a.label.localeCompare(b.label))
export const hubOfArea = (label) => AREA_OPTIONS.find((o) => o.full === String(label || '').toLowerCase().replace(/[^a-z0-9]/g, ''))

/** which areas of a hub already have a distributor: Map(areaName -> count) */
export function coverage(h, items) {
  const m = new Map(h.areas.map((a) => [a.a, 0]))
  items.forEach(({ lead }) => {
    const full = String(lead.area || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const base = norm(lead.area)
    let hit = h.areas.find((a) => String(a.a).toLowerCase().replace(/[^a-z0-9]/g, '') === full)
    if (!hit) hit = h.areas.find((a) => norm(a.a) === base) || h.areas.find((a) => base.length >= 5 && (norm(a.a).includes(base) || base.includes(norm(a.a))))
    if (hit) m.set(hit.a, m.get(hit.a) + 1)
  })
  return m
}

export function mapLeadsToHubs(leads) {
  const byHub = new Map(HUBS.map((h) => [h.n, []]))
  const unmapped = []
  leads.filter((l) => l.type !== 'number').forEach((l) => {
    const picked = Number(l.hub)
    const hs = picked && byHub.has(picked) ? [{ hub: picked, via: 'picked' }] : hubsForArea(l.area)
    if (!hs.length) unmapped.push(l)
    else byHub.get(hs[0].hub).push({ lead: l, via: hs[0].via, also: hs.slice(1).map((x) => x.hub) })
  })
  return { byHub, unmapped }
}

export const mapLink = (h) => `https://www.google.com/maps?q=${h.lat},${h.lng}`
export { HUBS }
