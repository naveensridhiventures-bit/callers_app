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

const initialRoute = () => (location.pathname.replace(/\/+$/, '').toLowerCase() === '/control' ? 'control' : 'app')
const pathFor = (r) => (r === 'control' ? '/control' : '/')
let navInited = false

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
  const [route, setRoute] = useState(initialRoute)
  const [page, setPage] = useState('home')
  const [sub, setSub] = useState('eod')
  const [sheet, setSheet] = useState(null)
  const [filter, setFilter] = useState({ q: '', type: 'all', status: 'all', caller: 'all', date: 'all' })
  const [toasts, setToasts] = useState([])

  const settings = useMemo(() => ({ ...rawSettings, name: session?.name || rawSettings.name }), [rawSettings, session])
  const leads = useMemo(
    () => (session?.role === 'caller' ? allLeads.filter((l) => l.assignedTo === session.id || l.fieldId === session.id) : session?.role === 'field' ? allLeads.filter((l) => l.fieldId === session.id || l.assignedTo === session.id) : allLeads),
    [allLeads, session]
  )

  const leadsRef = useRef(allLeads); leadsRef.current = allLeads
  const callersRef = useRef(callers); callersRef.current = callers
  const settingsRef = useRef(rawSettings); settingsRef.current = rawSettings
  const sessionRef = useRef(session); sessionRef.current = session

  /* ---- unclosed-call tracking: every call must be closed with an outcome ---- */
  const [pendingCall, setPendingCall] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sridhi.pending') || 'null') } catch { return null }
  })
  const [pendingSnooze, setPendingSnooze] = useState(0)
  const pendingRef = useRef(pendingCall); pendingRef.current = pendingCall
  const writePending = useCallback((v) => {
    setPendingCall(v); pendingRef.current = v
    try { v ? localStorage.setItem('sridhi.pending', JSON.stringify(v)) : localStorage.removeItem('sridhi.pending') } catch {}
  }, [])
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && pendingRef.current && !pendingRef.current.away) writePending({ ...pendingRef.current, away: true })
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [writePending])
  const syncing = useRef(false)
  const reqSeen = useRef(null)
  const navRef = useRef({ route: initialRoute(), page: 'home', sub: 'eod', sheet: null })

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
  /* ---------- navigation that behaves like a real app (back = previous page / close sheet) ---------- */
  const pushNav = (patch, replace = false) => {
    const next = { ...navRef.current, ...patch }
    navRef.current = next
    const st = { app: 1, ...next }
    if (replace) window.history.replaceState(st, '', pathFor(next.route))
    else window.history.pushState(st, '', pathFor(next.route))
  }
  const go = useCallback((p, s) => {
    const cur = navRef.current
    const nsub = s || cur.sub
    window.scrollTo({ top: 0, behavior: 'smooth' })
    if (cur.route === 'app' && p === cur.page && nsub === cur.sub && !cur.sheet) return
    pushNav({ route: 'app', page: p, sub: nsub, sheet: null }, cur.route === 'app' && p === cur.page && !cur.sheet)
    setRoute('app'); setPage(p); setSub(nsub); setSheet(null)
  }, [])
  const openLead = useCallback((id, opts = {}) => {
    const sh = { type: 'detail', id, ...opts }
    pushNav({ sheet: sh }, !!navRef.current.sheet)
    setSheet(sh)
  }, [])
  const openForm = useCallback((lead = null, preset = {}) => {
    const sh = { type: 'form', leadId: lead?.id || null, preset }
    pushNav({ sheet: sh }, !!navRef.current.sheet)
    setSheet(sh)
  }, [])
  const closeSheet = useCallback(() => {
    if (navRef.current.sheet) window.history.back()
    else setSheet(null)
  }, [])

  useEffect(() => {
    if (navInited) return
    navInited = true
    const r = initialRoute()
    window.history.replaceState({ root: true }, '', pathFor(r))
    navRef.current = { route: r, page: 'home', sub: 'eod', sheet: null }
    window.history.pushState({ app: 1, ...navRef.current }, '', pathFor(r))
    let lastExit = 0
    const onPop = (e) => {
      const st = e.state
      if (st?.root) {
        // bottom of the stack: first back asks, second back really leaves
        if (Date.now() - lastExit < 2000) { window.history.back(); return }
        lastExit = Date.now()
        toast('Press back again to exit')
        window.history.pushState({ app: 1, ...navRef.current }, '', pathFor(navRef.current.route))
        return
      }
      if (st?.app) {
        navRef.current = { route: st.route, page: st.page, sub: st.sub, sheet: st.sheet || null }
        setRoute(st.route); setPage(st.page); setSub(st.sub); setSheet(st.sheet || null)
      }
    }
    window.addEventListener('popstate', onPop)
  }, [toast])

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
      if (j.me && sessionRef.current && (j.me.email || '') !== (sessionRef.current.email || '')) setSession((s) => (s ? { ...s, email: j.me.email } : s))

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
      const reqCount = merged.filter((l) => l.delReq === '1').length
      if (sessionRef.current?.role === 'admin' && reqSeen.current !== null && reqCount > reqSeen.current) {
        toast(`🗑 ${reqCount} delete request${reqCount > 1 ? 's' : ''} waiting for you`, 'warn')
      }
      reqSeen.current = reqCount

      const toPush = merged.filter((l) => l._synced !== true)
      for (let i = 0; i < toPush.length; i += 200) {
        const res = await post({ action: 'bulk', leads: toPush.slice(i, i + 200).map(strip) })
        if (!res) return false
      }
      setSync({ state: 'ok', at: nowISO(), msg: `${merged.length} leads` })
      if (added > 0 && ['caller', 'field'].includes(sessionRef.current?.role)) {
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
        const m = String(e?.message || e)
        setLoginErr(
          e instanceof SyntaxError
            ? 'Google replied with a web page, not data. In Apps Script: Deploy → Manage deployments → ✏️ → New version, Who has access = Anyone, then authorise it.'
            : /failed to fetch|networkerror|load failed/i.test(m)
            ? "Can't reach the server. Check your internet, and that the script is deployed with access = Anyone."
            : `Server says: ${m}`
        )
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
      setSession({ role: j.role === 'field' ? 'field' : 'caller', id: callerId, name: j.name, pin, email: j.email || '' })
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
      if (j.admin !== true) return { ok: false, error: 'Your Google Apps Script is old. Paste the latest Code.gs (v3) into your Sheet Apps Script and deploy a new version.' }
      setSession({ role: 'admin', id: 'admin', name: 'HR Admin', pin })
      return { ok: true }
    } catch {
      return { ok: false, error: 'No internet connection' }
    }
  }, [])

  const logout = useCallback(async () => {
    const wasAdmin = sessionRef.current?.role === 'admin'
    await syncNow()
    setLeads([])
    setCallers([])
    writePending(null)
    setSession(null)
    setSheet(null)
    if (wasAdmin) {
      pushNav({ route: 'control', page: 'home', sheet: null })
      setRoute('control'); setPage('home')
    } else go('home')
  }, [syncNow, go])

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

  /* a caller who adds or edits a person's details has spoken to them, so the lead counts as CALLED */
  const activityEntry = (lead, outcome, remark = '') => ({
    id: uid(), at: nowISO(), outcome, remark, next: '',
    by: sessionRef.current?.name || settingsRef.current.name || '', duration: 0,
    first: !(lead.callCount > 0),
  })

  const addLead = useCallback(
    (data) => {
      const s = sessionRef.current
      const base = {
        id: uid(), type: s?.role === 'field' ? 'hotel' : 'distributor', status: 'New', priority: 'Warm', city: s?.role === 'field' ? 'Chennai' : 'Bengaluru',
        calls: [], callCount: 0, createdAt: nowISO(), nextFollowUp: '',
        ...(s?.role === 'caller' ? { assignedTo: s.id, assignedName: s.name, assignedAt: nowISO() } : s?.role === 'field' ? { fieldId: s.id, fieldName: s.name, fieldAt: nowISO() } : {}),
        ...data,
      }
      if ((s?.role === 'caller' || s?.role === 'field') && base.type !== 'number') {
        const call = activityEntry(base, 'Lead Added', 'New lead entered after speaking')
        return saveLead(
          { ...base, calls: [call], callCount: 1, lastCall: call.at, lastOutcome: 'Lead Added', status: base.status === 'New' ? 'Contacted' : base.status },
          { ...call, leadId: base.id, name: base.name, phone: base.phone }
        )
      }
      return saveLead(base)
    },
    [saveLead]
  )

  const DETAIL_KEYS = ['type', 'name', 'altPhone', 'email', 'company', 'bizType', 'area', 'hub', 'source', 'priority', 'status', 'investment', 'vehicle', 'coldStorage', 'experience', 'dailyQty', 'notes', 'contactName', 'address', 'mapUrl', 'lat', 'lng', 'lastOrderOn', 'stopReason', 'monthlyQty']
  const saveDetails = useCallback(
    (prev, data) => {
      const s = sessionRef.current
      const changed = DETAIL_KEYS.some((k) => String(prev[k] ?? '') !== String(data[k] ?? ''))
      if (!s || s.role === 'admin' || !changed) return saveLead(data)
      const call = activityEntry(prev, 'Details Updated', 'Lead details updated')
      const first = call.first
      return saveLead(
        {
          ...data,
          calls: [call, ...(prev.calls || [])],
          callCount: first ? 1 : prev.callCount,
          lastCall: first ? call.at : prev.lastCall,
          lastOutcome: first ? 'Details Updated' : prev.lastOutcome,
          status: first && data.status === 'New' && data.type !== 'number' ? 'Contacted' : data.status,
        },
        { ...call, leadId: prev.id, name: data.name, phone: data.phone }
      )
    },
    [saveLead]
  )

  const logCall = useCallback(
    (lead, { outcome, remark, next, status, priority, duration, extra, visit, mode, rating }) => {
      const o = OUTCOMES.find((x) => x.id === outcome)
      const newStatus = status || o?.status || lead.status
      // a field person's entry is a physical 'visit' or a phone 'call'; callers only ever call
      const m = visit ? 'visit' : mode || (sessionRef.current?.role === 'field' ? 'visit' : '')
      const call = {
        id: uid(), at: nowISO(), outcome, remark: remark || '', next: next || '',
        by: sessionRef.current?.name || settingsRef.current.name || '', duration: duration || 0,
        ...(m ? { mode: m } : {}),
        ...(visit && visit.lat != null ? { lat: visit.lat, lng: visit.lng } : {}),
        ...(rating ? { rating } : {}),
      }
      const updated = {
        ...lead,
        ...(extra || {}),
        calls: [call, ...(lead.calls || [])],
        callCount: (lead.callCount || 0) + 1,
        lastCall: call.at,
        lastOutcome: outcome,
        lastRemark: remark || lead.lastRemark || '',
        status: newStatus,
        priority: priority || lead.priority,
        ...(rating ? { rating } : {}),
        nextFollowUp: CLOSED.includes(newStatus) ? '' : next || '',
      }
      if (pendingRef.current?.leadId === lead.id) writePending(null)
      return saveLead(updated, { ...call, leadId: lead.id, name: lead.name, phone: lead.phone, area: lead.area || '' })
    },
    [saveLead, writePending]
  )

  const convertLead = useCallback((lead, type) => saveLead({ ...lead, type }), [saveLead])

  const snooze = useCallback((lead, iso) => saveLead({ ...lead, nextFollowUp: iso }), [saveLead])

  // returns false (and surfaces the popup) when another call is still unclosed
  const startCall = useCallback((lead) => {
    const p = pendingRef.current
    if (p && p.leadId !== lead.id) { writePending({ ...p, away: true, at: Math.min(p.at, Date.now() - 3000) }); setPendingSnooze(0); return false }
    writePending({ leadId: lead.id, at: Date.now(), away: false })
    setPendingSnooze(0)
    return true
  }, [writePending])
  const clearPending = useCallback(() => { writePending(null); setPendingSnooze(0) }, [writePending])
  const snoozePending = useCallback((mins = 10) => setPendingSnooze(Date.now() + mins * 60000), [])
  const reopenPending = useCallback(() => setPendingSnooze(0), [])

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
        .map((l) => ({ ...l, assignedTo, assignedName: name, assignedAt: assignedTo ? nowISO() : '', _synced: false }))
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
        .map((l) => {
          const to = pm.get(l.id) || ''
          return { ...l, assignedTo: to, assignedName: names.get(to) || '', assignedAt: to ? (to === l.assignedTo && l.assignedAt ? l.assignedAt : ts) : '', updatedAt: ts, _synced: false }
        })
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

  /* ---------- lapsed hotels: import + bulk assign to a caller and/or a field person ---------- */
  const importHotels = useCallback((arr) => {
    const key = (l) => `${(l.name || '').toLowerCase()}|${l.phone || (l.area || '').toLowerCase()}`
    const have = new Set(leadsRef.current.filter((l) => l.type === 'hotel').map(key))
    const fresh = arr.filter((l) => !have.has(key(l))).map((l) => ({ ...l, _synced: false }))
    setLeads((p) => [...fresh, ...p])
    ;(async () => { for (let i = 0; i < fresh.length; i += 200) await post({ action: 'bulk', leads: fresh.slice(i, i + 200).map(strip) }) })()
    return { added: fresh.length, skipped: arr.length - fresh.length }
  }, [post])

  // callerId / fieldId: undefined = leave as is, '' = unassign, id = assign. Also turns an existing lead into a hotel lead.
  const assignHotels = useCallback(async (ids, { callerId, fieldId }) => {
    const nm = new Map(callersRef.current.map((c) => [c.id, c.name])), ts = nowISO(), set = new Set(ids)
    const changed = leadsRef.current.filter((l) => set.has(l.id)).map((l) => {
      const o = { ...l, type: 'hotel', updatedAt: ts, _synced: false }
      if (callerId !== undefined) Object.assign(o, { assignedTo: callerId, assignedName: nm.get(callerId) || '', assignedAt: callerId ? ts : '' })
      if (fieldId !== undefined) Object.assign(o, { fieldId, fieldName: nm.get(fieldId) || '', fieldAt: fieldId ? ts : '' })
      return o
    })
    const cm = new Map(changed.map((l) => [l.id, l]))
    setLeads((prev) => prev.map((l) => cm.get(l.id) || l))
    for (let i = 0; i < changed.length; i += 200) await post({ action: 'bulk', leads: changed.slice(i, i + 200).map(strip) })
    return changed.length
  }, [post])

  /* ---------- Gmail for follow-up e-mails (asked once, at first login) ---------- */
  const saveEmail = useCallback(async (email) => {
    const j = await post({ action: 'setEmail', email })
    if (!j?.ok) return false
    setSession((s) => (s ? { ...s, email: j.email } : s))
    setSettings((s) => ({ ...s, email: j.email }))
    return true
  }, [post])

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
    route, page, sub, go, sheet, openLead, openForm, closeSheet,
    filter, setFilter, toasts, toast,
    pendingCall, pendingSnooze, startCall, clearPending, snoozePending, reopenPending,
    saveLead, addLead, saveDetails, logCall, convertLead, snooze, removeLead, importLeads, clearAll, loadSample,
    assignMany, saveCaller, deleteCaller, importHotels, assignHotels, saveEmail,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
