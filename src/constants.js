// Google Sheets database (Apps Script web app). Pre-connected so every device syncs out of the box.
export const DEFAULT_SHEET_URL =
  'https://script.google.com/macros/s/AKfycbySlGcDZptwE-05H23eaETa46hmPqm7nr4j2HuOflHt8ncAbqlg7KY8DORxS_xplZlZ/exec'

// earlier built-in links: devices that saved one of these are moved to the current link automatically
export const OLD_DEFAULT_URLS = [
  'https://script.google.com/macros/s/AKfycbzc8LGHco2SuXeW__9H_1XvQoReiENNgLrKqlkb3K95LgMRnXmC2gqG6s3BDArWP9ae/exec',
  'https://script.google.com/macros/s/AKfycbw3VwukLC5ubGIMSSjJdRt7Hrmi2O3cXgd6CjWdttmdRcKhNUtYl2cY6AVAnyo-Q8UN/exec',
  'https://script.google.com/macros/s/AKfycbwLRUpFSEClEwRDfA5BXPGVC84bUjWTqv4bmHGymsOM-dbAwbp4ew0zNErGJ5jdpr2O/exec',
  'https://script.google.com/macros/s/AKfycbw_fro52ZWzxQGlo1kffD-EHRCww-x0AJUNKNpHDHW_0j_CdQSfOMf30ILAQKXiwML4/exec',
  'https://script.google.com/macros/s/AKfycbwIIIrzDSfnMOkwjNsp9eQyKGjW7yr2v3Il_5W0Wk1YQPkDT-BbWPlGpAcP-ApLHUwk/exec',
  'https://script.google.com/macros/s/AKfycbw8JElN_TcdqQd0MBcKxIBPDdEyzyNjE-Hlqtp1QbfhPUz-j0nhuZB8sx9luXzrHIM/exec',
  'https://script.google.com/macros/s/AKfycbwvMHU72oS5Q9A_w6qIkjO2khwC3bAxrfv3eFr0IYdb8Y0YdAIckm3_atSjW4sI57MS/exec',
  'https://script.google.com/macros/s/AKfycbymro0Y-iDp4skwJhZxXjkaE0eHNCzJL6-f3bQZqAqRw6Ort3JS0tD-T8gVT0qqsxpf/exec',
  'https://script.google.com/macros/s/AKfycbyQPgJCPM_tqtgrS6PeYlGcCHiGsftg6xMfnlX5H1gabv8eES68E9mgykacIiw7E3LP/exec',
  'https://script.google.com/macros/s/AKfycbynKeLY0Ce0E8C4O0tDdr8mo7GsDaueXhEnHfliCpBZp7MvFXWPoN8z8FmJ4ebxi8_-/exec',
  'https://script.google.com/macros/s/AKfycbxRyPPP-1b3oRUQ904N7WRQSuT4AXaS5TtJeZH3ppPjKTBpwWp9Bl24bU_fiU2DRhwV/exec',
  'https://script.google.com/macros/s/AKfycby9c3rA4V35IkB954ZQ7qXS1Te_zEXSafmE_xFm5ybBBCvepAD3dqnfYn0S6BBWBou-/exec',
  'https://script.google.com/macros/s/AKfycbwcpZISpv4NPwf2NrHyUPILu6S-D9ELrLOeAU3ez6Io4p0ifJbEOnfVRmlpws8v24rj/exec',
  'https://script.google.com/macros/s/AKfycbwSFeTVJNc_3N4GHIOd4VO_mp_6WmThIKgxaITbo8wX5uVo0gZKMJhjyUp9KZfepj7V/exec',
  'https://script.google.com/macros/s/AKfycbxPmGNogY5SxytQZFtjhl1n2xOE-rKv_lokoECuTzW8qP5xCRAgbxPRa5XJ09CPk1q3/exec',
  'https://script.google.com/macros/s/AKfycbzElbaavb4TLrgU7a_OLeyS7yHZe7KtPt-e3tGjcAgF_VXgdIzlyCxqzAB3ieeojFN5/exec',
]

export const STATUSES = [
  { id: 'New', color: '#64748b' },
  { id: 'Contacted', color: '#0ea5e9' },
  { id: 'Interested', color: '#f59e0b' },
  { id: 'Meeting Fixed', color: '#8b5cf6' },
  { id: 'Documentation', color: '#14b8a6' },
  { id: 'Onboarded', color: '#16a34a' },
  { id: 'Not Interested', color: '#ef4444' },
  { id: 'Not Reachable', color: '#94a3b8' },
  { id: 'Reactivated', color: '#059669' },
]

export const CLOSED = ['Onboarded', 'Not Interested', 'Reactivated']

export const OUTCOMES = [
  { id: 'Interested', icon: '🔥', status: 'Interested', connected: true },
  { id: 'Call Back Later', icon: '⏰', status: 'Contacted', connected: true },
  { id: 'Meeting Fixed', icon: '🤝', status: 'Meeting Fixed', connected: true },
  { id: 'Onboarded', icon: '🎉', status: 'Onboarded', connected: true },
  { id: 'Not Answered', icon: '📵', status: null, connected: false },
  { id: 'Busy', icon: '⏳', status: null, connected: false },
  { id: 'Not Interested', icon: '👎', status: 'Not Interested', connected: true },
  { id: 'Wrong Number', icon: '❌', status: 'Not Reachable', connected: false },
  { id: 'No Response', icon: '☎️', status: null, connected: false },
  { id: 'Switched Off', icon: '📴', status: null, connected: false },
  { id: 'Not Reachable', icon: '🚫', status: null, connected: false },
  { id: 'Wrong Audience', icon: '🎯', status: 'Not Interested', connected: true },
  { id: 'Other', icon: '✏️', status: null, connected: true },
  // lapsed-hotel win-back outcomes (shown only on hotel leads)
  { id: 'Order Restarted', icon: '🎉', status: 'Reactivated', connected: true, hotel: true },
  { id: 'Will Order Soon', icon: '🕒', status: 'Interested', connected: true, hotel: true },
  { id: 'Revisit Needed', icon: '🔁', status: 'Contacted', connected: true, hotel: true },
  { id: 'Owner Not Available', icon: '🚪', status: null, connected: false, hotel: true },
  { id: 'Hotel Closed', icon: '🏚️', status: 'Not Interested', connected: true, hotel: true },
  { id: 'Visited', icon: '📍', status: 'Contacted', connected: true, hotel: true },
  { id: 'Checked In', icon: '✅', status: null, connected: true, hidden: true },
  // automatic activity entries (not offered in the outcome picker)
  { id: 'Details Updated', icon: '📝', status: null, connected: true, hidden: true },
  { id: 'Lead Added', icon: '➕', status: null, connected: true, hidden: true },
]

// outcomes offered for a bare number (before the caller knows who it is)
export const NUMBER_OUTCOMES = ['No Response', 'Switched Off', 'Not Reachable', 'Busy', 'Wrong Number', 'Call Back Later', 'Wrong Audience', 'Other']
export const NUMBER_ONLY = ['No Response', 'Switched Off', 'Not Reachable']

// who she actually reached when the lead was the wrong audience
export const AUDIENCES = [
  { id: 'Household / Individual', icon: '🏠' }, { id: 'Student / Job seeker', icon: '🎓' },
  { id: 'Hotel / Restaurant', icon: '🍽️' }, { id: 'Kirana / Retailer', icon: '🏪' },
  { id: 'Already a distributor', icon: '🚚' }, { id: 'Company / Office', icon: '🏢' },
  { id: 'Other', icon: '✏️' },
]

export const HOTEL_OUTCOMES = ['Order Restarted', 'Will Order Soon', 'Revisit Needed', 'Owner Not Available', 'Visited', 'Hotel Closed', 'Interested', 'Not Interested', 'Not Answered', 'Busy', 'Other']
export const STOP_REASONS = ['Quality issue', 'Price too high', 'Delivery delays', 'Payment / credit issue', 'Switched to competitor', 'Low demand', 'Owner changed', 'Hotel closed', 'Other']
export const PRIORITIES = ['Cold', 'Warm', 'Hot']

export const AREAS = [
  'Whitefield', 'Marathahalli', 'Electronic City', 'HSR Layout', 'BTM Layout', 'Jayanagar',
  'Indiranagar', 'Koramangala', 'Yelahanka', 'Hebbal', 'Rajajinagar', 'Malleshwaram',
  'Vijayanagar', 'Basavanagudi', 'JP Nagar', 'Banashankari', 'KR Puram', 'Bommanahalli',
  'Kengeri', 'Peenya', 'Nagarbhavi', 'Sarjapur Road', 'Bellandur', 'Hennur', 'Jalahalli',
  'Mahadevapura', 'Bannerghatta Road', 'Hosur Road', 'Yeshwanthpur', 'RT Nagar',
]

export const SOURCES = [
  'Company Data', 'Field visit', 'Referral', 'Walk-in', 'Facebook / Instagram',
  'JustDial / IndiaMART', 'Cold Call', 'Existing Customer', 'Other',
]

export const BIZ_TYPES = [
  'Existing Distributor', 'Wholesaler', 'Kirana / General Store', 'Supermarket',
  'Milk Parlour', 'Hotel / Restaurant', 'Cold Storage / Dealer', 'Entrepreneur (New)', 'Other',
]

export const INVEST = ['Below ₹50,000', '₹50,000 – ₹1 Lakh', '₹1 – 3 Lakh', 'Above ₹3 Lakh']

export const QUICK_REMARKS = {
  number: [
    'Ringing - no response', 'Switched off', 'Out of coverage area',
    'Call disconnected', 'Asked to call later', 'Busy tone',
  ],
  distributor: [
    'Wants to know margin', 'Has own vehicle', 'Has fridge / cold storage',
    'Asked to call in evening', 'Will discuss with family', 'Needs agreement details',
    'Already distributes another brand', 'Wants a meeting', 'Area not available',
    'Send details on WhatsApp',
  ],
  hotel: [
    'Wants better price', 'Complained about quality - fixed', 'Needs credit period', 'Will order next week',
    'Owner away - come back', 'Chef wants a sample', 'Switched supplier', 'Send details on WhatsApp',
    'Fresh sample given', 'Idly soft now - happy', 'Payment cleared', 'Delivery time fixed', 'Will restart after renovation', 'Wants smaller pack',
  ],
  sales: [
    'Wants price list', 'Will try sample', 'Stock available - call later',
    'Existing batter supplier', 'Interested in daily supply', 'Owner not available',
    'Send details on WhatsApp',
  ],
}
