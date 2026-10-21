import { fmtDateTime, fmtDay } from './reports'
import { nameOf } from './utils'

export { RANGES, rangeFor, toInputDate } from './reports'

const SKIP = ['Checked In', 'Details Updated', 'Lead Added'] // automatic entries are not visits or calls
const GOOD = ['Order Restarted', 'Will Order Soon', 'Interested', 'Meeting Fixed', 'Onboarded']
const sod = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const eod = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x }
const avg = (a) => (a.length ? Math.round((a.reduce((n, x) => n + x, 0) / a.length) * 10) / 10 : 0)
export const NO_AREA = '(no area)'
export const areaOfLead = (l) => (l.area || '').trim() || NO_AREA

/** every visit and call this field person logged inside the range */
export function fieldEntries(leads, session, range) {
  const out = []
  leads.forEach((l) => (l.calls || []).forEach((c) => {
    if (SKIP.includes(c.outcome)) return
    if (c.by && session?.name && c.by !== session.name) return
    const t = new Date(c.at)
    if (t < range.from || t > range.to) return
    out.push({
      at: c.at, mode: c.mode === 'visit' ? 'visit' : 'call', lead: l, name: nameOf(l), phone: l.phone || '',
      area: areaOfLead(l), address: l.address || '', outcome: c.outcome, rating: Number(c.rating) || 0,
      remark: c.remark || '', next: c.next || '', duration: c.duration || 0,
    })
  }))
  return out.sort((a, b) => a.at.localeCompare(b.at))
}

/** the numbers behind the Today screen and the downloadable report */
export function buildFieldReport({ leads, session, range, area = 'all', mode = 'all' }) {
  const inArea = (name) => area === 'all' || name === area
  const entries = fieldEntries(leads, session, range).filter((e) => inArea(e.area) && (mode === 'all' || e.mode === mode))
  const visits = entries.filter((e) => e.mode === 'visit')
  const calls = entries.filter((e) => e.mode === 'call')
  const rated = entries.filter((e) => e.rating > 0)
  const good = entries.filter((e) => e.rating >= 4 || GOOD.includes(e.outcome))

  const m = new Map()
  entries.forEach((e) => {
    if (!m.has(e.area)) m.set(e.area, { area: e.area, visits: 0, calls: 0, hotels: new Set(), ratings: [], hot: 0, orders: 0 })
    const r = m.get(e.area)
    if (e.mode === 'visit') r.visits++; else r.calls++
    r.hotels.add(e.lead.id)
    if (e.rating) r.ratings.push(e.rating)
    if (e.rating >= 4) r.hot++
    if (e.outcome === 'Order Restarted') r.orders++
  })
  const byArea = [...m.values()].map((r) => ({ area: r.area, visits: r.visits, calls: r.calls, hotels: r.hotels.size, avg: avg(r.ratings), hot: r.hot, orders: r.orders }))
    .sort((a, b) => b.visits + b.calls - (a.visits + a.calls))

  const next = new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate() + 1)
  const open = (l) => l.nextFollowUp && !['Onboarded', 'Not Interested', 'Reactivated'].includes(l.status)
  const followups = leads.filter((l) => open(l) && inArea(areaOfLead(l)) && new Date(l.nextFollowUp) >= sod(next) && new Date(l.nextFollowUp) <= eod(next))
    .sort((a, b) => a.nextFollowUp.localeCompare(b.nextFollowUp))
  const overdue = leads.filter((l) => open(l) && inArea(areaOfLead(l)) && new Date(l.nextFollowUp) < sod(new Date())).length

  return {
    meta: {
      title: 'Field Sales Report', city: 'Chennai', rangeLabel: range.label, single: range.single, from: range.from, to: range.to, nextDay: next,
      scopeLabel: session?.name || 'Field person', areaLabel: area === 'all' ? 'All areas' : area, generatedAt: new Date(),
    },
    totals: {
      visits: visits.length, calls: calls.length, hotels: new Set(entries.map((e) => e.lead.id)).size,
      areas: byArea.length, avgRating: avg(rated.map((e) => e.rating)), rated: rated.length, hot: good.length,
      orders: entries.filter((e) => e.outcome === 'Order Restarted').length, followups: followups.length, overdue,
    },
    entries, byArea, followups,
  }
}

const stars = (n) => (n ? '⭐'.repeat(n) : '-')

export function buildFieldWhatsApp(r, note = '') {
  const t = r.totals, m = r.meta
  const L = []
  L.push('🌿 *SRIDHI PREMIUM IDLI & DOSA BATTER*')
  L.push(`🚶 *FIELD SALES REPORT*  |  ${m.rangeLabel}`)
  L.push(`👤 *${m.scopeLabel}*  ·  Chennai  ·  ${m.areaLabel}`)
  L.push('━━━━━━━━━━━━━━━━')
  L.push(`📍 *Visits:* ${t.visits}   📞 *Calls:* ${t.calls}   🏨 *Hotels reached:* ${t.hotels}`)
  L.push(`⭐ *Avg interest:* ${t.avgRating ? `${t.avgRating} / 5` : '-'}   🔥 *Interested:* ${t.hot}${t.orders ? `   🎉 *Orders restarted:* ${t.orders}` : ''}`)
  if (r.byArea.length) {
    L.push('━━━━━━━━━━━━━━━━')
    L.push('*🗺 Area-wise*')
    r.byArea.slice(0, 12).forEach((a) => L.push(`• *${a.area}* - ${a.visits} visit${a.visits === 1 ? '' : 's'}, ${a.calls} call${a.calls === 1 ? '' : 's'}${a.avg ? ` · ⭐ ${a.avg}` : ''}${a.orders ? ` · 🎉 ${a.orders}` : ''}`))
  }
  const top = r.entries.filter((e) => e.rating >= 4 || GOOD.includes(e.outcome)).slice(-8)
  if (top.length) {
    L.push('━━━━━━━━━━━━━━━━')
    L.push('*🔥 Hot hotels*')
    top.forEach((e, i) => L.push(`${i + 1}. *${e.name}* (${e.area}) - ${e.outcome}${e.rating ? ` ${stars(e.rating)}` : ''}${e.remark ? `: ${e.remark}` : ''}`))
  }
  L.push('━━━━━━━━━━━━━━━━')
  L.push(`⏰ *Follow-ups ${new Date(m.nextDay).toDateString() === new Date(Date.now() + 864e5).toDateString() ? 'tomorrow' : fmtDay(m.nextDay)}:* ${t.followups}${t.overdue ? `   ⚠️ Overdue: ${t.overdue}` : ''}`)
  r.followups.slice(0, 6).forEach((l, i) => L.push(`${i + 1}. ${nameOf(l)}${l.area ? ` (${l.area})` : ''}`))
  if (note.trim()) { L.push('━━━━━━━━━━━━━━━━'); L.push(`💬 *Notes:* ${note.trim()}`) }
  L.push('━━━━━━━━━━━━━━━━')
  L.push(`_Sent via Sridhi Field App · ${fmtDateTime(m.generatedAt)}_`)
  return L.join('\n')
}

export const fieldFileName = (r, ext) => {
  const who = r.meta.scopeLabel.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')
  const a = r.meta.from, b = r.meta.to
  const f = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const area = r.meta.areaLabel === 'All areas' ? '' : `-${r.meta.areaLabel.replace(/[^\w]+/g, '-')}`
  return `Sridhi-Field-Report-${who}${area}-${f(a) === f(b) ? f(a) : `${f(a)}_to_${f(b)}`}.${ext}`
}
