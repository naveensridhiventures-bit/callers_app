import { CLOSED } from '../constants'
import { FS } from '../fieldStatus'
import { atDay } from '../utils'

/** what a hotel currently is, in field words, from its stored status + follow-up date */
export const fieldIdOf = (status, next) => (status === 'Not Interested' ? 'notint' : next && !CLOSED.includes(status) ? 'followup' : 'visited')

/**
 * The 3 statuses a field person actually uses. Each one sets the stored status and the follow-up date together,
 * so Need follow-up always has a date and Visited / Not interested never leave a stale reminder.
 */
export default function FieldStatusPick({ status, next, onChange }) {
  const cur = fieldIdOf(status, next)
  const keep = !['New', 'Not Interested', ...CLOSED].includes(status) ? status : 'Contacted'
  const pick = (id) => {
    if (id === 'notint') onChange('Not Interested', '')
    else if (id === 'followup') onChange(keep, next || atDay(2, 11))
    else onChange(['New', 'Not Interested'].includes(status) ? 'Contacted' : status, '')
  }
  return (
    <div className="fstat" role="radiogroup" aria-label="Status">
      {['visited', 'followup', 'notint'].map((id) => (
        <button key={id} type="button" role="radio" aria-checked={cur === id} className={`${id} ${cur === id ? 'on' : ''}`} style={{ '--fc': FS[id].color, '--fb': FS[id].bg }} onClick={() => pick(id)}>
          <i>{FS[id].icon}</i><span>{FS[id].label}</span>
        </button>
      ))}
    </div>
  )
}
