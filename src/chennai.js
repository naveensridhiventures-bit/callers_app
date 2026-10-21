import { hotelPoint, km } from './utils'

/** Field sales happen in Chennai only. */
export const FIELD_CITY = 'Chennai'

// Approximate centres of Chennai localities. Used to sort and map hotels that have no exact pin yet.
export const CHENNAI_AREAS = [
  { a: 'Adambakkam', lat: 12.9885, lng: 80.2027 }, { a: 'Adyar', lat: 13.0012, lng: 80.2565 },
  { a: 'Alandur', lat: 13.0030, lng: 80.2000 }, { a: 'Alwarpet', lat: 13.0330, lng: 80.2520 },
  { a: 'Ambattur', lat: 13.1143, lng: 80.1548 }, { a: 'Anna Nagar', lat: 13.0850, lng: 80.2101 },
  { a: 'Annanur', lat: 13.1180, lng: 80.1240 }, { a: 'Arumbakkam', lat: 13.0730, lng: 80.2120 },
  { a: 'Ashok Nagar', lat: 13.0373, lng: 80.2123 }, { a: 'Avadi', lat: 13.1067, lng: 80.0970 },
  { a: 'Besant Nagar', lat: 13.0002, lng: 80.2668 }, { a: 'Chetpet', lat: 13.0715, lng: 80.2420 },
  { a: 'Chintadripet', lat: 13.0780, lng: 80.2700 }, { a: 'Chromepet', lat: 12.9516, lng: 80.1462 },
  { a: 'Egmore', lat: 13.0732, lng: 80.2609 }, { a: 'Ekkaduthangal', lat: 13.0170, lng: 80.2050 },
  { a: 'Foreshore Estate', lat: 13.0230, lng: 80.2760 }, { a: 'George Town', lat: 13.0950, lng: 80.2890 },
  { a: 'Guindy', lat: 13.0067, lng: 80.2206 }, { a: 'Injambakkam', lat: 12.9180, lng: 80.2570 },
  { a: 'K.K. Nagar', lat: 13.0412, lng: 80.1999 }, { a: 'Kilpauk', lat: 13.0836, lng: 80.2417 },
  { a: 'Kodambakkam', lat: 13.0521, lng: 80.2255 }, { a: 'Kolathur', lat: 13.1200, lng: 80.2200 },
  { a: 'Kotturpuram', lat: 13.0100, lng: 80.2400 }, { a: 'Koyambedu', lat: 13.0694, lng: 80.1948 },
  { a: 'Madhavaram', lat: 13.1480, lng: 80.2310 }, { a: 'Madipakkam', lat: 12.9620, lng: 80.1980 },
  { a: 'Maduravoyal', lat: 13.0626, lng: 80.1706 }, { a: 'Mambalam', lat: 13.0380, lng: 80.2200 },
  { a: 'Manapakkam', lat: 13.0210, lng: 80.1620 }, { a: 'Medavakkam', lat: 12.9200, lng: 80.1920 },
  { a: 'Mogappair', lat: 13.0850, lng: 80.1750 }, { a: 'Mount Road', lat: 13.0600, lng: 80.2630 },
  { a: 'Mylapore', lat: 13.0368, lng: 80.2676 }, { a: 'Nandanam', lat: 13.0290, lng: 80.2390 },
  { a: 'Nanganallur', lat: 12.9810, lng: 80.1920 }, { a: 'Navalur', lat: 12.8450, lng: 80.2260 },
  { a: 'Nungambakkam', lat: 13.0569, lng: 80.2425 }, { a: 'Padi', lat: 13.1000, lng: 80.1850 },
  { a: 'Pallavaram', lat: 12.9675, lng: 80.1491 }, { a: 'Pallikaranai', lat: 12.9300, lng: 80.2130 },
  { a: 'Parrys', lat: 13.0930, lng: 80.2870 }, { a: 'Perambur', lat: 13.1186, lng: 80.2330 },
  { a: 'Perungudi', lat: 12.9650, lng: 80.2461 }, { a: 'Poonamallee', lat: 13.0473, lng: 80.0945 },
  { a: 'Porur', lat: 13.0382, lng: 80.1565 }, { a: 'Purasawalkam', lat: 13.0897, lng: 80.2420 },
  { a: 'Red Hills', lat: 13.1860, lng: 80.1830 }, { a: 'Royapettah', lat: 13.0525, lng: 80.2646 },
  { a: 'Royapuram', lat: 13.1037, lng: 80.2954 }, { a: 'Saidapet', lat: 13.0213, lng: 80.2231 },
  { a: 'Santhome', lat: 13.0330, lng: 80.2790 }, { a: 'Selaiyur', lat: 12.9070, lng: 80.1380 },
  { a: 'Sholinganallur', lat: 12.9010, lng: 80.2279 }, { a: 'Tambaram', lat: 12.9249, lng: 80.1000 },
  { a: 'Teynampet', lat: 13.0440, lng: 80.2500 }, { a: 'T. Nagar', lat: 13.0418, lng: 80.2341 },
  { a: 'Thiruvanmiyur', lat: 12.9830, lng: 80.2594 }, { a: 'Thiruvottiyur', lat: 13.1643, lng: 80.3010 },
  { a: 'Thoraipakkam', lat: 12.9410, lng: 80.2370 }, { a: 'Tondiarpet', lat: 13.1260, lng: 80.2900 },
  { a: 'Triplicane', lat: 13.0569, lng: 80.2780 }, { a: 'Vadapalani', lat: 13.0500, lng: 80.2121 },
  { a: 'Valasaravakkam', lat: 13.0420, lng: 80.1730 }, { a: 'Velachery', lat: 12.9815, lng: 80.2180 },
  { a: 'Villivakkam', lat: 13.1080, lng: 80.2070 }, { a: 'Virugambakkam', lat: 13.0550, lng: 80.1900 },
  { a: 'Washermanpet', lat: 13.1143, lng: 80.2870 }, { a: 'West Mambalam', lat: 13.0385, lng: 80.2200 },
  { a: 'Zamin Pallavaram', lat: 12.9560, lng: 80.1450 },
]

const key = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
const INDEX = new Map(CHENNAI_AREAS.map((x) => [key(x.a), x]))

/** the known Chennai locality for a typed area (exact first, then loose match) */
export function areaInfo(label) {
  const k = key(label)
  if (!k) return null
  if (INDEX.has(k)) return INDEX.get(k)
  if (k.length < 4) return null
  for (const [ak, v] of INDEX) if (ak.includes(k) || (ak.length >= 5 && k.includes(ak))) return v
  return null
}

/** where is this hotel? exact pin first (lat/lng or Google Maps link), else the centre of its locality */
export function pointOf(l) {
  const p = hotelPoint(l)
  if (p) return { ...p, approx: false }
  const a = areaInfo(l.area)
  return a ? { lat: a.lat, lng: a.lng, approx: true } : null
}

const ROAD = 1.35 // straight line to road distance in a city
const SPEED = 20 // km/h, typical Chennai traffic
export const roadKm = (straight) => straight * ROAD
export const etaMin = (straight) => Math.max(1, Math.round(((straight * ROAD) / SPEED) * 60))
export const fmtEta = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`)

const pathLen = (start, pts) => {
  let d = 0, cur = start
  for (const p of pts) { if (cur) d += km(cur, p); cur = p }
  return d
}

/**
 * Visiting order: nearest-neighbour from the person's position, then a 2-opt pass that removes
 * crossings so the walk/ride is short. Hotels without any location go last.
 * returns [{ l, pt, leg }]  (leg = km from the previous stop, or from the person for the first stop)
 */
export function planRoute(me, leads) {
  const all = leads.map((l) => ({ l, pt: pointOf(l) }))
  const placed = all.filter((x) => x.pt)
  const lost = all.filter((x) => !x.pt)
  let start = me && me.lat != null ? { lat: me.lat, lng: me.lng } : null
  if (!start && placed.length) start = [...placed].sort((a, b) => a.pt.lng - b.pt.lng)[0].pt // no GPS: begin at the western end

  const left = [...placed]
  let order = [], cur = start
  while (left.length) {
    let bi = 0, bd = Infinity
    left.forEach((x, i) => { const d = km(cur, x.pt); if (d < bd) { bd = d; bi = i } })
    const [x] = left.splice(bi, 1)
    order.push(x); cur = x.pt
  }

  // 2-opt: keep trying to reverse a stretch while it makes the whole route shorter
  if (order.length > 3 && order.length <= 60) {
    let improved = true, guard = 0
    while (improved && guard++ < 40) {
      improved = false
      for (let i = 0; i < order.length - 1; i++) {
        for (let j = i + 1; j < order.length; j++) {
          const cand = [...order.slice(0, i), ...order.slice(i, j + 1).reverse(), ...order.slice(j + 1)]
          if (pathLen(start, cand.map((x) => x.pt)) + 1e-9 < pathLen(start, order.map((x) => x.pt))) { order = cand; improved = true }
        }
      }
    }
  }

  let prev = start
  const out = order.map((x) => { const leg = prev ? km(prev, x.pt) : null; prev = x.pt; return { ...x, leg } })
  return [...out, ...lost.map((x) => ({ ...x, leg: null }))]
}
