import { useCallback, useEffect, useState } from 'react'
import { todayStr } from './ledger'
import { allPhotos, clearPhotos, delPhoto, restorePhotos } from './db'

const KEY = 'batterstock.v1'
export const COLORS = ['#0b6b4f', '#2563eb', '#d97706', '#9333ea', '#dc2626', '#0891b2', '#be185d', '#65a30d']
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

const blank = () => ({
  ready: false,
  settings: { business: 'Idli Dosa Batter', packKg: 5, ratePerKg: 40, openingStock: 0, startDate: todayStr(), vehicles: ['Vehicle 1', 'Vehicle 2'], blindCount: false },
  users: [],
  currentUserId: null,
  entries: [],
  counts: {},
  cash: {},
  audit: []
})

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...blank(), ...JSON.parse(raw) }
  } catch (e) { /* ignore */ }
  return blank()
}

export function useStore() {
  const [state, setState] = useState(load)

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)) } catch (e) { console.warn('save failed', e) }
  }, [state])

  const up = useCallback((fn) => setState((s) => fn(s)), [])
  const log = (s, text, date) => ({ audit: [{ id: uid(), ts: Date.now(), userId: s.currentUserId, date, text }, ...(s.audit || [])].slice(0, 1500) })

  const actions = {
    setup({ business, name, ratePerKg, packKg, openingStock, vehicles, pin }) {
      const id = uid()
      up((s) => ({
        ...s,
        ready: true,
        settings: { ...s.settings, business, ratePerKg, packKg, openingStock, vehicles, startDate: todayStr() },
        users: [{ id, name, color: COLORS[0], role: 'admin', pin: pin || '' }],
        currentUserId: id
      }))
    },
    addEntry(e) { up((s) => (s.counts[e.date] ? s : { ...s, entries: [...s.entries, { id: uid(), ts: Date.now(), userId: s.currentUserId, ...e }] })) },
    deleteEntry(id, reason) {
      up((s) => {
        const e = s.entries.find((x) => x.id === id)
        if (!e || s.counts[e.date]) return s
        const who = s.users.find((u) => u.id === s.currentUserId)?.name
        return {
          ...s,
          entries: s.entries.map((x) => (x.id === id ? { ...x, deleted: { by: s.currentUserId, ts: Date.now(), reason } } : x)),
          ...log(s, `Deleted ${e.type} ${e.qty} pkt${e.vehicle ? ' (' + e.vehicle + ')' : ''} – reason: ${reason}${who ? ' – by ' + who : ''}`, e.date)
        }
      })
    },
    setCount(date, qty) {
      up((s) => {
        if (qty === '' || qty == null) return s
        return {
          ...s,
          counts: { ...s.counts, [date]: { qty: Number(qty), userId: s.currentUserId, ts: Date.now() } },
          ...log(s, `Closed day – cold room count ${qty} packets`, date)
        }
      })
    },
    reopenDay(date, reason) {
      up((s) => {
        const prev = s.counts[date]
        const counts = { ...s.counts }
        delete counts[date]
        return { ...s, counts, ...log(s, `Re-opened day (was closed with count ${prev?.qty}) – reason: ${reason}`, date) }
      })
    },
    setCash(date, vehicle, amount) {
      up((s) => {
        if (s.counts[date]) return s
        const day = { ...(s.cash[date] || {}) }
        if (amount === '' || amount == null) delete day[vehicle]
        else day[vehicle] = { amount: Number(amount), userId: s.currentUserId, ts: Date.now() }
        return { ...s, cash: { ...s.cash, [date]: day }, ...log(s, `Cash for ${vehicle}: ${amount === '' ? 'cleared' : '₹' + amount}`, date) }
      })
    },
    updateSettings(patch) {
      up((s) => {
        const keys = Object.keys(patch).filter((k) => ['ratePerKg', 'packKg', 'openingStock'].includes(k) && String(patch[k]) !== String(s.settings[k]))
        let extra = {}
        if (keys.length) {
          extra = log(s, `Changed setting ${keys.map((k) => k + ' → ' + patch[k]).join(', ')}`)
          const last = (s.audit || [])[0]
          // typing digit by digit should make one log line, not many
          if (last && last.text.startsWith('Changed setting') && last.userId === s.currentUserId && Date.now() - last.ts < 60000) extra = { audit: [extra.audit[0], ...s.audit.slice(1)] }
        }
        return { ...s, settings: { ...s.settings, ...patch }, ...extra }
      })
    },
    addUser(u) { up((s) => ({ ...s, users: [...s.users, { id: uid(), color: COLORS[s.users.length % COLORS.length], role: 'staff', pin: '', ...u }] })) },
    removeUser(id) { up((s) => ({ ...s, users: s.users.filter((u) => u.id !== id) })) },
    updateUser(id, patch) { up((s) => ({ ...s, users: s.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) })) },
    switchUser(id) { up((s) => ({ ...s, currentUserId: id })) },
    async exportAll() {
      const photos = await allPhotos()
      return JSON.stringify({ app: 'batterstock', version: 1, exportedAt: new Date().toISOString(), state, photos })
    },
    async importAll(text) {
      const d = JSON.parse(text)
      if (d.app !== 'batterstock') throw new Error('This is not a Batter Stock backup file')
      await clearPhotos()
      await restorePhotos(d.photos)
      setState({ ...blank(), ...d.state })
    },
    async reset() {
      await clearPhotos()
      localStorage.removeItem(KEY)
      setState(blank())
    }
  }
  return [state, actions]
}
