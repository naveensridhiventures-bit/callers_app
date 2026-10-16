import { OUTCOMES } from './constants'
import { INTEREST, allCalls, dayKey, interestOf, isCall, isConnected, isUpdate, pct } from './analytics'
import { nameOf } from './utils'

const POSITIVE = ['Interested', 'Meeting Fixed', 'Onboarded']
const sod = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const eod = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x }
const D = (d, o) => new Date(d).toLocaleDateString('en-IN', o)
export const fmtDay = (d) => D(d, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const fmtShort = (d) => D(d, { day: 'numeric', month: 'short' })
const fmtTimeOnly = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
export const fmtDateTime = (d) => `${fmtShort(d)}, ${fmtTimeOnly(d)}`
export const toInputDate = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` }

export const RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'custom', label: 'Custom dates' },
]

export function rangeFor(kind, from, to) {
  const now = new Date()
  let a = sod(now), b = eod(now), title = 'EOD Report'
  if (kind === 'yesterday') { a = sod(new Date(now.getTime() - 864e5)); b = eod(a); title = 'Daily Report' }
  else if (kind === 'week') { const d = sod(now); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); a = d; title = 'Weekly Report' }
  else if (kind === 'month') { a = sod(new Date(now.getFullYear(), now.getMonth(), 1)); title = 'Monthly Report' }
  else if (kind === 'custom') {
    a = sod(from ? new Date(`${from}T00:00:00`) : now); b = eod(to ? new Date(`${to}T00:00:00`) : now)
    if (b < a) [a, b] = [sod(b), eod(a)]
    title = 'Performance Report'
  }
  const same = dayKey(a) === dayKey(b)
  return { kind, from: a, to: b, title, label: same ? fmtDay(a) : `${fmtShort(a)} - ${fmtDay(b)}`, single: same }
}

/** everything a report needs, for one caller, a set of callers, or the whole team */
export function buildReport({ allLeads, callers, session, range, callerId = 'all' }) {
  const isAdmin = session?.role === 'admin'
  const roster = isAdmin ? callers : [{ id: session?.id, name: session?.name || 'Caller' }]
  const scope = isAdmin ? (callerId === 'all' ? roster : roster.filter((c) => c.id === callerId)) : roster
  const ids = new Set(scope.map((c) => c.id))
  const nameById = new Map(roster.map((c) => [c.id, c.name]))
  const leads = allLeads.filter((l) => (isAdmin ? (callerId === 'all' ? true : ids.has(l.assignedTo)) : l.assignedTo === session?.id))
  const mineLeads = leads.filter((l) => (isAdmin && callerId === 'all' ? true : ids.has(l.assignedTo)) || !isAdmin)

  const calls = allCalls(allLeads, isAdmin ? callers : roster).filter((c) => (isAdmin && callerId === 'all' ? true : ids.has(c.callerId)))
  const inR = calls.filter((c) => { const t = new Date(c.at); return t >= range.from && t <= range.to })
  const real = inR.filter(isCall)
  const updates = inR.filter(isUpdate)
  const connected = real.filter((c) => isConnected(c.outcome))
  const touched = new Set(inR.map((c) => c.lead.id))

  const outcomes = OUTCOMES.filter((o) => !o.hidden)
    .map((o) => ({ outcome: o.id, icon: o.icon, count: real.filter((c) => c.outcome === o.id).length }))
    .filter((o) => o.count)
    .sort((a, b) => b.count - a.count)

  // day by day
  const days = []
  for (let d = sod(range.from); d <= range.to && days.length < 62; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    days.push({ d: new Date(d), key: dayKey(d), label: D(d, { day: 'numeric', month: 'short' }), dow: D(d, { weekday: 'short' }), calls: 0, connected: 0, updates: 0 })
  }
  const dmap = new Map(days.map((x) => [x.key, x]))
  inR.forEach((c) => {
    const e = dmap.get(dayKey(c.at)); if (!e) return
    if (isCall(c)) { e.calls++; if (isConnected(c.outcome)) e.connected++ }
    if (isUpdate(c)) e.updates++
  })

  // per caller
  const now = new Date()
  const perCaller = scope.map((c) => {
    const rc = inR.filter((x) => x.callerId === c.id)
    const rr = rc.filter(isCall)
    const mine = allLeads.filter((l) => l.assignedTo === c.id)
    const it = Object.fromEntries(INTEREST.map((i) => [i.id, 0]))
    mine.forEach((l) => { it[interestOf(l)]++ })
    return {
      name: c.name, assigned: mine.length, calls: rr.length,
      connected: rr.filter((x) => isConnected(x.outcome)).length,
      rate: pct(rr.filter((x) => isConnected(x.outcome)).length, rr.length),
      updates: rc.filter(isUpdate).length,
      interested: rr.filter((x) => POSITIVE.includes(x.outcome)).length,
      meetings: rr.filter((x) => x.outcome === 'Meeting Fixed').length,
      onboarded: rr.filter((x) => x.outcome === 'Onboarded').length,
      notCalled: it.fresh,
      overdue: mine.filter((l) => l.nextFollowUp && !['Onboarded', 'Not Interested'].includes(l.status) && new Date(l.nextFollowUp) < now).length,
      hot: it.hot,
    }
  }).sort((a, b) => b.calls - a.calls)

  // highlights: best result per lead in range
  const hl = new Map()
  real.filter((c) => POSITIVE.includes(c.outcome)).forEach((c) => {
    const rank = POSITIVE.indexOf(c.outcome)
    const old = hl.get(c.lead.id)
    if (!old || rank > old.rank || (rank === old.rank && c.at > old.at)) hl.set(c.lead.id, { rank, at: c.at, lead: c.lead, outcome: c.outcome, remark: c.remark, caller: nameById.get(c.callerId) || c.by })
  })
  const highlights = [...hl.values()].sort((a, b) => b.rank - a.rank || b.at.localeCompare(a.at))

  // follow-ups for the next day after the range
  const nextDay = new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate() + 1)
  const closed = ['Onboarded', 'Not Interested']
  const followups = mineLeads
    .filter((l) => l.nextFollowUp && !closed.includes(l.status) && new Date(l.nextFollowUp) >= sod(nextDay) && new Date(l.nextFollowUp) <= eod(nextDay))
    .sort((a, b) => a.nextFollowUp.localeCompare(b.nextFollowUp))
  const overdue = mineLeads.filter((l) => l.nextFollowUp && !closed.includes(l.status) && new Date(l.nextFollowUp) < sod(now)).length
  const pipeline = Object.fromEntries(INTEREST.map((i) => [i.id, 0]))
  mineLeads.forEach((l) => { pipeline[interestOf(l)]++ })

  const log = [...inR].sort((a, b) => a.at.localeCompare(b.at)).map((c) => ({
    at: c.at, caller: nameById.get(c.callerId) || c.by || '', name: nameOf(c.lead), phone: c.lead.phone, area: c.lead.area || '',
    type: c.lead.type, outcome: c.outcome, remark: c.remark || '', next: c.next || '', duration: c.duration || 0,
  }))

  const scopeLabel = isAdmin ? (callerId === 'all' ? `Whole team (${roster.length} callers)` : scope[0]?.name || '') : session?.name || ''
  return {
    meta: { title: range.title, rangeLabel: range.label, scopeLabel, isTeam: isAdmin && callerId === 'all', single: range.single, generatedAt: new Date(), nextDay, kind: range.kind, from: range.from, to: range.to },
    totals: {
      calls: real.length, connected: connected.length, notConnected: real.length - connected.length, rate: pct(connected.length, real.length),
      updates: updates.length, added: inR.filter((c) => c.outcome === 'Lead Added').length, touched: touched.size,
      interested: real.filter((c) => POSITIVE.includes(c.outcome)).length,
      meetings: real.filter((c) => c.outcome === 'Meeting Fixed').length,
      onboarded: real.filter((c) => c.outcome === 'Onboarded').length,
      followups: followups.length, overdue, leads: mineLeads.length, notCalled: pipeline.fresh,
    },
    outcomes, days, perCaller, highlights, followups, pipeline, log,
    leadRows: mineLeads.map((l) => ({
      name: nameOf(l), phone: l.phone, area: l.area || '', company: l.company || '', type: l.type, status: l.status,
      interest: INTEREST.find((i) => i.id === interestOf(l))?.label || '', priority: l.priority || '',
      caller: nameById.get(l.assignedTo) || l.assignedName || '', calls: l.callCount || 0, lastCall: l.lastCall || '', lastOutcome: l.lastOutcome || '',
      lastRemark: l.lastRemark || '', next: l.nextFollowUp || '',
    })),
  }
}

/* ---------- the WhatsApp message (copy / paste into the management group) ---------- */
export function buildWhatsApp(r, note = '') {
  const t = r.totals, m = r.meta
  const L = []
  L.push('🌿 *SRIDHI PREMIUM IDLI & DOSA BATTER*')
  L.push(`📋 *${m.title.toUpperCase()}*  |  ${m.rangeLabel}`)
  L.push(`👤 *${m.scopeLabel}*  ·  Bengaluru`)
  L.push('━━━━━━━━━━━━━━━━')
  L.push(`📞 *Calls made:* ${t.calls}`)
  L.push(`     ✅ Connected: ${t.connected} (${t.rate}%)   📵 Not connected: ${t.notConnected}`)
  L.push(`📝 *Leads updated:* ${t.updates}${t.added ? `   ➕ *New leads:* ${t.added}` : ''}`)
  L.push(`🙋 *Leads contacted:* ${t.touched}`)
  L.push(`🔥 *Interested:* ${t.interested}   🤝 *Meetings:* ${t.meetings}   🎉 *Onboarded:* ${t.onboarded}`)
  if (r.outcomes.length) {
    L.push('━━━━━━━━━━━━━━━━')
    L.push('*📊 Call outcomes*')
    r.outcomes.forEach((o) => L.push(`${o.icon} ${o.outcome}: *${o.count}*`))
  }
  if (!m.single && r.days.length > 1 && r.days.length <= 14) {
    L.push('━━━━━━━━━━━━━━━━')
    L.push('*📅 Day by day*')
    r.days.forEach((d) => L.push(`${d.dow} ${d.label}: ${d.calls} calls${d.updates ? `, ${d.updates} updates` : ''}`))
  }
  if (m.isTeam && r.perCaller.length) {
    L.push('━━━━━━━━━━━━━━━━')
    L.push('*🏆 Caller-wise*')
    r.perCaller.forEach((c, i) => L.push(`${['🥇', '🥈', '🥉'][i] || `${i + 1}.`} *${c.name}* - ${c.calls} calls (${c.rate}% connected) · ${c.interested} interested · ${c.onboarded} onboarded`))
  }
  if (r.highlights.length) {
    L.push('━━━━━━━━━━━━━━━━')
    L.push('*⭐ Highlights*')
    r.highlights.slice(0, 8).forEach((h, i) => {
      const ic = OUTCOMES.find((o) => o.id === h.outcome)?.icon || ''
      L.push(`${i + 1}. ${ic} *${nameOf(h.lead)}*${h.lead.area ? ` (${h.lead.area})` : ''} - ${h.outcome}${h.remark ? `: ${h.remark}` : ''}`)
    })
    if (r.highlights.length > 8) L.push(`…and ${r.highlights.length - 8} more`)
  }
  L.push('━━━━━━━━━━━━━━━━')
  L.push(`⏰ *Follow-ups ${m.nextDay && new Date(m.nextDay).toDateString() === new Date(Date.now() + 864e5).toDateString() ? 'tomorrow' : `on ${fmtShort(m.nextDay)}`}:* ${t.followups}${t.overdue ? `   ⚠️ Overdue: ${t.overdue}` : ''}`)
  r.followups.slice(0, 8).forEach((l, i) => L.push(`${i + 1}. ${nameOf(l)}${l.area ? ` (${l.area})` : ''} - ${fmtTimeOnly(l.nextFollowUp)}`))
  if (r.followups.length > 8) L.push(`…and ${r.followups.length - 8} more`)
  const p = r.pipeline
  L.push(`📌 *Pipeline:* 🔥 Hot ${p.hot} · 🌤 Warm ${p.warm} · ❄️ Cold ${p.cold} · 🆕 Not called ${p.fresh} · 🎉 Won ${p.won}`)
  if (note.trim()) { L.push('━━━━━━━━━━━━━━━━'); L.push(`💬 *Notes:* ${note.trim()}`) }
  L.push('━━━━━━━━━━━━━━━━')
  L.push(`_Sent via Sridhi Caller App · ${fmtDateTime(m.generatedAt)}_`)
  return L.join('\n')
}

export const reportFileName = (r, ext) => {
  const who = r.meta.scopeLabel.replace(/\s*\(.*\)/, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')
  const a = toInputDate(r.meta.from), b = toInputDate(r.meta.to)
  return `Sridhi-${r.meta.title.replace(/\s+/g, '-')}-${who}-${a === b ? a : `${a}_to_${b}`}.${ext}`
}
