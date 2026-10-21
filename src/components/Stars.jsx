const STAR = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z'

export const RATING_LABEL = ['Not rated yet', 'Not interested', 'Low interest', 'Maybe later', 'Interested', 'Very interested 🔥']
/** 4-5 stars = hot, 3 = warm, 1-2 = cold */
export const ratingToPriority = (r) => (r >= 4 ? 'Hot' : r === 3 ? 'Warm' : r >= 1 ? 'Cold' : null)

/** tap a star to rate interest; tap the same star again to clear */
export function Stars({ value = 0, onChange, size = 34 }) {
  return (
    <div className="stars" role="radiogroup" aria-label="Interest rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button type="button" key={n} className={n <= value ? 'on' : ''} onClick={() => onChange?.(n === value ? 0 : n)} aria-label={`${n} star${n > 1 ? 's' : ''}`}>
          <svg viewBox="0 0 24 24" width={size} height={size}><path d={STAR} strokeLinejoin="round" /></svg>
        </button>
      ))}
    </div>
  )
}

/** read-only small stars, e.g. on lists */
export function StarsRO({ value = 0, size = 13 }) {
  if (!value) return null
  return (
    <span className="stars ro" title={`${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <i key={n} className={n <= value ? 'on' : ''}><svg viewBox="0 0 24 24" width={size} height={size}><path d={STAR} strokeLinejoin="round" /></svg></i>
      ))}
    </span>
  )
}
