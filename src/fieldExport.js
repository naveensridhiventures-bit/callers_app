import { fmtDateTime } from './reports'
import { toCSV } from './utils'

const GREEN = [15, 107, 52], DARK = [6, 48, 26], LIME = [212, 232, 58], SOFT = [238, 244, 236], INK = [16, 36, 26], MUTED = [95, 116, 104]
const clean = (s) => String(s ?? '').replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7E -ÿ]/g, '').replace(/\s+/g, ' ').trim()
const when = (iso) => (iso ? fmtDateTime(iso) : '')
const rows = (r) => r.entries.map((e) => ({
  Time: when(e.at), Type: e.mode === 'visit' ? 'Visit' : 'Call', Hotel: e.name, Area: e.area, Phone: e.phone, Outcome: e.outcome,
  Rating: e.rating || '', Remark: e.remark, 'Next follow-up': when(e.next),
}))
const COLS = ['Time', 'Type', 'Hotel', 'Area', 'Phone', 'Outcome', 'Rating', 'Remark', 'Next follow-up']

export const makeFieldCSV = (r) => new Blob(['﻿' + toCSV(rows(r), COLS)], { type: 'text/csv;charset=utf-8' })

/* ============================== Excel ============================== */
export async function makeFieldXLSX(r) {
  const mod = await import('exceljs')
  const ExcelJS = mod.default || mod
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Sridhi Field App'
  const t = r.totals, m = r.meta
  const head = (ws) => {
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F6B34' } }
    ws.views = [{ state: 'frozen', ySplit: 1 }]
  }

  const sm = wb.addWorksheet('Summary')
  sm.columns = [{ width: 28 }, { width: 34 }]
  sm.addRow(['Sridhi Premium Idli & Dosa Batter']).font = { bold: true, size: 15, color: { argb: 'FF0F6B34' } }
  sm.addRow([`Field Sales Report - Chennai`]).font = { bold: true, size: 12 }
  sm.addRow([])
  ;[
    ['Field person', m.scopeLabel], ['Period', m.rangeLabel], ['Area', m.areaLabel], ['Generated', when(m.generatedAt)], [],
    ['Visits made', t.visits], ['Calls made', t.calls], ['Hotels reached', t.hotels], ['Areas covered', t.areas],
    ['Average interest (out of 5)', t.avgRating || '-'], ['Interested (4-5 stars / positive)', t.hot], ['Orders restarted', t.orders],
    ['Follow-ups tomorrow', t.followups], ['Overdue follow-ups', t.overdue],
  ].forEach((x) => { const row = sm.addRow(x); if (x.length) row.getCell(1).font = { bold: true } })

  const ws = wb.addWorksheet('Visits & Calls')
  ws.columns = [{ header: 'Time', width: 18 }, { header: 'Type', width: 8 }, { header: 'Hotel', width: 28 }, { header: 'Area', width: 18 }, { header: 'Phone', width: 14 },
    { header: 'Outcome', width: 20 }, { header: 'Rating (1-5)', width: 11 }, { header: 'Remark', width: 40 }, { header: 'Next follow-up', width: 18 }]
  rows(r).forEach((x) => ws.addRow(COLS.map((c) => x[c])))
  head(ws)
  ws.autoFilter = { from: 'A1', to: 'I1' }

  const wa = wb.addWorksheet('By Area')
  wa.columns = [{ header: 'Area', width: 24 }, { header: 'Visits', width: 9 }, { header: 'Calls', width: 9 }, { header: 'Hotels', width: 9 }, { header: 'Avg rating', width: 11 }, { header: 'Interested', width: 11 }, { header: 'Orders restarted', width: 16 }]
  r.byArea.forEach((a) => wa.addRow([a.area, a.visits, a.calls, a.hotels, a.avg || '', a.hot, a.orders]))
  head(wa)

  const wf = wb.addWorksheet('Next follow-ups')
  wf.columns = [{ header: 'When', width: 18 }, { header: 'Hotel', width: 28 }, { header: 'Area', width: 18 }, { header: 'Phone', width: 14 }, { header: 'Last remark', width: 40 }]
  r.followups.forEach((l) => wf.addRow([when(l.nextFollowUp), l.name || l.phone, l.area || '', l.phone || '', l.lastRemark || '']))
  head(wf)

  const buf = await wb.xlsx.writeBuffer()
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

/* ============================== PDF ============================== */
export async function makeFieldPDF(r) {
  const [{ jsPDF }, atMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const autoTable = atMod.default || atMod.autoTable
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210, M = 14, t = r.totals, m = r.meta
  let y = 0

  doc.setFillColor(...DARK); doc.rect(0, 0, W, 40, 'F')
  doc.setFillColor(...GREEN); doc.rect(0, 0, W, 34, 'F')
  doc.setFillColor(...LIME); doc.rect(0, 34, W, 2.2, 'F')
  doc.setFillColor(...LIME); doc.roundedRect(M, 8, 20, 20, 5, 5, 'F')
  doc.setTextColor(...DARK); doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.text('S', M + 10, 22, { align: 'center' })
  doc.setTextColor(255, 255, 255); doc.setFontSize(19); doc.text('FIELD SALES REPORT', M + 26, 17)
  doc.setFontSize(10); doc.setTextColor(...LIME); doc.text(clean(m.rangeLabel), M + 26, 23.5)
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(clean(`${m.scopeLabel}  |  Chennai  |  ${m.areaLabel}`), M + 26, 29)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.text('SRIDHI PREMIUM IDLI & DOSA BATTER', W - M, 15, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...LIME); doc.text('Hotel visits & calls', W - M, 20, { align: 'right' })
  y = 46

  const tiles = [
    ['Visits', t.visits, GREEN], ['Calls', t.calls, GREEN], ['Hotels reached', t.hotels, GREEN], ['Avg interest', t.avgRating ? `${t.avgRating} / 5` : '-', [234, 88, 12]],
    ['Interested', t.hot, [234, 88, 12]], ['Orders restarted', t.orders, [22, 163, 74]], ['Areas covered', t.areas, GREEN], ['Follow-ups tomorrow', t.followups, [180, 83, 9]],
  ]
  const tw = (W - 2 * M - 3 * 4) / 4
  tiles.forEach(([label, val, col], i) => {
    const x = M + (i % 4) * (tw + 4), yy = y + Math.floor(i / 4) * 25
    doc.setFillColor(...SOFT); doc.roundedRect(x, yy, tw, 21, 3.5, 3.5, 'F')
    doc.setFillColor(...col); doc.roundedRect(x, yy + 3, 1.6, 15, 0.8, 0.8, 'F')
    doc.setTextColor(...col); doc.setFont('helvetica', 'bold'); doc.setFontSize(String(val).length > 6 ? 12 : 17); doc.text(String(val), x + 6, yy + 11.5)
    doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text(label, x + 6, yy + 17)
  })
  y += 54

  const style = {
    margin: { left: M, right: M }, theme: 'striped', styles: { fontSize: 8, cellPadding: 2, textColor: INK, overflow: 'linebreak' },
    headStyles: { fillColor: GREEN, textColor: 255, fontStyle: 'bold', fontSize: 8 }, alternateRowStyles: { fillColor: [244, 248, 243] },
  }
  const section = (title) => {
    if (y > 270) { doc.addPage(); y = 16 }
    doc.setFillColor(...LIME); doc.roundedRect(M, y - 4.2, 1.8, 5.6, 0.9, 0.9, 'F')
    doc.setTextColor(...DARK); doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.text(title, M + 4.5, y); y += 5
  }
  const table = (opts) => { autoTable(doc, { ...style, startY: y, ...opts }); y = doc.lastAutoTable.finalY + 8 }

  if (r.byArea.length) {
    section('Area-wise')
    table({
      head: [['Area', 'Visits', 'Calls', 'Hotels', 'Avg rating', 'Interested', 'Orders']],
      body: r.byArea.map((a) => [clean(a.area), a.visits, a.calls, a.hotels, a.avg || '-', a.hot, a.orders]),
      columnStyles: { 0: { fontStyle: 'bold' } },
    })
  }
  section('Every visit and call')
  if (!r.entries.length) { doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text('Nothing logged in this period.', M, y + 2); y += 10 }
  else table({
    head: [['Time', 'Type', 'Hotel', 'Area', 'Outcome', 'Rating', 'Remark']],
    body: r.entries.map((e) => [clean(when(e.at)), e.mode === 'visit' ? 'Visit' : 'Call', clean(e.name), clean(e.area), clean(e.outcome), e.rating ? `${e.rating}/5` : '-', clean(e.remark)]),
    columnStyles: { 2: { fontStyle: 'bold' }, 6: { cellWidth: 46 } },
  })
  if (r.followups.length) {
    section('Follow-ups for the next day')
    table({ head: [['When', 'Hotel', 'Area', 'Phone']], body: r.followups.map((l) => [clean(when(l.nextFollowUp)), clean(l.name || l.phone), clean(l.area || ''), clean(l.phone || '')]) })
  }

  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(...MUTED)
    doc.text(`Sridhi Field App  |  ${clean(when(m.generatedAt))}`, M, 291); doc.text(`Page ${i} of ${pages}`, W - M, 291, { align: 'right' })
  }
  return doc.output('blob')
}
