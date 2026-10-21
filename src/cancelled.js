import { areaInfo } from './chennai'
import { cleanPhone, nowISO, uid } from './utils'

export const CANCEL_SOURCE = 'Cancelled order'

/* Every remark in the sheet is turned into one or more clear reason tags (first match = main reason). */
export const REASONS = [
  { id: 'idly', label: 'Idly hard', icon: '🍚', color: '#dc2626', bg: '#fee2e2', re: /idl[iy]\s*hard|hard\s*idl[iy]|idli.*hard/i,
    tip: 'Carry a fresh idly sample. Check their grinding, fermentation time and steaming. Let the chef taste a soft idly from today’s batch.' },
  { id: 'batter', label: 'Batter issue', icon: '🥣', color: '#ea580c', bg: '#ffedd5', re: /ba+t+e?r|wattery|watery|vada/i,
    tip: 'Ask which batter (idly, dosa or vada) and what exactly was wrong. Offer a replacement sample and note the batch.' },
  { id: 'payment', label: 'Payment issue', icon: '💳', color: '#7c3aed', bg: '#ede9fe', re: /payment|credit/i,
    tip: 'Settle the pending amount first. Agree a clear credit period (weekly or monthly) and note it in the remark.' },
  { id: 'late', label: 'Late delivery', icon: '🚚', color: '#0284c7', bg: '#e0f2fe', re: /late|delay|one way|sunday|change buyer/i,
    tip: 'Fix a delivery time with them (for example before 6 AM) and confirm the route and driver. Promise only what you can keep.' },
  { id: 'own', label: 'Own preparation', icon: '👨‍🍳', color: '#0d9488', bg: '#ccfbf1', re: /own\s*pre|own\s*batter/i,
    tip: 'They make batter in-house. Pitch the saving in time, labour and gas, and offer a trial pack for rush days.' },
  { id: 'closed', label: 'Closed / shut', icon: '🏚️', color: '#475569', bg: '#e2e8f0', re: /closed|renovation|out of station|cylinder|shut/i,
    tip: 'Confirm whether it reopened. If it is renovation or a temporary break, ask the reopening date and set a follow-up.' },
  { id: 'distance', label: 'Distance / not served', icon: '📍', color: '#b45309', bg: '#fef3c7', re: /distance|long|not supply/i,
    tip: 'Check if this area can now be covered by a nearby route. If yes, offer a minimum-order slot on a fixed day.' },
  { id: 'occasional', label: 'Occasional / low demand', icon: '📉', color: '#a16207', bg: '#fef9c3', re: /occasion|no sales|party|no need|low/i,
    tip: 'Offer small packs and a fixed weekly slot. Let them know they can reorder by WhatsApp on busy days.' },
  { id: 'packing', label: 'Packing / weight', icon: '⚖️', color: '#be185d', bg: '#fce7f3', re: /packing|weight/i,
    tip: 'Weigh a pack in front of them. Replace any short or leaking pack and fix the packing with the plant.' },
  { id: 'sample', label: 'Sample asked', icon: '🧪', color: '#16a34a', bg: '#dcfce7', re: /sample/i,
    tip: 'Hot lead: they asked for a sample. Take a fresh pack, let the chef try it, and ask for the first order on the spot.' },
  { id: 'noreply', label: 'No reply', icon: '📵', color: '#64748b', bg: '#f1f5f9', re: /no\s*re+pl/i,
    tip: 'Visit in person at a quiet hour (after lunch). Ask for the owner or manager and leave a card.' },
  { id: 'none', label: 'No reason noted', icon: '❓', color: '#64748b', bg: '#f1f5f9', re: null,
    tip: 'Nobody noted why they stopped. Ask politely, listen, and write their exact reason in the remark.' },
  { id: 'other', label: 'Other', icon: '✏️', color: '#64748b', bg: '#f1f5f9', re: null,
    tip: 'Read the remark carefully and ask what would bring them back.' },
]
export const REASON = Object.fromEntries(REASONS.map((r) => [r.id, r]))

/** all reason tags for a remark text, main reason first */
export function reasonsOf(text) {
  const t = String(text || '').trim()
  if (!t) return ['none']
  const hit = REASONS.filter((r) => r.re && r.re.test(t)).map((r) => r.id)
  // "idly hard" already says it is a batter problem, so do not repeat as a second tag
  const out = hit.includes('idly') ? hit.filter((x) => x !== 'batter') : hit
  return out.length ? out : ['other']
}
export const mainReason = (l) => reasonsOf(l.stopReason)[0]

/* KG bands used by the filter */
export const KG_BANDS = [
  { id: 'none', label: 'No KG', test: (k) => !k },
  { id: 's', label: 'Up to 5 kg', test: (k) => k > 0 && k <= 5 },
  { id: 'm', label: '10 kg', test: (k) => k > 5 && k <= 10 },
  { id: 'l', label: '15 to 25 kg', test: (k) => k > 10 && k <= 25 },
  { id: 'xl', label: '30 kg and above', test: (k) => k > 25 },
]
export const kgOf = (l) => {
  const n = parseFloat(String(l.monthlyQty || '').replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : 0
}
export const kgBandOf = (l) => KG_BANDS.find((b) => b.test(kgOf(l)))?.id || 'none'
export const isCancelled = (l) => l.type === 'hotel' && l.source === CANCEL_SOURCE

/* ---------------------------- Excel reader ---------------------------- */
const cellText = (v) => {
  if (v == null) return ''
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((x) => x.text).join('')
    if (v.text != null) return String(v.text)
    if (v.result != null) return String(v.result)
    if (v instanceof Date) return v.toISOString().slice(0, 10)
    return ''
  }
  return String(v)
}
const tidy = (s) => String(s || '').replace(/\s+/g, ' ').trim()
const isPhone = (s) => /^\d{10,12}$/.test(String(s).replace(/\D/g, '')) && String(s).replace(/\D/g, '').length >= 10
const titleCase = (s) => tidy(s).toLowerCase().replace(/(^|[\s(\/-])([a-z])/g, (_, a, b) => a + b.toUpperCase())
export const niceName = (s) => {
  const t = tidy(s)
  return t === t.toUpperCase() || t === t.toLowerCase() ? titleCase(t) : t
}
export const niceArea = (s) => {
  const t = tidy(s)
  if (!t) return ''
  return areaInfo(t)?.a || titleCase(t)
}

const HEAD = {
  name: ['customer name', 'hotel name', 'hotel', 'name', 'customer', 'restaurant'],
  area: ['location', 'area', 'locality'],
  phone: ['mobile number', 'mobile', 'contact', 'phone', 'contact number', 'number'],
  kg: ['kg', 'qty', 'quantity'],
  remark: ['remark', 'remarks', 'reason'],
}

/** one worksheet -> rows. Works with a header row and also with sheets that have no header. */
function readSheet(ws) {
  const grid = []
  ws.eachRow({ includeEmpty: false }, (row) => {
    const arr = []
    row.eachCell({ includeEmpty: true }, (c, i) => { arr[i - 1] = cellText(c.value) })
    grid.push(arr)
  })
  let hi = grid.findIndex((r) => r.some((c) => HEAD.name.includes(tidy(c).toLowerCase())) && r.some((c) => HEAD.phone.includes(tidy(c).toLowerCase())))
  const out = []
  if (hi >= 0) {
    const head = grid[hi].map((c) => tidy(c).toLowerCase())
    const at = {}
    Object.entries(HEAD).forEach(([k, names]) => { const i = head.findIndex((h) => names.includes(h)); if (i >= 0) at[k] = i })
    grid.slice(hi + 1).forEach((r) => {
      const g = (k) => (at[k] != null ? tidy(r[at[k]]) : '')
      out.push({ name: g('name'), area: g('area'), phone: g('phone'), kg: g('kg'), remark: g('remark'), extra: '' })
    })
  } else {
    // no header: name, area, phone, kg, then extra columns (pay mode, how often, "Cancel") and the last one is the remark
    grid.forEach((r) => {
      if (!isPhone(r[2])) return
      const rest = r.slice(4).map(tidy).filter(Boolean)
      const remark = rest.filter((x) => !/^cancel$/i.test(x) && !/^(cash|cssh|credit|daily|weekly|weeklly|monthly)$/i.test(x)).join(' / ')
      const extra = rest.filter((x) => /^(cash|cssh|credit|daily|weekly|weeklly|monthly)$/i.test(x)).map((x) => (/^cssh$/i.test(x) ? 'Cash' : /^weeklly$/i.test(x) ? 'Weekly' : titleCase(x))).join(' · ')
      out.push({ name: tidy(r[0]), area: tidy(r[1]), phone: tidy(r[2]), kg: tidy(r[3]), remark, extra })
    })
  }
  return out
}

/** Excel file bytes -> hotel leads (cancelled-order list). Duplicates (same mobile) are merged. */
export async function parseCancelledWorkbook(buffer) {
  const mod = await import('exceljs')
  const wb = new (mod.Workbook || mod.default.Workbook)()
  await wb.xlsx.load(buffer)
  const seen = new Map()
  let rows = 0
  wb.worksheets.forEach((ws) => {
    readSheet(ws).forEach((r) => {
      if (!r.name) return
      rows++
      const phone = isPhone(r.phone) ? cleanPhone(r.phone) : ''
      const key = phone || `${r.name.toLowerCase()}|${r.area.toLowerCase()}`
      const remark = tidy(r.remark)
      const kgN = parseFloat(String(r.kg).replace(/[^\d.]/g, ''))
      const prev = seen.get(key)
      if (prev) {
        // same mobile again (the same hotel appears on several sheets): keep the first, add anything new
        if (remark && !prev.stopReason.toLowerCase().includes(remark.toLowerCase())) prev.stopReason = [prev.stopReason, remark].filter(Boolean).join(' / ')
        if (!prev.monthlyQty && Number.isFinite(kgN)) prev.monthlyQty = String(kgN)
        if (!prev.area && r.area) prev.area = niceArea(r.area)
        if (r.extra && !prev.notes.includes(r.extra)) prev.notes = [prev.notes, r.extra].filter(Boolean).join(' · ')
        return
      }
      const now = nowISO()
      seen.set(key, {
        id: uid(), type: 'hotel', name: niceName(r.name), phone, contactName: '', area: niceArea(r.area), address: '', mapUrl: '', lat: '', lng: '', lastOrderOn: '',
        stopReason: remark, monthlyQty: Number.isFinite(kgN) ? String(kgN) : '', notes: r.extra ? `Payment / order cycle: ${r.extra}` : '',
        source: CANCEL_SOURCE, city: 'Chennai', status: 'New', priority: 'Warm', calls: [], callCount: 0, nextFollowUp: '', createdAt: now, updatedAt: now,
      })
    })
  })
  const leads = [...seen.values()]
  return { leads, rows, merged: rows - leads.length }
}
