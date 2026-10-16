import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { uid, nowISO, addHours, atDay } from './utils'
import { OUTCOMES, CLOSED, DEFAULT_SHEET_URL, OLD_DEFAULT_URLS } from './constants'

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

const rpc = async (url, body) => {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
  return r.json()
}
const getJSON = async (url, params) => {
  const u = `${url}${url.includes('?') ? '&' : '?'}${new URLSearchParams(params).toString()}`
  const r = await fetch(u)
  return r.json()
}
const strip = ({ _synced, ...rest }) => rest

export function AppProvider({ children }) {
  const [allLeads, setLeads] = useState(() => load('sridhi.leads', []))
  const [callers, setCallers] = useState(() => load('sridhi.callers', []))
  const [session, setSession] = useState(() => load('sridhi.session', null))
  const [rawSettings, setSettings] = useState(() => {
    const s = { name: '', email: '', target: 60, sheetUrl: '', token: '', ...load('sridhi.settings', {}) }
    if (!s.sheetUrl || OLD_DEFAULT_URLS.includes(s.sheetUrl)) s.sheetUrl = DEFAULT_SHEET_URL
    return s
  })
  const [sync, setSync] = useState({ state: 'idle', at: null, msg: '' })
  const [scriptVersion, setScriptVersion] = useState(null)
  const [gate, setGate] = useState('loading') // loading | login | ready
  const [loginList, setLoginList] = useState([])
  const [loginErr, setLoginErr] = useState('')
  const [gateTry, setGateTry] = useState(0)
  const [page, setPage] = useState('home')
  const [sub, setSub] = useState('reports')
  const [sheet, setSheet] = useState(null)
  const [filter, setFilter] = useState({ q: '', type: 'all', status: 'all', caller: 'all' })
  const [toasts, setToasts] = useState([])

  const settings = useMemo(() => ({ ...rawSettings, name: session?.name || rawSettings.name }), [rawSettings, session])
  const leads = useMemo(
    () => (session?.role === 'caller' ? allLeads.filter((l) => l.assignedTo === session.id) : allLeads),
    [allLeads, session]
  )

  const leadsRef = useRef(allLeads); leadsRef.current = allLeads
  const callersRef = useRef(callers); callersRef.current = callers
  const settingsRef = useRef(rawSettings); settingsRef.current = rawSettings
  const sessionRef = useRef(session); sessionRef.current = session
  const syncing = useRef(false)

  useEffect(() => localStorage.setItem('sridhi.leads', JSON.stringify(allLeads)), [allLeads])
  useEffect(() => localStorage.setItem('sridhi.callers', JSON.stringify(callers)), [callers])
  useEffect(() => localStorage.setItem('sridhi.settings', JSON.stringify(rawSettings)), [rawSettings])
  useEffect(() => {
    if (session) localStorage.setItem('sridhi.session', JSON.stringify(session))
    else localStorage.removeItem('sridhi.session')
  }, [session])

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

  /* ---------- Google Sheets transport ---------- */
  const authPayload = () => {
    const s = sessionRef.current
    return s ? { role: s.role, id: s.id, pin: s.pin } : null
  }
  const forceLogout = useCallback(() => setSession(null), [])

  const markSynced = useCallback((body) => {
    const sent = new Map(
      (body.action === 'upsert' ? [body.lead] : body.action === 'bulk' ? body.leads : []).map((l) => [l.id, l.updatedAt])
    )
    if (!sent.size) return
    setLeads((prev) => prev.map((l) => (sent.has(l.id) && sent.get(l.id) === l.updatedAt ? { ...l, _synced: true } : l)))
  }, [])

  const post = useCallback(async (body) => {
    const { sheetUrl, token } = settingsRef.current
    if (!sheetUrl) return null
    setSync((s) => ({ ...s, state: 'syncing' }))
    try {
      const j = await rpc(sheetUrl, { ...body, token, auth: authPayload() })
      if (j.error) {
        if (/login required/i.test(j.error)) forceLogout()
        throw new Error(j.error)
      }
      setSync({ state: 'ok', at: nowISO(), msg: '' })
      markSynced(body)
      return j
    } catch (e) {
      setSync({ state: 'error', at: nowISO(), msg: String(e.message || e) })
      return null
    }
  }, [forceLogout, markSynced])

  const syncNow = useCallback(async () => {
    const { sheetUrl, token } = settingsRef.current
    if (!sheetUrl) return false
    if (syncing.current) return false
    syncing.current = true
    setSync((s) => ({ ...s, state: 'syncing' }))
    try {
      const j = await getJSON(sheetUrl, { action: 'list', token: token || '', auth: JSON.stringify(authPayload()) })
      if (j.error) {
        if (/login required/i.test(j.error)) forceLogout()
        throw new Error(j.error)
      }
      if (j.version) setScriptVersion(j.version)
      if (Array.isArray(j.callers)) setCallers(j.callers)

      const remote = (j.leads || []).map((l) => ({ ...l, _synced: true }))
      const rmap = new Map(remote.map((l) => [l.id, l]))
      const map = new Map()
      leadsRef.current.forEach((l) => {
        const r = rmap.get(l.id)
        if (!r) {
          if (l._synced === true) return // removed or re-assigned on the server
          map.set(l.id, l) // created on this device, still to upload
          return
        }
        const a = r.updatedAt || ''
        const b = l.updatedAt || ''
        map.set(l.id, a > b ? r : a === b ? { ...l, _synced: true } : l)
      })
      let added = 0
      remote.forEach((r) => {
        if (!map.has(r.id)) { map.set(r.id, r); added++ }
      })
      const merged = [...map.values()].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
      setLeads(merged)

      const toPush = merged.filter((l) => l._synced !== true)
      for (let i = 0; i < toPush.length; i += 200) {
        const res = await post({ action: 'bulk', leads: toPush.slice(i, i + 200).map(strip) })
        if (!res) return false
      }
      setSync({ state: 'ok', at: nowISO(), msg: `${merged.length} leads` })
      if (added > 0 && sessionRef.current?.role === 'caller') {
        toast(`📥 ${added} new lead${added > 1 ? 's' : ''} assigned to you`)
        navigator.vibrate?.(150)
      }
      return true
    } catch (e) {
      setSync({ state: 'error', at: nowISO(), msg: String(e.message || e) })
      return false
    } finally {
      syncing.current = false
    }
  }, [post, forceLogout, toast])

  /* ---------- gate: who is using this device? ---------- */
  useEffect(() => {
    let dead = false
    ;(async () => {
      if (session || !rawSettings.sheetUrl) return setGate('ready')
      setGate('loading')
      setLoginErr('')
      try {
        const j = await getJSON(rawSettings.sheetUrl, { action: 'callers', token: rawSettings.token || '' })
        if (dead) return
        if (j.error) throw new Error(j.error)
        if (j.version) setScriptVersion(j.version)
        if (j.open || !(j.callers || []).length) return setGate('ready') // nobody set up yet: solo mode
        setLoginList(j.callers)
        setGate('login')
      } catch (e) {
        if (dead) return
        setLoginList([])
        setLoginErr("Can't reach the server. Check your internet and try again.")
        setGate('login')
      }
    })()
    return () => { dead = true }
  }, [session, rawSettings.sheetUrl, rawSettings.token, gateTry])

  /* ---------- automatic sync: on open, every 30 s, on focus, when back online ---------- */
  useEffect(() => {
    if (gate !== 'ready' || !rawSettings.sheetUrl) return
    syncNow()
    const t = setInterval(() => document.visibilityState === 'visible' && syncNow(), 30000)
    const onVis = () => document.visibilityState === 'visible' && syncNow()
    const onOnline = () => syncNow()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('online', onOnline)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('online', onOnline)
    }
  }, [gate, rawSettings.sheetUrl, rawSettings.token, session?.id, syncNow])

  /* anything still waiting to upload gets pushed a moment later (also retries after offline) */
  const pendingCount = allLeads.filter((l) => l._synced !== true).length
  useEffect(() => {
    if (gate !== 'ready' || !rawSettings.sheetUrl || !pendingCount) return
    const t = setTimeout(syncNow, 2500)
    return () => clearTimeout(t)
  }, [pendingCount, gate, rawSettings.sheetUrl, syncNow])

  /* ---------- login / logout ---------- */
  const login = useCallback(async (callerId, pin) => {
    const { sheetUrl, token } = settingsRef.current
    try {
      const j = await rpc(sheetUrl, { action: 'login', callerId, pin, token })
      if (j.error) return { ok: false, error: j.error }
      setSession({ role: 'caller', id: callerId, name: j.name, pin })
      return { ok: true }
    } catch {
      return { ok: false, error: 'No internet connection' }
    }
  }, [])

  const adminLogin = useCallback(async (pin) => {
    const { sheetUrl, token } = settingsRef.current
    if (!sheetUrl) return { ok: false, error: 'Google Sheet is not connected' }
    try {
      const j = await rpc(sheetUrl, { action: 'adminLogin', pin, token })
      if (j.error) return { ok: false, error: j.error }
      if (j.admin !== true) return { ok: false, error: 'Your Google Apps Script is old. Paste the new Code.gs (v2) and deploy a new version.' }
      setSession({ role: 'admin', id: 'admin', name: 'HR Admin', pin })
      return { ok: true }
    } catch {
      return { ok: false, error: 'No internet connection' }
    }
  }, [])

  const logout = useCallback(async () => {
    await syncNow()
    setLeads([])
    setCallers([])
    setSession(null)
    setPage('home')
  }, [syncNow])

  /* ---------- lead actions ---------- */
  const saveLead = useCallback(
    (lead, call = null) => {
      const l = { ...lead, updatedAt: nowISO(), _synced: false }
      setLeads((prev) => {
        const i = prev.findIndex((x) => x.id === l.id)
        if (i < 0) return [l, ...prev]
        const n = [...prev]
        n[i] = l
        return n
      })
      post({ action: 'upsert', lead: strip(l), call })
      return l
    },
    [post]
  )

  const addLead = useCallback(
    (data) => {
      const s = sessionRef.current
      return saveLead({
        id: uid(), type: 'distributor', status: 'New', priority: 'Warm', city: 'Bengaluru',
        calls: [], callCount: 0, createdAt: nowISO(), nextFollowUp: '',
        ...(s?.role === 'caller' ? { assignedTo: s.id, assignedName: s.name } : {}),
        ...data,
      })
    },
    [saveLead]
  )

  const logCall = useCallback(
    (lead, { outcome, remark, next, status, priority, duration }) => {
      const o = OUTCOMES.find((x) => x.id === outcome)
      const newStatus = status || o?.status || lead.status
      const call = {
        id: uid(), at: nowISO(), outcome, remark: remark || '', next: next || '',
        by: sessionRef.current?.name || settingsRef.current.name || '', duration: duration || 0,
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

  const convertLead = useCallback((lead, type) => saveLead({ ...lead, type }), [saveLead])

  const snooze = useCallback((lead, iso) => saveLead({ ...lead, nextFollowUp: iso }), [saveLead])

  const removeLead = useCallback(
    (id) => {
      setLeads((p) => p.filter((x) => x.id !== id))
      post({ action: 'delete', id })
    },
    [post]
  )

  const importLeads = useCallback(
    (arr, assignedTo = '') => {
      const phones = new Set(leadsRef.current.map((l) => l.phone))
      const name = callersRef.current.find((c) => c.id === assignedTo)?.name || ''
      const fresh = arr
        .filter((l) => !l.phone || !phones.has(l.phone))
        .map((l) => ({ ...l, assignedTo, assignedName: name, _synced: false }))
      setLeads((p) => [...fresh, ...p])
      ;(async () => {
        for (let i = 0; i < fresh.length; i += 200) await post({ action: 'bulk', leads: fresh.slice(i, i + 200).map(strip) })
      })()
      return { added: fresh.length, skipped: arr.length - fresh.length }
    },
    [post]
  )

  /* ---------- HR admin: callers + assignment ---------- */
  const assignMany = useCallback(
    async (pairs) => {
      const names = new Map(callersRef.current.map((c) => [c.id, c.name]))
      const pm = new Map(pairs)
      const ts = nowISO()
      const changed = leadsRef.current
        .filter((l) => pm.has(l.id))
        .map((l) => ({ ...l, assignedTo: pm.get(l.id) || '', assignedName: names.get(pm.get(l.id)) || '', updatedAt: ts, _synced: false }))
      const cm = new Map(changed.map((l) => [l.id, l]))
      setLeads((prev) => prev.map((l) => cm.get(l.id) || l))
      for (let i = 0; i < changed.length; i += 200) await post({ action: 'bulk', leads: changed.slice(i, i + 200).map(strip) })
      return changed.length
    },
    [post]
  )

  const saveCaller = useCallback(
    async (c) => {
      const j = await post({ action: 'callerUpsert', caller: c })
      if (!j) return false
      setCallers((prev) => (prev.some((x) => x.id === c.id) ? prev.map((x) => (x.id === c.id ? c : x)) : [...prev, c]))
      return true
    },
    [post]
  )

  const deleteCaller = useCallback(
    async (id) => {
      const mine = leadsRef.current.filter((l) => l.assignedTo === id).map((l) => [l.id, ''])
      if (mine.length) await assignMany(mine)
      const j = await post({ action: 'callerDelete', id })
      if (!j) return false
      setCallers((prev) => prev.filter((x) => x.id !== id))
      return true
    },
    [post, assignMany]
  )

  const clearAll = useCallback(() => setLeads([]), [])

  const loadSample = useCallback(() => {
    const mk = (o) => ({
      id: uid(), type: 'distributor', status: 'New', priority: 'Warm', city: 'Bengaluru',
      calls: [], callCount: 0, nextFollowUp: '', source: 'Company Data',
      createdAt: nowISO(), updatedAt: nowISO(), _synced: false, ...o,
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
    leads, allLeads, callers, settings, setSettings, sync, syncNow, scriptVersion,
    session, gate, loginList, loginErr, retryGate: () => setGateTry((n) => n + 1), login, adminLogin, logout,
    page, sub, go, sheet, openLead, openForm, closeSheet,
    filter, setFilter, toasts, toast,
    saveLead, addLead, logCall, convertLead, snooze, removeLead, importLeads, clearAll, loadSample,
    assignMany, saveCaller, deleteCaller,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
