import { OUTCOMES } from './constants'

export const INTEREST = [
  { id: 'won', label: 'Onboarded', icon: '🎉', color: '#16a34a' },
  { id: 'hot', label: 'Hot', icon: '🔥', color: '#f97316' },
  { id: 'warm', label: 'Warm', icon: '🌤', color: '#eab308' },
  { id: 'cold', label: 'Cold', icon: '❄️', color: '#60a5fa' },
  { id: 'tried', label: 'Number tried', icon: '📞', color: '#94a3b8' },
  { id: 'fresh', label: 'Not called', icon: '🆕', color: '#d6dfd3' },
]
const HOT_STATUS = ['Interested', 'Meeting Fixed', 'Documentation']
const POSITIVE = ['Interested', 'Meeting Fixed', 'Onboarded']

export const isConnected = (outcome) => !!OUTCOMES.find((o) => o.id === outcome)?.connected

/** how interested is this lead? one bucket per lead */
export function interestOf(l) {
  if (l.status === 'Onboarded') return 'won'
  if (!l.callCount) return 'fresh'
  if (l.type === 'number') return 'tried'
  if (l.status === 'Not Interested') return 'cold'
  if (l.priority === 'Hot' || HOT_STATUS.includes(l.status)) return 'hot'
  if (l.priority === 'Cold') return 'cold'
  return 'warm'
}

const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
export const sinceFor = (period) => {
  if (period === 'today') return startOfDay()
  if (period === '7d') { const d = startOfDay(); d.setDate(d.getDate() - 6); return d }
  if (period === '30d') { const d = startOfDay(); d.setDate(d.getDate() - 29); return d }
  return new Date(0)
}
export const dayKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}` }

/** every call, tagged with the caller who made it and the lead it belongs to */
export function allCalls(leads, callers) {
  const byName = new Map(callers.map((c) => [c.name, c.id]))
  const out = []
  leads.forEach((l) => {
    ;(l.calls || []).forEach((c) => {
      const cid = byName.get(c.by) || l.assignedTo || ''
      if (!cid) return
      out.push({ ...c, callerId: cid, lead: l })
    })
  })
  return out.sort((a, b) => (b.at || '').localeCompare(a.at || ''))
}

export function lastDays(calls, n = 7, callerId = null) {
  const days = []
  for (let i = n - 1; i >= 0; i--) { const d = startOfDay(); d.setDate(d.getDate() - i); days.push({ d, key: dayKey(d), calls: 0, connected: 0 }) }
  const map = new Map(days.map((x) => [x.key, x]))
  calls.forEach((c) => {
    if (callerId && c.callerId !== callerId) return
    const e = map.get(dayKey(c.at))
    if (!e) return
    e.calls++
    if (isConnected(c.outcome)) e.connected++
  })
  return days
}

export function callerStats(leads, callers, calls, period) {
  const since = sinceFor(period)
  const now = new Date()
  const today = startOfDay()
  return callers.map((c) => {
    const mine = leads.filter((l) => l.assignedTo === c.id)
    const cs = calls.filter((x) => x.callerId === c.id)
    const inP = cs.filter((x) => new Date(x.at) >= since)
    const interest = Object.fromEntries(INTEREST.map((i) => [i.id, 0]))
    mine.forEach((l) => { interest[interestOf(l)]++ })
    const lastCall = cs[0]?.at || ''
    const touched = mine.map((l) => l.lastCall || l.updatedAt || '').sort().pop() || ''
    return {
      c, mine, interest,
      assigned: mine.length,
      fresh: interest.fresh,
      calls: inP.length,
      today: cs.filter((x) => new Date(x.at) >= today).length,
      total: cs.length,
      connected: inP.filter((x) => isConnected(x.outcome)).length,
      positive: inP.filter((x) => POSITIVE.includes(x.outcome)).length,
      updated: new Set(inP.map((x) => x.lead.id)).size,
      overdue: mine.filter((l) => l.nextFollowUp && !['Onboarded', 'Not Interested'].includes(l.status) && new Date(l.nextFollowUp) < now).length,
      lastActive: lastCall || touched,
      series: lastDays(calls, 7, c.id),
      recent: cs.slice(0, 12),
    }
  })
}

export function ago(iso) {
  if (!iso) return 'No activity yet'
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'Just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  const d = Math.floor(s / 86400)
  return d === 1 ? 'Yesterday' : `${d} days ago`
}
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)
