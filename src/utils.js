import { CLOSED } from './constants'

const pad = (n) => String(n).padStart(2, '0')

/** a bare number has no name yet, so show the phone instead */
export const nameOf = (l) => l.name || l.phone || 'Unknown'
export const typeLabel = (t) => (t === 'sales' ? 'Sales' : t === 'number' ? 'Number' : 'Distributor')

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)
export const nowISO = () => new Date().toISOString()

/* ---------- dates ---------- */
export const toLocalInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export const fromLocalInput = (v) => (v ? new Date(v).toISOString() : '')
export const addHours = (h) => new Date(Date.now() + h * 3600e3).toISOString()
export const atDay = (offset, hour, min = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  d.setHours(hour, min, 0, 0)
  return d.toISOString()
}
export const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString()
export const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })

export function relDay(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const t = new Date()
  const diff = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(t.getFullYear(), t.getMonth(), t.getDate())) / 864e5
  )
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
/** when a lead reached the caller (assigned date; older leads fall back to the day they were added) */
export const assignedAtOf = (l) => l.assignedAt || l.createdAt || l.updatedAt || ''
export const isToday = (iso) => !!iso && new Date(iso).toDateString() === new Date().toDateString()
export const dayLabel = (iso) => {
  if (!iso) return 'Earlier'
  const r = relDay(iso)
  if (r === 'Today' || r === 'Yesterday') return r
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}
export const dayKeyOf = (iso) => (iso ? new Date(iso).toDateString() : 'none')
export const fmtAssigned = (iso) => (iso ? `${relDay(iso)}, ${fmtTime(iso)}` : '')
export const fmtWhen = (iso) => (iso ? `${relDay(iso)}, ${fmtTime(iso)}` : '—')
export const fmtDur = (s) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`

export function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

/* ---------- phone ---------- */
export const cleanPhone = (p) => String(p || '').replace(/\D/g, '').slice(-10)
export const telHref = (p) => `tel:+91${cleanPhone(p)}`
export const waHref = (p, text = '') =>
  `https://wa.me/91${cleanPhone(p)}${text ? `?text=${encodeURIComponent(text)}` : ''}`

/* ---------- follow-up buckets ---------- */
export function bucket(lead) {
  if (!lead.nextFollowUp || CLOSED.includes(lead.status)) return 'none'
  const d = new Date(lead.nextFollowUp)
  const now = new Date()
  if (d < now) return 'overdue'
  if (sameDay(d, now)) return 'today'
  return 'upcoming'
}

export function suggestNext(outcome) {
  const h = new Date().getHours()
  switch (outcome) {
    case 'Not Answered':
    case 'No Response':
    case 'Switched Off':
    case 'Not Reachable': return h < 17 ? addHours(3) : atDay(1, 10)
    case 'Busy': return h < 18 ? addHours(1.5) : atDay(1, 10)
    case 'Call Back Later':
    case 'Interested':
    case 'Meeting Fixed': return atDay(1, 11)
    default: return ''
  }
}

/* ---------- calendar + gmail reminders ---------- */
const icsStamp = (d) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
const icsEsc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')

function eventFor(lead) {
  const start = new Date(lead.nextFollowUp)
  const end = new Date(start.getTime() + 15 * 60000)
  return {
    title: `📞 Call ${nameOf(lead)} (${typeLabel(lead.type)}) - Sridhi`,
    details: `Phone: ${lead.phone}\nArea: ${lead.area || ''}\nStatus: ${lead.status}\nLast remark: ${lead.lastRemark || '-'}`,
    start,
    end,
  }
}

export function gcalLink(lead) {
  const e = eventFor(lead)
  return (
    'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    `&text=${encodeURIComponent(e.title)}` +
    `&details=${encodeURIComponent(e.details)}` +
    `&dates=${icsStamp(e.start)}/${icsStamp(e.end)}` +
    `&location=${encodeURIComponent(lead.area ? lead.area + ', Bengaluru' : 'Bengaluru')}`
  )
}

export function gmailLink(lead, email) {
  const body =
    `Follow-up reminder\n\nLead: ${nameOf(lead)}\nPhone: ${lead.phone}\nWhen: ${fmtWhen(lead.nextFollowUp)}\n` +
    `Area: ${lead.area || '-'}\nLast remark: ${lead.lastRemark || '-'}\n\n- Sridhi Caller App`
  return (
    'https://mail.google.com/mail/?view=cm&fs=1' +
    `&to=${encodeURIComponent(email || '')}` +
    `&su=${encodeURIComponent(`Reminder: call ${nameOf(lead)} - ${fmtWhen(lead.nextFollowUp)}`)}` +
    `&body=${encodeURIComponent(body)}`
  )
}

export function download(name, text, mime = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadICS(leads, name = 'sridhi-followups.ics') {
  const items = leads.filter((l) => l.nextFollowUp)
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Sridhi Caller//EN', 'CALSCALE:GREGORIAN']
  items.forEach((l) => {
    const e = eventFor(l)
    lines.push(
      'BEGIN:VEVENT',
      `UID:${l.id}-${e.start.getTime()}@sridhi-caller`,
      `DTSTAMP:${icsStamp(new Date())}`,
      `DTSTART:${icsStamp(e.start)}`,
      `DTEND:${icsStamp(e.end)}`,
      `SUMMARY:${icsEsc(e.title)}`,
      `DESCRIPTION:${icsEsc(e.details)}`,
      'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', 'DESCRIPTION:Follow-up call', 'END:VALARM',
      'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:Follow-up call now', 'END:VALARM',
      'END:VEVENT'
    )
  })
  lines.push('END:VCALENDAR')
  download(name, lines.join('\r\n'), 'text/calendar')
  return items.length
}

/* ---------- CSV ---------- */
export function toCSV(rows, cols) {
  const esc = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
}

export function parseCSV(text) {
  const first = text.split('\n')[0] || ''
  const delim = first.includes('\t') ? '\t' : ','
  const rows = []
  let row = [], cur = '', q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') q = false
      else cur += ch
    } else if (ch === '"') q = true
    else if (ch === delim) { row.push(cur); cur = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cur); cur = ''
      if (row.some((c) => c.trim())) rows.push(row)
      row = []
    } else cur += ch
  }
  row.push(cur)
  if (row.some((c) => c.trim())) rows.push(row)
  return rows
}

const HEAD_MAP = {
  name: ['name', 'contact name', 'party', 'party name', 'distributor name', 'person'],
  phone: ['phone', 'mobile', 'mobile no', 'mobile number', 'contact', 'contact no', 'number', 'phone number'],
  area: ['area', 'location', 'locality', 'place'],
  company: ['company', 'shop', 'shop name', 'business', 'business name', 'firm'],
  email: ['email', 'e-mail', 'mail'],
  type: ['type', 'lead type'],
  notes: ['notes', 'remark', 'remarks', 'comment'],
  source: ['source'],
}

export function rowsToLeads(rows) {
  if (!rows.length) return []
  const head = rows[0].map((h) => h.trim().toLowerCase())
  const idx = {}
  Object.entries(HEAD_MAP).forEach(([k, names]) => {
    const i = head.findIndex((h) => names.includes(h))
    if (i >= 0) idx[k] = i
  })
  let body = rows.slice(1)
  if (idx.name == null && idx.phone == null) {
    // no header row: find the phone column; a lone column of numbers becomes bare "number" leads
    body = rows
    const pc = rows[0].findIndex((c) => String(c).replace(/\D/g, '').length >= 10)
    idx.phone = pc >= 0 ? pc : 1
    const other = rows[0].map((_, i) => i).filter((i) => i !== idx.phone)
    if (other[0] != null) idx.name = other[0]
    if (other[1] != null) idx.area = other[1]
    if (other[2] != null) idx.company = other[2]
  }
  const now = nowISO()
  return body
    .map((r) => {
      const g = (k) => (idx[k] != null ? (r[idx[k]] || '').trim() : '')
      const t = g('type').toLowerCase()
      const nm = g('name') || g('company')
      return {
        id: uid(),
        type: !nm || t.startsWith('n') ? 'number' : t.startsWith('s') ? 'sales' : 'distributor',
        name: nm,
        phone: cleanPhone(g('phone')),
        company: g('name') ? g('company') : '',
        area: g('area'),
        email: g('email'),
        notes: g('notes'),
        source: g('source') || 'Company Data',
        city: 'Bengaluru',
        status: 'New',
        priority: 'Warm',
        calls: [],
        callCount: 0,
        nextFollowUp: '',
        createdAt: now,
        updatedAt: now,
      }
    })
    .filter((l) => (l.type === 'number' ? l.phone.length === 10 : l.name || l.phone))
}
