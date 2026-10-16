import { useEffect, useState } from 'react'

// "Install as app": capture the browser's install prompt as early as possible
let deferred = null
const subs = new Set()
const notify = () => subs.forEach((f) => f())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    notify()
  })
}

const standalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true)

export function useInstall() {
  const [, tick] = useState(0)
  useEffect(() => {
    const f = () => tick((x) => x + 1)
    subs.add(f)
    return () => subs.delete(f)
  }, [])
  return {
    installed: standalone(),
    canInstall: !!deferred,
    ios: /iphone|ipad|ipod/i.test(navigator.userAgent),
    install: async () => {
      if (!deferred) return false
      deferred.prompt()
      const r = await deferred.userChoice
      deferred = null
      notify()
      return r.outcome === 'accepted'
    },
  }
}
