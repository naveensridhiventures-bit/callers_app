import { useMemo } from 'react'
import { useApp } from '../store'
import { inr, owingList } from '../stock'

/** "₹x to collect" strip: tap to open the Stock page */
export default function DuesBanner() {
  const { leads, go } = useApp()
  const o = useMemo(() => owingList(leads), [leads])
  if (!o.length) return null
  const late = o.filter((x) => x.s.k === 'late').length, now = o.filter((x) => ['today', 'soon'].includes(x.s.k)).length
  const tot = o.reduce((t, x) => t + x.L.outstanding, 0)
  return (
    <button type="button" className={`dues ${late ? 'late' : ''}`} onClick={() => go('stock')}>
      <i>💰</i>
      <div><b>{inr(tot)} to collect</b><small>{late ? `${late} overdue` : ''}{late && now ? ' · ' : ''}{now ? `${now} due today / tomorrow` : ''}{!late && !now ? `${o.length} on credit` : ''}</small></div>
      <em>›</em>
    </button>
  )
}
