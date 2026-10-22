import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../store'
import { Counter, Icon, Segmented } from '../ui'
import { StarsRO } from '../components/Stars'
import { RANGES, buildFieldReport, buildFieldWhatsApp, fieldFileName, areaOfLead, rangeFor, toInputDate } from '../fieldReport'
import { fmtDay } from '../reports'
import { useQuickRemark } from '../components/QuickRemark'
import { fmtTime } from '../utils'

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
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const waHtml = (t) => esc(t).replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/(^|\s)_([^_\n]+)_(?=\s|$)/g, '$1<i>$2</i>')

/** Visits and calls for a day or period, filterable by Chennai area, downloadable as PDF / Excel / CSV. */
export default function FieldReport() {
  const { leads, session, toast } = useApp()
  const [kind, setKind] = useState('today')
  const [from, setFrom] = useState(toInputDate(new Date()))
  const [to, setTo] = useState(toInputDate(new Date()))
  const [area, setArea] = useState('all')
  const [mode, setMode] = useState('all')
  const [busy, setBusy] = useState('')
  const [note, setNote] = useState('')
  const [openDays, setOpenDays] = useState(null) // null = newest day open
  const quick = useQuickRemark()

  const hotels = useMemo(() => leads.filter((l) => l.type === 'hotel'), [leads])
  const range = useMemo(() => ({ ...rangeFor(kind, from, to), title: 'Field Sales Report' }), [kind, from, to])
  const allAreas = useMemo(() => [...new Set(hotels.map(areaOfLead))].sort((a, b) => a.localeCompare(b)), [hotels])
  const report = useMemo(() => buildFieldReport({ leads: hotels, session, range, area, mode }), [hotels, session, range, area, mode])
  const t = report.totals
  const text = useMemo(() => buildFieldWhatsApp(report, note), [report, note])

  const key = `sridhi.fieldnote.${toInputDate(new Date())}.${kind}`
  useEffect(() => { try { setNote(localStorage.getItem(key) || '') } catch { setNote('') } }, [key])
  useEffect(() => { try { localStorage.setItem(key, note) } catch { /* ignore */ } }, [note, key])

  const copy = async () => toast((await copyText(text)) ? 'Report copied ✓ Paste it in the WhatsApp group' : 'Could not copy. Long-press the message to copy')
  const build = async (type, rep) => {
    const mod = await import('../fieldExport')
    const blob = type === 'pdf' ? await mod.makeFieldPDF(rep) : type === 'xlsx' ? await mod.makeFieldXLSX(rep) : mod.makeFieldCSV(rep)
    saveBlob(blob, fieldFileName(rep, type))
    toast(`${type === 'pdf' ? 'PDF' : type === 'xlsx' ? 'Excel' : 'CSV'} downloaded ✓`)
  }
  const make = async (type) => {
    setBusy(type)
    try { await build(type, report) } catch (e) { console.error(e); toast('Could not create the file. Try again', 'warn') } finally { setBusy('') }
  }
  /** download just one date */
  const makeDay = async (type, day) => {
    setBusy(`${type}-${day.key}`)
    try { await build(type, buildFieldReport({ leads: hotels, session, range: { ...rangeFor('custom', day.key, day.key), title: 'Daily Report' }, area, mode })) }
    catch (e) { console.error(e); toast('Could not create the file. Try again', 'warn') } finally { setBusy('') }
  }
  const days = useMemo(() => [...report.byDay].reverse(), [report])
  const isOpen = (k, i) => (openDays ? openDays.includes(k) : i === 0)
  const toggleDay = (k, i) => setOpenDays((cur) => { const base = cur || (days[0] ? [days[0].key] : []); return base.includes(k) ? base.filter((x) => x !== k) : [...base, k] })

  const kpis = [['📍', t.visits, 'Visits'], ['📞', t.calls, 'Calls'], ['🏨', t.hotels, 'Hotels reached'], ['🔥', t.hot, 'Interested'], ['🎉', t.orders, 'Orders restarted'], ['🗺', t.areas, 'Areas covered']]

  return (
    <div className="page">
      <div className="page-h"><h1>Field report</h1></div>
      <div className="sub rc">
        <section className="card form">
          <h3>🗓 Which day or period?</h3>
          <div className="chips">
            {RANGES.map((r) => <button key={r.value} className={`chip ${kind === r.value ? 'on' : ''}`} onClick={() => setKind(r.value)}>{r.label}</button>)}
          </div>
          {kind === 'custom' && (
            <div className="grid2">
              <label className="field"><span>From</span><input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
              <label className="field"><span>To</span><input type="date" value={to} min={from} max={toInputDate(new Date())} onChange={(e) => setTo(e.target.value)} /></label>
            </div>
          )}
          <label className="field"><span>Chennai area</span>
            <select value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="all">All areas</option>
              {allAreas.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <Segmented id="fr-mode" value={mode} onChange={setMode} options={[{ value: 'all', label: 'Visits + calls' }, { value: 'visit', label: '📍 Visits' }, { value: 'call', label: '📞 Calls' }]} />
          <p className="mini-note"><b>{report.meta.title}</b> · {report.meta.rangeLabel} · {report.meta.areaLabel}</p>
        </section>

        <div className="kpis kpis6">
          {kpis.map(([e, v, l], i) => (
            <motion.div key={l} className="kpi" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <em>{e}</em><b><Counter value={v} duration={0.6} /></b><span>{l}</span>
            </motion.div>
          ))}
          <div className="kpi"><em>⭐</em><b>{t.avgRating || '-'}</b><span>Average interest</span></div>
        </div>

        {report.byArea.length > 0 && (
          <section className="card form">
            <h3>🗺 Area-wise</h3>
            <div className="fr-areas">
              {report.byArea.map((a) => (
                <button key={a.area} className={`fr-area ${area === a.area ? 'on' : ''}`} onClick={() => setArea(area === a.area ? 'all' : a.area)}>
                  <b>{a.area}</b><small>{a.visits} visit{a.visits === 1 ? '' : 's'} · {a.calls} call{a.calls === 1 ? '' : 's'}</small>
                  {a.avg > 0 && <StarsRO value={Math.round(a.avg)} size={12} />}
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="card form">
          <h3>📅 Date-wise visits</h3>
          <p className="mini-note">Tap a date to see every hotel you visited that day. Download one date, or add a remark to any hotel.</p>
          {days.length === 0 && <p className="mini-note">Nothing logged for this period{area === 'all' ? '' : ` in ${area}`}.</p>}
          {days.map((d, di) => {
            const open = isOpen(d.key, di)
            return (
              <div key={d.key} className={`dw-day ${open ? 'open' : ''}`}>
                <button type="button" className="dw-head" onClick={() => toggleDay(d.key, di)} aria-expanded={open}>
                  <span><b>{fmtDay(d.date)}</b><small>{d.visits} visit{d.visits === 1 ? '' : 's'} · {d.calls} call{d.calls === 1 ? '' : 's'} · {d.hotels} hotel{d.hotels === 1 ? '' : 's'}{d.avg ? ` · ⭐ ${d.avg}` : ''}</small></span>
                  <em>{open ? '▾' : '▸'}</em>
                </button>
                {open && (
                  <div className="dw-body">
                    {[...d.entries].reverse().map((e, i) => (
                      <div key={`${e.at}-${i}`} className="fh-row">
                        <i>{e.mode === 'visit' ? '📍' : '📞'}</i>
                        <div>
                          <b>{e.name}</b>
                          <small>{[e.area, e.outcome, fmtTime(e.at)].filter(Boolean).join(' · ')}</small>
                          {e.remark ? <small className="fr-remark">“{e.remark}”</small> : <small className="fr-remark none">No remark</small>}
                          <button type="button" className="dw-addr" onClick={() => quick.open(e.lead)}>✍️ Add remark</button>
                        </div>
                        <StarsRO value={e.rating} size={12} />
                      </div>
                    ))}
                    <div className="dw-dl">
                      <span>Download {fmtDay(d.date)}</span>
                      {['pdf', 'xlsx', 'csv'].map((t) => (
                        <button key={t} type="button" className="btn-soft sm" disabled={!!busy} onClick={() => makeDay(t, d)}>
                          {busy === `${t}-${d.key}` ? <em className="spin" /> : <Icon name="download" size={14} />} {t === 'xlsx' ? 'Excel' : t.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </section>

        <section className="card form">
          <h3>📄 Download the whole period</h3>
          <p className="mini-note">Pick Today, This week, This month or your own dates above. The file follows the period, area and visits / calls choice, with a day-wise table inside.</p>
          <div className="rc-actions">
            <motion.button whileTap={{ scale: 0.97, y: 3 }} className="btn3d" disabled={!!busy} onClick={() => make('pdf')}>
              {busy === 'pdf' ? <em className="spin" /> : <Icon name="download" />} {busy === 'pdf' ? 'Creating PDF…' : 'Download PDF'}
            </motion.button>
            <motion.button whileTap={{ scale: 0.97, y: 3 }} className="btn3d" disabled={!!busy} onClick={() => make('xlsx')}>
              {busy === 'xlsx' ? <em className="spin" /> : <Icon name="download" />} {busy === 'xlsx' ? 'Creating Excel…' : 'Download Excel'}
            </motion.button>
            <button className="btn-soft" disabled={!!busy} onClick={() => make('csv')}><Icon name="download" /> CSV</button>
          </div>
        </section>

        <section className="card form">
          <h3>💬 Message for the WhatsApp group</h3>
          <div className="wa-bubble"><pre data-raw={text} dangerouslySetInnerHTML={{ __html: waHtml(text) }} /></div>
          <label className="field"><span>Add a note for management (optional)</span>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Challenges, support needed, anything to highlight…" />
          </label>
          <div className="rc-actions">
            <motion.button whileTap={{ scale: 0.97, y: 3 }} className="btn3d lime" onClick={copy}><Icon name="copy" /> Copy for WhatsApp</motion.button>
            <a className="btn-soft" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer"><Icon name="whatsapp" /> Open WhatsApp</a>
          </div>
        </section>
      </div>
      {quick.node}
    </div>
  )
}
