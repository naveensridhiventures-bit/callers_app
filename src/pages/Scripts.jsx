import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useApp } from '../store'
import { Icon } from '../ui'

const SECTIONS = [
  {
    id: 'open', icon: '🎙', title: 'Opening pitch - Distributor',
    body: [
      'Namaste {name} ji, I am {me} calling from Sridhi Idli & Dosa Batter. Do you have 2 minutes?',
      'We are looking for distributors in Bengaluru for our Premium Idli & Dosa Batter - from the experts at a leading industrial idli batter manufacturer.',
      'Our batter is naturally fermented, made with RO purified water and has no preservatives - soft idlies and crispy dosas every time.',
      'May I ask which area you operate in, and do you currently distribute any food or dairy products?',
    ],
  },
  {
    id: 'usp', icon: '🌿', title: 'Product points to mention',
    chips: ['Soft idlies & crispy dosas', 'No preservatives', 'RO purified water', 'Naturally fermented', '100% natural', 'From a leading industrial idli batter manufacturer'],
  },
  {
    id: 'qual', icon: '🎯', title: 'Qualifying questions',
    body: [
      'Which area of Bengaluru do you cover? How many retail outlets do you serve?',
      'Do you have your own vehicle / delivery arrangement?',
      'Do you have fridge or cold storage? (Batter is a fresh product)',
      'What products do you distribute at present? Any experience in dairy, bakery or fresh food?',
      'What investment are you comfortable with to start? When can you start?',
    ],
  },
  {
    id: 'obj', icon: '🛡', title: 'Objection handling',
    qa: [
      ['"What is the margin?"', 'Share the margin as per company policy: "[margin]". Offer to send the scheme details on WhatsApp and fix a meeting with the sales manager.'],
      ['"I already distribute another batter brand."', 'Respect that. Ask what they like / dislike about it. Highlight no preservatives, RO water and natural fermentation. Ask if they would try Sridhi in one area / route first.'],
      ['"I need to think / discuss with family."', 'Fine - fix a specific follow-up: "Shall I call you tomorrow at 11 AM?" Send the brochure on WhatsApp now.'],
      ['"It is a fresh product - wastage risk."', 'Explain the delivery cycle and return / replacement policy: "[company policy]". Suggest starting with a small trial order.'],
      ['"My area is already covered."', 'Check the nearby localities and note them. Offer to register him as a priority for upcoming areas.'],
    ],
  },
  {
    id: 'close', icon: '🤝', title: 'Closing the call',
    body: [
      'Fix the next step before hanging up: meeting date / documents / agreement.',
      '"Shall I send our details on WhatsApp? And can we meet on [day] at [time]?"',
      'Log the call immediately: outcome + remark + next follow-up date.',
    ],
  },
  {
    id: 'sales', icon: '🛒', title: 'Retailer pitch (Sales)',
    body: [
      'Namaste {name} ji, I am {me} from Sridhi Idli & Dosa Batter. We supply fresh, naturally fermented batter to stores in your area.',
      'No preservatives, RO purified water - customers get soft idlies and crispy dosas every time.',
      'How many packets of batter do you sell per day currently? Which brand do you stock?',
      'Can I send our price list on WhatsApp and arrange a trial supply?',
    ],
  },
]

const TEMPLATES = [
  ['First WhatsApp (Distributor)', 'Hi {name}, this is {me} from *Sridhi Premium Idli & Dosa Batter* 🌿\n\nWe are appointing distributors in Bengaluru.\n✅ No preservatives\n✅ RO purified water\n✅ Naturally fermented\n✅ Soft idlies & crispy dosas\n\nCan we speak at a convenient time?'],
  ['After call - details', 'Hi {name}, thank you for speaking with me today. As discussed, I am sharing the Sridhi distributorship details. Please let me know a good time for our next call.'],
  ['Meeting reminder', 'Hi {name}, a gentle reminder about our meeting on [date] at [time] at [place]. Looking forward to meeting you! - {me}, Sridhi'],
  ['Retailer - price list', 'Hi {name}, thank you for your interest in Sridhi Idli & Dosa Batter. Sharing our price list. Happy to arrange a trial supply for your store. - {me}'],
]

export default function Scripts() {
  const { settings, toast } = useApp()
  const [open, setOpen] = useState('open')
  const me = settings.name || '[your name]'
  const fill = (t) => t.replace(/{name}/g, '[name]').replace(/{me}/g, me)
  const copy = (t) => { navigator.clipboard?.writeText(fill(t)); toast('Copied ✓') }

  return (
    <div className="sub">
      <p className="mini-note">Edit the placeholders in [brackets] with your company's current offer before sharing. Tap a line to copy.</p>
      {SECTIONS.map((s, i) => (
        <motion.div key={s.id} className="acc" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
          <button className="acc-h" onClick={() => setOpen(open === s.id ? '' : s.id)}>
            <em>{s.icon}</em><b>{s.title}</b>
            <motion.span animate={{ rotate: open === s.id ? 90 : 0 }}><Icon name="chevron" size={18} /></motion.span>
          </button>
          <AnimatePresence initial={false}>
            {open === s.id && (
              <motion.div className="acc-b" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                {s.body?.map((l, j) => <p key={j} className="say" onClick={() => copy(l)}>{fill(l)}</p>)}
                {s.chips && <div className="chips">{s.chips.map((c) => <span key={c} className="chip on">{c}</span>)}</div>}
                {s.qa?.map(([q, a]) => <div key={q} className="qa"><b>{q}</b><p>{a}</p></div>)}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ))}

      <h3 className="sub-h">WhatsApp templates</h3>
      {TEMPLATES.map(([t, body]) => (
        <div key={t} className="tpl">
          <div><b>{t}</b><button onClick={() => copy(body)}><Icon name="copy" size={16} /> Copy</button></div>
          <pre>{fill(body)}</pre>
        </div>
      ))}
    </div>
  )
}
