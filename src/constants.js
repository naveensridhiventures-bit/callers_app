// Google Sheets database (Apps Script web app). Pre-connected so every device syncs out of the box.
export const DEFAULT_SHEET_URL =
  'https://script.google.com/macros/s/AKfycbzElbaavb4TLrgU7a_OLeyS7yHZe7KtPt-e3tGjcAgF_VXgdIzlyCxqzAB3ieeojFN5/exec'

export const STATUSES = [
  { id: 'New', color: '#64748b' },
  { id: 'Contacted', color: '#0ea5e9' },
  { id: 'Interested', color: '#f59e0b' },
  { id: 'Meeting Fixed', color: '#8b5cf6' },
  { id: 'Documentation', color: '#14b8a6' },
  { id: 'Onboarded', color: '#16a34a' },
  { id: 'Not Interested', color: '#ef4444' },
  { id: 'Not Reachable', color: '#94a3b8' },
]

export const CLOSED = ['Onboarded', 'Not Interested']

export const OUTCOMES = [
  { id: 'Interested', icon: '🔥', status: 'Interested', connected: true },
  { id: 'Call Back Later', icon: '⏰', status: 'Contacted', connected: true },
  { id: 'Meeting Fixed', icon: '🤝', status: 'Meeting Fixed', connected: true },
  { id: 'Onboarded', icon: '🎉', status: 'Onboarded', connected: true },
  { id: 'Not Answered', icon: '📵', status: null, connected: false },
  { id: 'Busy', icon: '⏳', status: null, connected: false },
  { id: 'Not Interested', icon: '👎', status: 'Not Interested', connected: true },
  { id: 'Wrong Number', icon: '❌', status: 'Not Reachable', connected: false },
]

export const PRIORITIES = ['Cold', 'Warm', 'Hot']

export const AREAS = [
  'Whitefield', 'Marathahalli', 'Electronic City', 'HSR Layout', 'BTM Layout', 'Jayanagar',
  'Indiranagar', 'Koramangala', 'Yelahanka', 'Hebbal', 'Rajajinagar', 'Malleshwaram',
  'Vijayanagar', 'Basavanagudi', 'JP Nagar', 'Banashankari', 'KR Puram', 'Bommanahalli',
  'Kengeri', 'Peenya', 'Nagarbhavi', 'Sarjapur Road', 'Bellandur', 'Hennur', 'Jalahalli',
  'Mahadevapura', 'Bannerghatta Road', 'Hosur Road', 'Yeshwanthpur', 'RT Nagar',
]

export const SOURCES = [
  'Company Data', 'Referral', 'Walk-in', 'Facebook / Instagram',
  'JustDial / IndiaMART', 'Cold Call', 'Existing Customer', 'Other',
]

export const BIZ_TYPES = [
  'Existing Distributor', 'Wholesaler', 'Kirana / General Store', 'Supermarket',
  'Milk Parlour', 'Hotel / Restaurant', 'Cold Storage / Dealer', 'Entrepreneur (New)', 'Other',
]

export const INVEST = ['Below ₹50,000', '₹50,000 – ₹1 Lakh', '₹1 – 3 Lakh', 'Above ₹3 Lakh']

export const QUICK_REMARKS = {
  distributor: [
    'Wants to know margin', 'Has own vehicle', 'Has fridge / cold storage',
    'Asked to call in evening', 'Will discuss with family', 'Needs agreement details',
    'Already distributes another brand', 'Wants a meeting', 'Area not available',
    'Send details on WhatsApp',
  ],
  sales: [
    'Wants price list', 'Will try sample', 'Stock available - call later',
    'Existing batter supplier', 'Interested in daily supply', 'Owner not available',
    'Send details on WhatsApp',
  ],
}
