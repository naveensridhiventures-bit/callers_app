import { CLOSED } from './constants'

const pad = (n) => String(n).padStart(2, '0')

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
    case 'Not Answered': return h < 17 ? addHours(3) : atDay(1, 10)
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
    title: `📞 Call ${lead.name} (${lead.type === 'distributor' ? 'Distributor' : 'Sales'}) - Sridhi`,
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
    `Follow-up reminder\n\nLead: ${lead.name}\nPhone: ${lead.phone}\nWhen: ${fmtWhen(lead.nextFollowUp)}\n` +
    `Area: ${lead.area || '-'}\nLast remark: ${lead.lastRemark || '-'}\n\n- Sridhi Caller App`
  return (
    'https://mail.google.com/mail/?view=cm&fs=1' +
    `&to=${encodeURIComponent(email || '')}` +
    `&su=${encodeURIComponent(`Reminder: call ${lead.name} - ${fmtWhen(lead.nextFollowUp)}`)}` +
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
    // no header row - assume order: name, phone, area, company
    Object.assign(idx, { name: 0, phone: 1, area: 2, company: 3 })
    body = rows
  }
  const now = nowISO()
  return body
    .map((r) => {
      const g = (k) => (idx[k] != null ? (r[idx[k]] || '').trim() : '')
      const t = g('type').toLowerCase()
      return {
        id: uid(),
        type: t.startsWith('s') ? 'sales' : 'distributor',
        name: g('name'),
        phone: cleanPhone(g('phone')),
        company: g('company'),
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
    .filter((l) => l.name || l.phone)
    .map((l) => ({ ...l, name: l.name || l.company || l.phone }))
}
