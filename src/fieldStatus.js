import { CLOSED } from './constants'
import { reasonsOf } from './cancelled'
import { hotelPoint } from './utils'

/**
 * The only statuses a field person needs, worked out from what actually happened at the hotel:
 *   Not interested  - they said no, or the hotel is closed
 *   Need follow-up  - a return visit is promised (a follow-up date is set)
 *   Visited         - she went, and nothing more is pending
 *   To visit        - not visited yet
 */
export const FIELD_STATUS = [
  { id: 'followup', label: 'Need follow-up', short: 'Follow-up', icon: '⏰', color: '#b45309', bg: '#fef3c7' },
  { id: 'visited', label: 'Visited', short: 'Visited', icon: '✅', color: '#15803d', bg: '#dcfce7' },
  { id: 'notint', label: 'Not interested', short: 'Not interested', icon: '🚫', color: '#b91c1c', bg: '#fee2e2' },
  { id: 'todo', label: 'To visit', short: 'To visit', icon: '○', color: '#64748b', bg: '#eef2f6' },
]
export const FS = Object.fromEntries(FIELD_STATUS.map((s) => [s.id, s]))

const VISIT_DONE = ['Visited', 'Order Restarted', 'Will Order Soon', 'Interested', 'Revisit Needed', 'Owner Not Available']
const NOT_INT = ['Not Interested', 'Hotel Closed']

export function fieldStatusOf(l) {
  if (l.status === 'Not Interested' || NOT_INT.includes(l.lastOutcome)) return FS.notint
  if (l.nextFollowUp && !CLOSED.includes(l.status)) return FS.followup
  const visited = VISIT_DONE.includes(l.lastOutcome) || (l.calls || []).some((c) => c.mode === 'visit' && c.outcome !== 'Checked In')
  return visited ? FS.visited : FS.todo
}

/** an exact map location (lat/lng or a full Google Maps link). An area centre does not count. */
export const hasPin = (l) => !!hotelPoint(l)

/** closed hotels never need a map */
export const isClosedHotel = (l) => l.lastOutcome === 'Hotel Closed' || reasonsOf(l.stopReason).includes('closed')

/** the field person sees the map only when the admin added the exact location */
export const mapLocked = (session, l) => session?.role === 'field' && l.type === 'hotel' && !hasPin(l)
