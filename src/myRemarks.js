import { useCallback, useEffect, useState } from 'react'
import { useApp } from './store'

/**
 * Quick remarks a field person makes herself (for example "Credit", "Interested").
 * Saved permanently on the phone under her own login, so they are still there tomorrow,
 * after logout and after app updates. They are added to the built-in chips.
 */
const keyOf = (s) => `sridhi.myremarks.${s?.id || s?.name || 'me'}`
const read = (k) => { try { const v = JSON.parse(localStorage.getItem(k)); return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : [] } catch { return [] } }
const clean = (t) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, 60)

export function useMyRemarks() {
  const { session } = useApp()
  const key = keyOf(session)
  const [mine, setMine] = useState(() => read(key))
  useEffect(() => { setMine(read(key)) }, [key])

  const commit = useCallback((list) => {
    setMine(list)
    try { localStorage.setItem(key, JSON.stringify(list)) } catch { /* storage full or blocked */ }
  }, [key])

  /** returns 'added', 'exists' or 'empty' */
  const add = useCallback((text) => {
    const t = clean(text)
    if (!t) return 'empty'
    if (read(key).some((x) => x.toLowerCase() === t.toLowerCase())) return 'exists'
    commit([...read(key), t])
    return 'added'
  }, [key, commit])
  const remove = useCallback((text) => commit(read(key).filter((x) => x !== text)), [key, commit])

  return { mine, add, remove }
}
