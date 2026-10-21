import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useApp } from '../store'
import { Icon, Segmented } from '../ui'
import LeadCard from '../components/LeadCard'
import { STATUSES } from '../constants'
import { assignedAtOf, cleanPhone, dayKeyOf, dayLabel, isToday } from '../utils'

const ymd = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const matchDate = (l, f) => {
  if (!f || f === 'all') return true
  const a = assignedAtOf(l)
  if (!a) return false
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(a).setHours(0, 0, 0, 0)) / 864e5)
  if (f === 'today') return days === 0
  if (f === 'yesterday') return days === 1
  if (f === 'week') return days >= 0 && days < 7
  return ymd(a) === f
}

export default function Leads() {
  const { leads, filter, setFilter, openForm, session, callers } = useApp()
  const [sort, setSort] = useState(() => (session?.role === 'admin' ? 'recent' : 'assigned'))
  const [limit, setLimit] = useState(40)

  const list = useMemo(() => {
    const q = filter.q.trim().toLowerCase()
    const digits = cleanPhone(filter.q)
    let r = leads.filter((l) => {
      if (filter.type !== 'all' && l.type !== filter.type) return false
      if (filter.status !== 'all' && l.status !== filter.status) return false
      if (!matchDate(l, filter.date)) return false
      if (filter.caller && filter.caller !== 'all') { if (filter.caller === 'none' ? !!l.assignedTo : l.assignedTo !== filter.caller) return false }
      if (!q) return true
      return (
        l.name?.toLowerCase().includes(q) || l.company?.toLowerCase().includes(q) ||
        l.area?.toLowerCase().includes(q) || (digits.length >= 3 && l.phone?.includes(digits))
      )
    })
    const by = {
      assigned: (a, b) => assignedAtOf(b).localeCompare(assignedAtOf(a)),
      recent: (a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''),
      follow: (a, b) => (a.nextFollowUp || '9').localeCompare(b.nextFollowUp || '9'),
      name: (a, b) => (a.name || a.phone).localeCompare(b.name || b.phone),
      hot: (a, b) => ['Hot', 'Warm', 'Cold'].indexOf(a.priority) - ['Hot', 'Warm', 'Cold'].indexOf(b.priority),
    }
    return [...r].sort(by[sort])
  }, [leads, filter, sort])

  const counts = useMemo(() => ({
    today: leads.filter((l) => matchDate(l, 'today')).length,
    yesterday: leads.filter((l) => matchDate(l, 'yesterday')).length,
    week: leads.filter((l) => matchDate(l, 'week')).length,
  }), [leads])
  const newToday = useMemo(() => leads.filter((l) => matchDate(l, 'today') && !l.callCount).length, [leads])
  const picked = filter.date && !['all', 'today', 'yesterday', 'week'].includes(filter.date) ? filter.date : ''

  const set = (p) => { setFilter((f) => ({ ...f, ...p })); setLimit(40) }

  return (
    <div className="page">
      <div className="page-h">
        <h1>Leads <small>{list.length}</small></h1>
        <select className="mini-sel" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="assigned">Newly assigned</option>
          <option value="recent">Recently updated</option>
          <option value="follow">Follow-up</option>
          <option value="hot">Hot first</option>
          <option value="name">A → Z</option>
        </select>
      </div>

      <div className="search">
        <Icon name="search" size={18} />
        <input value={filter.q} onChange={(e) => set({ q: e.target.value })} placeholder="Search name, phone, area, shop…" />
        {filter.q && <button onClick={() => set({ q: '' })}><Icon name="x" size={16} /></button>}
      </div>

      <Segmented id="lead-type" value={filter.type} onChange={(v) => set({ type: v })}
        options={[{ value: 'all', label: 'All' }, { value: 'distributor', label: '🤝 Distributors' }, { value: 'sales', label: '🛒 Sales' }, { value: 'number', label: '📞 Numbers' }, ...(leads.some((l) => l.type === 'hotel') ? [{ value: 'hotel', label: '🏨 Hotels' }] : [])]} />

      {session?.role === 'admin' && (
        <select className="mini-sel wide-sel" value={filter.caller || 'all'} onChange={(e) => set({ caller: e.target.value })}>
          <option value="all">All callers</option>
          <option value="none">Unassigned</option>
          {callers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}

      <div className="chips scroll datechips">
        <button className={`chip ${!filter.date || filter.date === 'all' ? 'on' : ''}`} onClick={() => set({ date: 'all' })}>📅 All dates</button>
        <button className={`chip ${filter.date === 'today' ? 'on' : ''}`} onClick={() => set({ date: 'today' })}>Today {counts.today > 0 && <b>{counts.today}</b>}</button>
        <button className={`chip ${filter.date === 'yesterday' ? 'on' : ''}`} onClick={() => set({ date: 'yesterday' })}>Yesterday {counts.yesterday > 0 && <b>{counts.yesterday}</b>}</button>
        <button className={`chip ${filter.date === 'week' ? 'on' : ''}`} onClick={() => set({ date: 'week' })}>This week {counts.week > 0 && <b>{counts.week}</b>}</button>
        <label className={`chip datepick ${picked ? 'on' : ''}`}>
          {picked ? new Date(`${picked}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Pick date'}
          <input type="date" value={picked} max={ymd(new Date())} onChange={(e) => set({ date: e.target.value || 'all' })} />
        </label>
      </div>

      {newToday > 0 && (!filter.date || filter.date === 'all') && (
        <button className="new-banner" onClick={() => set({ date: 'today' })}>🆕 <b>{newToday} new lead{newToday > 1 ? 's' : ''}</b> assigned today. Tap to see them</button>
      )}

      <div className="chips scroll">
        {[{ id: 'all' }, ...STATUSES].map((s) => (
          <button key={s.id} className={`chip ${filter.status === s.id ? 'on' : ''}`} onClick={() => set({ status: s.id })}>
            {s.id === 'all' ? 'All status' : s.id}
          </button>
        ))}
      </div>

      <div className="list">
        <AnimatePresence initial={false}>
          {list.slice(0, limit).flatMap((l, i, arr) => {
            const out = []
            if (sort === 'assigned') {
              const k = dayKeyOf(assignedAtOf(l))
              if (i === 0 || k !== dayKeyOf(assignedAtOf(arr[i - 1]))) {
                const group = list.filter((x) => dayKeyOf(assignedAtOf(x)) === k)
                const fresh = group.filter((x) => !x.callCount).length
                out.push(<div key={`h-${k}`} className="day-h"><b>{dayLabel(assignedAtOf(l))}</b><span>{group.length} lead{group.length > 1 ? 's' : ''}{fresh ? ` · ${fresh} not called yet` : ''}</span></div>)
              }
            }
            out.push(<LeadCard key={l.id} lead={l} i={i} />)
            return out
          })}
        </AnimatePresence>
      </div>

      {list.length === 0 && (
        <motion.div className="card empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="empty-ico">🔍</div>
          <h3>{leads.length ? 'No leads match' : 'No leads yet'}</h3>
          <button className="btn3d" onClick={() => openForm()}><Icon name="plus" /> Add a lead</button>
        </motion.div>
      )}
      {list.length > limit && <button className="btn-soft wide" onClick={() => setLimit((l) => l + 60)}>Show more ({list.length - limit})</button>}
    </div>
  )
}
