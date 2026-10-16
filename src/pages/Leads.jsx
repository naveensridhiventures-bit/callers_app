import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useApp } from '../store'
import { Icon, Segmented } from '../ui'
import LeadCard from '../components/LeadCard'
import { STATUSES } from '../constants'
import { cleanPhone } from '../utils'

export default function Leads() {
  const { leads, filter, setFilter, openForm, session, callers } = useApp()
  const [sort, setSort] = useState('recent')
  const [limit, setLimit] = useState(40)

  const list = useMemo(() => {
    const q = filter.q.trim().toLowerCase()
    const digits = cleanPhone(filter.q)
    let r = leads.filter((l) => {
      if (filter.type !== 'all' && l.type !== filter.type) return false
      if (filter.status !== 'all' && l.status !== filter.status) return false
      if (filter.caller && filter.caller !== 'all') { if (filter.caller === 'none' ? !!l.assignedTo : l.assignedTo !== filter.caller) return false }
      if (!q) return true
      return (
        l.name?.toLowerCase().includes(q) || l.company?.toLowerCase().includes(q) ||
        l.area?.toLowerCase().includes(q) || (digits.length >= 3 && l.phone?.includes(digits))
      )
    })
    const by = {
      recent: (a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''),
      follow: (a, b) => (a.nextFollowUp || '9').localeCompare(b.nextFollowUp || '9'),
      name: (a, b) => (a.name || a.phone).localeCompare(b.name || b.phone),
      hot: (a, b) => ['Hot', 'Warm', 'Cold'].indexOf(a.priority) - ['Hot', 'Warm', 'Cold'].indexOf(b.priority),
    }
    return [...r].sort(by[sort])
  }, [leads, filter, sort])

  const set = (p) => { setFilter((f) => ({ ...f, ...p })); setLimit(40) }

  return (
    <div className="page">
      <div className="page-h">
        <h1>Leads <small>{list.length}</small></h1>
        <select className="mini-sel" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="recent">Recent</option>
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
        options={[{ value: 'all', label: 'All' }, { value: 'distributor', label: '🤝 Distributors' }, { value: 'sales', label: '🛒 Sales' }, { value: 'number', label: '📞 Numbers' }]} />

      {session?.role === 'admin' && (
        <select className="mini-sel wide-sel" value={filter.caller || 'all'} onChange={(e) => set({ caller: e.target.value })}>
          <option value="all">All callers</option>
          <option value="none">Unassigned</option>
          {callers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
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
          {list.slice(0, limit).map((l, i) => <LeadCard key={l.id} lead={l} i={i} />)}
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
