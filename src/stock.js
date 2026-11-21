/**
 * Stock delivery + cash collection for milk distributors.
 * Everything is stored as entries in the distributor's call history (no Sheet change):
 *   Stock Delivered   dlPackets, dlReturned, dlRate, dlAmt (net bill), dlCollected (cash taken now), dlPay (Cash|Credit), dlDays, dlDue
 *   Payment Collected payAmt, payVia (Cash|UPI)
 * Outstanding is worked out from those entries, oldest bill is cleared first.
 */
export const RATE = 35                 // Rs per packet
export const CREDIT_DAYS = [3, 5, 7, 15]
export const DELIVERED = 'Stock Delivered'
export const PAID = 'Payment Collected'
export const isStockCall = (c) => c?.outcome === DELIVERED || c?.outcome === PAID

export const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`
const num = (v) => Number(v) || 0
const sod = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
export const dueAtFor = (days, from = new Date()) => { const d = sod(from); d.setDate(d.getDate() + num(days)); d.setHours(10, 0, 0, 0); return d.toISOString() }

/** the call entries for a delivery or a payment */
export function deliveryCall({ packets, returned, rate = RATE, collected, pay, days, note }) {
  const raw = (num(packets) - num(returned)) * rate
  const col = Math.min(num(collected), Math.max(raw, 0))
  const open = raw - col
  const due = open > 0 ? dueAtFor(days || 3) : ''
  const remark = [
    `Delivered ${num(packets)} pkt @ ${inr(rate)}`,
    num(returned) ? `returned ${num(returned)}` : '',
    `bill ${inr(raw)}`,
    open > 0 ? `credit ${inr(open)} for ${days || 3} days` : 'paid in cash',
    col > 0 && open > 0 ? `collected ${inr(col)}` : '',
    note ? note : '',
  ].filter(Boolean).join(' · ')
  return { outcome: DELIVERED, remark, dlPackets: num(packets), dlReturned: num(returned), dlRate: rate, dlAmt: raw, dlCollected: col, dlPay: open > 0 ? 'Credit' : pay || 'Cash', dlDays: open > 0 ? num(days || 3) : 0, dlDue: due }
}
export const paymentCall = ({ amount, via, note }) => ({ outcome: PAID, remark: `Collected ${inr(amount)} (${via})${note ? ` · ${note}` : ''}`, payAmt: num(amount), payVia: via })

/** money position of one distributor */
export function ledger(l) {
  const calls = [...(l?.calls || [])].filter(isStockCall).sort((a, b) => a.at.localeCompare(b.at))
  const dl = calls.filter((c) => c.outcome === DELIVERED)
  let later = calls.filter((c) => c.outcome === PAID).reduce((s, c) => s + num(c.payAmt), 0)
  const L = { packets: 0, returned: 0, billed: 0, collected: 0, outstanding: 0, dueAt: '', lastAt: dl.length ? dl[dl.length - 1].at : '', n: dl.length }
  dl.forEach((c) => {
    L.packets += num(c.dlPackets); L.returned += num(c.dlReturned); L.billed += num(c.dlAmt); L.collected += num(c.dlCollected)
    let open = num(c.dlAmt) - num(c.dlCollected)
    if (open < 0) { later += -open; open = 0 }  // return credit
    const take = Math.min(later, open); later -= take; open -= take
    if (open > 0.5) { L.outstanding += open; if (!L.dueAt) L.dueAt = c.dlDue || c.at }
  })
  L.collected += calls.filter((c) => c.outcome === PAID).reduce((s, c) => s + num(c.payAmt), 0)
  L.outstanding = Math.max(0, Math.round(L.outstanding))
  return L
}

/** 'late' | 'today' | 'soon' (tomorrow) | 'later' | '' (nothing owed) and days difference */
export function dueState(L) {
  if (!L.outstanding || !L.dueAt) return { k: L.outstanding ? 'later' : '', days: 0 }
  const days = Math.round((sod(L.dueAt) - sod(new Date())) / 864e5)
  return { k: days < 0 ? 'late' : days === 0 ? 'today' : days === 1 ? 'soon' : 'later', days }
}
export const dueText = (s) => (s.k === 'late' ? `${-s.days} day${s.days === -1 ? '' : 's'} overdue` : s.k === 'today' ? 'Due today' : s.k === 'soon' ? 'Due tomorrow' : s.k === 'later' ? `Due in ${s.days} days` : '')

/** everybody who owes money, most urgent first */
export function owingList(leads) {
  return leads.filter((l) => l.type === 'milk').map((l) => { const L = ledger(l); return { lead: l, L, s: dueState(L) } })
    .filter((x) => x.L.outstanding > 0).sort((a, b) => new Date(a.L.dueAt) - new Date(b.L.dueAt))
}

/** totals for a list of report entries (what was done in the chosen period) + what is still owed now */
export function stockReport(entries, leads) {
  const dl = entries.filter((e) => e.outcome === DELIVERED), pay = entries.filter((e) => e.outcome === PAID)
  const s = { deliveries: dl.length, packets: 0, returned: 0, billed: 0, cashNow: 0, credit: 0, later: 0, rows: [], owing: owingList(leads) }
  dl.forEach((e) => { s.packets += e.dlPackets; s.returned += e.dlReturned; s.billed += e.dlAmt; s.cashNow += e.dlCollected; s.credit += Math.max(0, e.dlAmt - e.dlCollected) })
  pay.forEach((e) => { s.later += e.payAmt })
  s.collected = s.cashNow + s.later
  s.owed = s.owing.reduce((t, x) => t + x.L.outstanding, 0)
  s.overdue = s.owing.filter((x) => x.s.k === 'late')
  return s
}
