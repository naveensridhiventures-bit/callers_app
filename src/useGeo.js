import { useCallback, useEffect, useState } from 'react'

let lastMe = null // shared so the next screen starts with the last known position
export const lastKnown = () => lastMe

/** live position of the field person. state: idle | loading | ok | denied | error | na */
export function useGeo({ watch = false } = {}) {
  const [me, setMe] = useState(lastMe)
  const [state, setState] = useState(lastMe ? 'ok' : 'idle')

  const apply = useCallback((p) => {
    lastMe = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, at: Date.now() }
    setMe(lastMe)
    setState('ok')
  }, [])

  const locate = useCallback(
    () =>
      new Promise((resolve) => {
        if (!navigator.geolocation) { setState('na'); return resolve(lastMe) }
        setState('loading')
        navigator.geolocation.getCurrentPosition(
          (p) => { apply(p); resolve(lastMe) },
          (e) => { setState(e.code === 1 ? 'denied' : 'error'); resolve(lastMe) },
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 }
        )
      }),
    [apply]
  )

  useEffect(() => {
    if (!watch || !navigator.geolocation) return
    const id = navigator.geolocation.watchPosition(apply, () => {}, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 })
    return () => navigator.geolocation.clearWatch(id)
  }, [watch, apply])

  return { me, state, locate }
}
