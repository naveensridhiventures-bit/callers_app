import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { uid, nowISO, addHours, atDay } from './utils'
import { OUTCOMES, CLOSED } from './constants'

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

const load = (k, d) => {
  try {
    const v = JSON.parse(localStorage.getItem(k))
    return v ?? d
  } catch {
    return d
  }
}

export function AppProvider({ children }) {
  const [leads, setLeads] = useState(() => load('sridhi.leads', []))
  const [settings, setSettings] = useState(() => ({
    name: '', email: '', target: 60, sheetUrl: '', token: '', ...load('sridhi.settings', {}),
  }))
  const [sync, setSync] = useState({ state: 'off', at: null, msg: '' })
  const [page, setPage] = useState('home')
  const [sub, setSub] = useState('reports')
  const [sheet, setSheet] = useState(null)
  const [filter, setFilter] = useState({ q: '', type: 'all', status: 'all' })
  const [toasts, setToasts] = useState([])

  const leadsRef = useRef(leads)
  leadsRef.current = leads
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  useEffect(() => localStorage.setItem('sridhi.leads', JSON.stringify(leads)), [leads])
  useEffect(() => localStorage.setItem('sridhi.settings', JSON.stringify(settings)), [settings])

  /* ---------- UI helpers ---------- */
  const toast = useCallback((msg, type = 'ok') => {
    const id = uid()
    setToasts((t) => [...t, { id, msg, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800)
  }, [])
  const go = useCallback((p, s) => {
    setPage(p)
    if (s) setSub(s)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])
  const openLead = useCallback((id, opts = {}) => setSheet({ type: 'detail', id, ...opts }), [])
  const openForm = useCallback((lead = null, preset = {}) => setSheet({ type: 'form', lead, preset }), [])
  const closeSheet = useCallback(() => setSheet(null), [])

  /* ---------- Google Sheets sync (Apps Script web app) ---------- */
  const post = useCallback(async (body) => {
    const { sheetUrl, token } = settingsRef.current
    if (!sheetUrl) return null
    setSync((s) => ({ ...s, state: 'syncing' }))
    try {
      const r = await fetch(sheetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...body, token }),
      })
      const j = await r.json()
      if (j.error) throw new Error(j.error)
      setSync({ state: 'ok', at: nowISO(), msg: '' })
      return j
    } catch (e) {
      setSync({ state: 'error', at: nowISO(), msg: String(e.message || e) })
      return null
    }
  }, [])

  const syncNow = useCallback(async () => {
    const { sheetUrl, token } = settingsRef.current
    if (!sheetUrl) {
      setSync({ state: 'off', at: null, msg: 'Add your Google Sheet URL in Settings' })
      return false
    }
    setSync((s) => ({ ...s, state: 'syncing' }))
    try {
      const url = `${sheetUrl}${sheetUrl.includes('?') ? '&' : '?'}action=list&token=${encodeURIComponent(token || '')}`
      const r = await fetch(url)
      const j = await r.json()
      if (j.error) throw new Error(j.error)
      const remote = j.leads || []
      const map = new Map(leadsRef.current.map((l) => [l.id, l]))
      remote.forEach((rl) => {
        const l = map.get(rl.id)
        if (!l || (rl.updatedAt || '') > (l.updatedAt || '')) map.set(rl.id, rl)
      })
      const merged = [...map.values()].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
      setLeads(merged)
      const rmap = new Map(remote.map((l) => [l.id, l]))
      const toPush = merged.filter((l) => {
        const x = rmap.get(l.id)
        return !x || (l.updatedAt || '') > (x.updatedAt || '')
      })
      if (toPush.length) {
        for (let i = 0; i < toPush.length; i += 200) {
          const res = await post({ action: 'bulk', leads: toPush.slice(i, i + 200) })
          if (!res) return false
        }
      }
      setSync({ state: 'ok', at: nowISO(), msg: `${merged.length} leads in sync` })
      return true
    } catch (e) {
      setSync({ state: 'error', at: nowISO(), msg: String(e.message || e) })
      return false
    }
  }, [post])

  useEffect(() => {
    if (!settings.sheetUrl) return
    syncNow()
    const t = setInterval(syncNow, 120000)
    const onVis = () => document.visibilityState === 'visible' && syncNow()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVis)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.sheetUrl, settings.token])

  /* ---------- lead actions ---------- */
  const saveLead = useCallback(
    (lead, call = null) => {
      const l = { ...lead, updatedAt: nowISO() }
      setLeads((prev) => {
        const i = prev.findIndex((x) => x.id === l.id)
        if (i < 0) return [l, ...prev]
        const n = [...prev]
        n[i] = l
        return n
      })
      post({ action: 'upsert', lead: l, call })
      return l
    },
    [post]
  )

  const addLead = useCallback(
    (data) =>
      saveLead({
        id: uid(), type: 'distributor', status: 'New', priority: 'Warm', city: 'Bengaluru',
        calls: [], callCount: 0, createdAt: nowISO(), nextFollowUp: '', ...data,
      }),
    [saveLead]
  )

  const logCall = useCallback(
    (lead, { outcome, remark, next, status, priority, duration }) => {
      const o = OUTCOMES.find((x) => x.id === outcome)
      const newStatus = status || o?.status || lead.status
      const call = {
        id: uid(), at: nowISO(), outcome, remark: remark || '', next: next || '',
        by: settingsRef.current.name || '', duration: duration || 0,
      }
      const updated = {
        ...lead,
        calls: [call, ...(lead.calls || [])],
        callCount: (lead.callCount || 0) + 1,
        lastCall: call.at,
        lastOutcome: outcome,
        lastRemark: remark || lead.lastRemark || '',
        status: newStatus,
        priority: priority || lead.priority,
        nextFollowUp: CLOSED.includes(newStatus) ? '' : next || '',
      }
      return saveLead(updated, { ...call, leadId: lead.id, name: lead.name, phone: lead.phone })
    },
    [saveLead]
  )

  const snooze = useCallback(
    (lead, iso) => saveLead({ ...lead, nextFollowUp: iso }),
    [saveLead]
  )

  const removeLead = useCallback(
    (id) => {
      setLeads((p) => p.filter((x) => x.id !== id))
      post({ action: 'delete', id })
    },
    [post]
  )

  const importLeads = useCallback(
    (arr) => {
      const phones = new Set(leadsRef.current.map((l) => l.phone))
      const fresh = arr.filter((l) => !l.phone || !phones.has(l.phone))
      setLeads((p) => [...fresh, ...p])
      for (let i = 0; i < fresh.length; i += 200) post({ action: 'bulk', leads: fresh.slice(i, i + 200) })
      return { added: fresh.length, skipped: arr.length - fresh.length }
    },
    [post]
  )

  const clearAll = useCallback(() => setLeads([]), [])

  const loadSample = useCallback(() => {
    const mk = (o) => ({
      id: uid(), type: 'distributor', status: 'New', priority: 'Warm', city: 'Bengaluru',
      calls: [], callCount: 0, nextFollowUp: '', source: 'Company Data',
      createdAt: nowISO(), updatedAt: nowISO(), ...o,
    })
    const sample = [
      mk({ name: 'Ravi Kumar (Sample)', phone: '9800000001', area: 'Whitefield', company: 'Ravi Provisions', bizType: 'Kirana / General Store', status: 'Interested', priority: 'Hot', nextFollowUp: addHours(-3), lastRemark: 'Wants to know margin', lastOutcome: 'Interested', callCount: 1, investment: '₹1 – 3 Lakh', vehicle: 'Yes' }),
      mk({ name: 'Suresh Gowda (Sample)', phone: '9800000002', area: 'Yelahanka', company: 'Gowda Traders', bizType: 'Existing Distributor', status: 'Meeting Fixed', priority: 'Hot', nextFollowUp: addHours(2), lastRemark: 'Meeting at office', lastOutcome: 'Meeting Fixed', callCount: 2, investment: 'Above ₹3 Lakh' }),
      mk({ name: 'Manjula R (Sample)', phone: '9800000003', area: 'JP Nagar', company: 'Sri Lakshmi Stores', type: 'sales', bizType: 'Supermarket', status: 'Contacted', nextFollowUp: atDay(1, 11), lastRemark: 'Wants price list', lastOutcome: 'Call Back Later', callCount: 1, dailyQty: '40' }),
      mk({ name: 'Imran Pasha (Sample)', phone: '9800000004', area: 'Marathahalli', company: 'Pasha Wholesale', bizType: 'Wholesaler', status: 'Contacted', priority: 'Cold', nextFollowUp: atDay(3, 10), lastRemark: 'Already distributes another brand', lastOutcome: 'Call Back Later', callCount: 1 }),
      mk({ name: 'Anitha S (Sample)', phone: '9800000005', area: 'Electronic City', bizType: 'Entrepreneur (New)', source: 'Facebook / Instagram' }),
      mk({ name: 'Mohan Das (Sample)', phone: '9800000006', area: 'Rajajinagar', company: 'Das Milk Parlour', type: 'sales', bizType: 'Milk Parlour', status: 'Onboarded', priority: 'Hot', lastOutcome: 'Onboarded', callCount: 3 }),
    ]
    setLeads((p) => [...sample, ...p])
    toast('Sample data loaded 🎉')
  }, [toast])

  const value = {
    leads, settings, setSettings, sync, syncNow,
    page, sub, go, sheet, openLead, openForm, closeSheet,
    filter, setFilter, toasts, toast,
    saveLead, addLead, logCall, snooze, removeLead, importLeads, clearAll, loadSample,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
