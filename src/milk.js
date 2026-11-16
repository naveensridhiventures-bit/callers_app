import { MILK_SEED } from './milkSeed'
import { CHENNAI_AREAS, ZONES, canonArea, zoneOf } from './chennai'
import { CLOSED } from './constants'
import { FS, fieldStatusOf } from './fieldStatus'
import { atDay, bucket, nowISO } from './utils'

/**
 * Chennai milk distributors visited by the field sales person.
 *   type 'milk'   source 'Admin list'  = loaded / updated by the admin
 *                 source 'Own source'  = found and added by the field person
 * Stored in the same Sheet columns as every other lead (no script change):
 *   company = milk brands · dailyQty = litres per day · contactName = owner · vehicle / coldStorage = Yes | No
 */
export const isMilk = (l) => l?.type === 'milk'
export const isFieldLead = (l) => l?.type === 'hotel' || l?.type === 'milk'
export const SRC_ADMIN = 'Admin list'
export const SRC_OWN = 'Own source'
export const isOwn = (l) => l?.source === SRC_OWN
export const brandsOf = (l) => String(l?.company || '').split(',').map((s) => s.trim()).filter(Boolean)
export const joinBrands = (arr) => [...new Set(arr.map((s) => s.trim()).filter(Boolean))].join(', ')

export const BRANDS = ['Idli / dosa batter', 'iD Fresh', 'Aavin', 'Thirumala', 'Heritage', 'Hatsun', 'Arokiya', 'Amul', 'Mother Dairy', 'Dodla', 'Milky Mist', 'Nandini', 'Ponvandu', 'Curd', 'Ice cream']

/** what happened on the visit. `need` = a follow-up date is required, `none` = no follow-up (deal closed / lost) */
export const MILK_OUTCOMES = [
  { id: 'Met Owner', icon: '🤝', t: 'Met the owner', s: 'Pitched our batter' },
  { id: 'Interested', icon: '🔥', t: 'Interested', s: 'Wants to sell our batter' },
  { id: 'Meeting Fixed', icon: '📅', t: 'Meeting fixed', s: 'Date agreed', need: true },
  { id: 'Call Back Later', icon: '⏰', t: 'Come back later', s: 'Busy / asked to return', need: true },
  { id: 'Owner Not Available', icon: '🚪', t: 'Owner not there', s: 'Visit again', need: true },
  { id: 'Shop Closed', icon: '🔒', t: 'Shop closed', s: 'Visit again', need: true },
  { id: 'Onboarded', icon: '🎉', t: 'Distributor fixed', s: 'Will sell our batter', none: true },
  { id: 'Not Interested', icon: '👎', t: 'Not interested', s: 'Said no', none: true },
]
export const OUT = Object.fromEntries(MILK_OUTCOMES.map((o) => [o.id, o]))

export const MILK_REMARKS = [
  'Wants margin on batter', 'Has fridge for batter', 'Has own vehicle', 'Already sells another batter', 'Needs price list',
  'Wants a sample first', 'Will discuss with partner', 'Asked to come in the morning', 'Send details on WhatsApp', 'Good shop, good footfall',
]

/** a ready lead built from one Excel row. visited = date of the earlier visit, follow-up is due today. */
export function seedToLead(r, field) {
  const ts = nowISO()
  const at = new Date(`${r.visited}T12:00:00+05:30`).toISOString()
  const call = { id: `seed-${r.phone}`, at, outcome: 'Visited', remark: [r.brands && `Brands: ${r.brands}`, r.notes].filter(Boolean).join('. '), next: '', by: 'Admin list', duration: 0, mode: 'visit' }
  return {
    id: r.key, type: 'milk', name: r.name, phone: r.phone, area: r.area, city: 'Chennai',
    company: r.brands || '', notes: r.notes || '', bizType: 'Milk Distributor', source: SRC_ADMIN,
    status: 'Contacted', priority: 'Warm',
    lat: String(r.lat), lng: String(r.lng), mapUrl: `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`,
    locSource: 'admin', locBy: 'Admin', locAt: ts, locReview: 'ok',
    calls: [call], callCount: 1, lastCall: at, lastOutcome: 'Visited', lastRemark: call.remark,
    nextFollowUp: atDay(0, 10), createdAt: ts, updatedAt: ts,
    ...(field ? { fieldId: field.id, fieldName: field.name, fieldAt: ts } : {}),
  }
}
export const seedLeads = (field) => MILK_SEED.map((r) => seedToLead(r, field))

/** rows from a pasted / uploaded table (CSV text) -> milk leads. Needs a Name or Phone column. */
const HEAD = {
  name: ['name', 'distributor', 'customer', 'distributor name', 'customer / distributor name', 'agency', 'shop'],
  phone: ['phone', 'phone number', 'mobile', 'contact', 'contact no', 'number'],
  area: ['area', 'locality', 'location'], brands: ['brand', 'brands', 'milk brand', 'milk brand / details', 'details', 'milk'],
  owner: ['owner', 'contact person', 'person'], address: ['address'], map: ['map link', 'map', 'location link', 'google map'],
  notes: ['notes', 'remark', 'remarks'], visit: ['visit date', 'visited', 'date'],
}
export function rowsToMilk(rows, field) {
  if (!rows.length) return []
  const head = rows[0].map((h) => String(h || '').trim().toLowerCase())
  const col = {}
  Object.entries(HEAD).forEach(([k, names]) => { col[k] = head.findIndex((h) => names.includes(h)) })
  if (col.name < 0 && col.phone < 0) return []
  const out = []
  rows.slice(1).forEach((r) => {
    const g = (k) => (col[k] >= 0 ? String(r[col[k]] ?? '').trim() : '')
    const phone = g('phone').replace(/\D/g, '').slice(-10)
    const name = g('name')
    if (!name && !phone) return
    const m = g('map').match(/(-?\d{1,2}\.\d+)\s*(?:,|%2C)\s*(-?\d{1,3}\.\d+)/)
    const dm = g('visit').match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
    const visited = dm ? `${dm[3]}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}` : new Date().toISOString().slice(0, 10)
    const lines = g('brands').split('\n').map((x) => x.trim()).filter(Boolean)
    const l = seedToLead({
      key: phone ? `milk-${phone}` : `milk-${Math.random().toString(36).slice(2, 9)}`, name: name || phone, phone, area: canonArea(g('area')),
      brands: lines[0] ? lines[0].split(/\s+and\s+|,/i).map((x) => x.trim()).filter(Boolean).map((x) => x[0].toUpperCase() + x.slice(1)).join(', ') : '',
      notes: [lines.slice(1).join(' '), g('notes')].filter(Boolean).join('. '), lat: m ? m[1] : '', lng: m ? m[2] : '', visited,
    }, field)
    if (!m) Object.assign(l, { lat: '', lng: '', mapUrl: '', locSource: '', locBy: '', locAt: '', locReview: '' })
    if (g('owner')) l.contactName = g('owner')
    if (g('address')) l.address = g('address')
    out.push(l)
  })
  return out
}

/* ---------- area roll-up (what the Areas screen shows) ---------- */
const sameDay = (iso) => !!iso && new Date(iso).toDateString() === new Date().toDateString()
export const visitedToday = (l, session) => (l.calls || []).some((c) => c.mode === 'visit' && c.outcome !== 'Checked In' && sameDay(c.at) && (!session?.name || !c.by || c.by === session.name))

/**
 * One tile per Chennai area (all of them, even with no distributor yet), plus any other area a distributor was added in.
 * state: none (no distributor) | todo (not started) | going (some done) | done (all visited / closed)
 */
export function areaBoard(leads, session) {
  const m = new Map()
  CHENNAI_AREAS.forEach((a) => m.set(a.a, { area: a.a, zone: a.zone, list: [] }))
  leads.filter(isMilk).forEach((l) => {
    const name = canonArea(l.area) || 'No area'
    if (!m.has(name)) m.set(name, { area: name, zone: zoneOf(name) === 'Other' ? 'Other areas' : zoneOf(name), list: [] })
    m.get(name).list.push(l)
  })
  return [...m.values()].map((o) => {
    const st = o.list.map((l) => fieldStatusOf(l).id)
    const n = o.list.length
    const done = st.filter((s) => s === 'visited' || s === 'notint').length
    const follow = o.list.filter((l) => ['overdue', 'today'].includes(bucket(l))).length
    return {
      ...o, n, done, follow,
      admin: o.list.filter((l) => !isOwn(l)).length, own: o.list.filter(isOwn).length,
      today: o.list.filter((l) => visitedToday(l, session)).length,
      pct: n ? Math.round((done / n) * 100) : 0,
      state: !n ? 'none' : done === n ? 'done' : done > 0 || o.list.some((l) => visitedToday(l, session)) ? 'going' : 'todo',
    }
  })
}
export const ZONE_LIST = [...ZONES, 'Other areas']
export { FS }
