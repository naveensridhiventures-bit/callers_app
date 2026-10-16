import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../store'
import { Counter, Icon } from '../ui'
import { RANGES, buildReport, buildWhatsApp, rangeFor, reportFileName, toInputDate } from '../reports'

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true } catch { /* fall back */ }
  const ta = document.createElement('textarea')
  ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;top:0'
  document.body.appendChild(ta); ta.focus(); ta.select()
  let ok = false
  try { ok = document.execCommand('copy') } catch { ok = false }
  ta.remove()
  return ok
}
function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
const noteKey = (kind, who) => `sridhi.eodnote.${toInputDate(new Date())}.${kind}.${who}`

// WhatsApp-style preview: *bold* and _italic_ shown the way the group will see them
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const waHtml = (t) => esc(t).replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/(^|\s)_([^_\n]+)_(?=\s|$)/g, '$1<i>$2</i>')

export default function ReportCenter({ admin = false }) {
  const { allLeads, callers, session, toast } = useApp()
  const [kind, setKind] = useState('today')
  const [from, setFrom] = useState(toInputDate(new Date()))
  const [to, setTo] = useState(toInputDate(new Date()))
  const [who, setWho] = useState('all')
  const [busy, setBusy] = useState('')
  const [note, setNote] = useState('')
  const [canShareFiles, setCanShareFiles] = useState(false)

  const range = useMemo(() => rangeFor(kind, from, to), [kind, from, to])
  const report = useMemo(
    () => buildReport({ allLeads, callers, session, range, callerId: admin ? who : session?.id }),
    [allLeads, callers, session, range, admin, who]
  )
  // the caller's own note for today is remembered on this phone
  useEffect(() => { try { setNote(localStorage.getItem(noteKey(kind, who)) || '') } catch { setNote('') } }, [kind, who])
  useEffect(() => { try { localStorage.setItem(noteKey(kind, who), note) } catch { /* ignore */ } }, [note, kind, who])
  useEffect(() => {
    try { setCanShareFiles(typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File(['x'], 'a.pdf', { type: 'application/pdf' })] })) } catch { setCanShareFiles(false) }
  }, [])

  const text = useMemo(() => buildWhatsApp(report, note), [report, note])
  const t = report.totals

  const copy = async () => toast((await copyText(text)) ? 'Report copied ✓ Paste it in the WhatsApp group' : 'Could not copy. Long-press the message to copy', 'ok')
  const shareText = async () => {
    if (navigator.share) { try { await navigator.share({ text }) } catch { /* cancelled */ } } else copy()
  }
  const makeFile = async (type) => {
    setBusy(type)
    try {
      const mod = await import('../exporters')
      const blob = type === 'pdf' ? await mod.makePDF(report) : await mod.makeXLSX(report)
      return { blob, name: reportFileName(report, type === 'pdf' ? 'pdf' : 'xlsx') }
    } catch (e) {
      console.error(e); toast('Could not create the file. Try again', 'warn'); return null
    } finally { setBusy('') }
  }
  const download = async (type) => {
    const f = await makeFile(type)
    if (f) { saveBlob(f.blob, f.name); toast(`${type === 'pdf' ? 'PDF' : 'Excel'} downloaded ✓`) }
  }
  const sharePdf = async () => {
    const f = await makeFile('pdf')
    if (!f) return
    try { await navigator.share({ files: [new File([f.blob], f.name, { type: 'application/pdf' })], title: report.meta.title }) } catch { /* cancelled */ }
  }

  const kpis = [
    ['📞', t.calls, 'Calls made'], ['✅', t.connected, `Connected · ${t.rate}%`], ['📝', t.updates, 'Details updated'],
    ['🔥', t.interested, 'Interested'], ['🤝', t.meetings, 'Meetings'], ['🎉', t.onboarded, 'Onboarded'],
  ]

  return (
    <div className="sub rc">
      <section className="card form">
        <h3>🗓 {admin ? 'Report period' : 'Which day or period?'}</h3>
        <div className="chips">
          {RANGES.map((r) => <button key={r.value} className={`chip ${kind === r.value ? 'on' : ''}`} onClick={() => setKind(r.value)}>{r.label}</button>)}
        </div>
        {kind === 'custom' && (
          <div className="grid2">
            <label className="field"><span>From</span><input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="field"><span>To</span><input type="date" value={to} min={from} max={toInputDate(new Date())} onChange={(e) => setTo(e.target.value)} /></label>
          </div>
        )}
        {admin && (
          <label className="field"><span>Caller</span>
            <select value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="all">Whole team</option>
              {callers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}
        <p className="mini-note"><b>{report.meta.title}</b> · {report.meta.rangeLabel} · {report.meta.scopeLabel}</p>
      </section>

      <div className="kpis kpis6">
        {kpis.map(([e, v, l], i) => (
          <motion.div key={l} className="kpi" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <em>{e}</em><b><Counter value={v} duration={0.6} /></b><span>{l}</span>
          </motion.div>
        ))}
      </div>

      <section className="card form">
        <h3>💬 Message for the WhatsApp group</h3>
        <div className="wa-bubble"><pre data-raw={text} dangerouslySetInnerHTML={{ __html: waHtml(text) }} /></div>
        <label className="field"><span>Add a note for management (optional)</span>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Challenges, support needed, anything to highlight…" />
        </label>
        <div className="rc-actions">
          <motion.button whileTap={{ scale: 0.97, y: 3 }} className="btn3d lime" onClick={copy}><Icon name="copy" /> Copy for WhatsApp</motion.button>
          <a className="btn-soft" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer"><Icon name="whatsapp" /> Open WhatsApp</a>
          {typeof navigator.share === 'function' && <button className="btn-soft" onClick={shareText}><Icon name="send" /> Share…</button>}
        </div>
      </section>

      <section className="card form">
        <h3>📄 Download the report</h3>
        <p className="mini-note">A professional PDF (charts, tables, call log) or an Excel workbook (Summary, By Caller, Activity Log, Highlights, Leads) for the selected period.</p>
        <div className="rc-actions">
          <motion.button whileTap={{ scale: 0.97, y: 3 }} className="btn3d" disabled={!!busy} onClick={() => download('pdf')}>
            {busy === 'pdf' ? <em className="spin" /> : <Icon name="download" />} {busy === 'pdf' ? 'Creating PDF…' : 'Download PDF'}
          </motion.button>
          <motion.button whileTap={{ scale: 0.97, y: 3 }} className="btn3d" disabled={!!busy} onClick={() => download('xlsx')}>
            {busy === 'xlsx' ? <em className="spin" /> : <Icon name="download" />} {busy === 'xlsx' ? 'Creating Excel…' : 'Download Excel'}
          </motion.button>
          {canShareFiles && <button className="btn-soft" disabled={!!busy} onClick={sharePdf}><Icon name="send" /> Share PDF on WhatsApp</button>}
        </div>
      </section>
    </div>
  )
}
