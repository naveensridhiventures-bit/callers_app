import { INTEREST } from './analytics'
import { fmtDateTime, fmtDay } from './reports'

const GREEN = [15, 107, 52], DARK = [6, 48, 26], LIME = [212, 232, 58], SOFT = [238, 244, 236], INK = [16, 36, 26], MUTED = [95, 116, 104]
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
// the built-in PDF fonts only know Latin text, so strip emoji / other scripts
const clean = (s) => String(s ?? '').replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7E -ÿ]/g, '').replace(/\s+/g, ' ').trim()
const typeName = (t) => (t === 'number' ? 'Number' : t === 'sales' ? 'Sales' : 'Distributor')
const dur = (s) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '')

/* ============================== PDF ============================== */
export async function makePDF(r) {
  const [{ jsPDF }, atMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const autoTable = atMod.default || atMod.autoTable
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210, M = 14
  const t = r.totals, m = r.meta
  let y = 0

  // ---- header band
  doc.setFillColor(...DARK); doc.rect(0, 0, W, 40, 'F')
  doc.setFillColor(...GREEN); doc.rect(0, 0, W, 34, 'F')
  doc.setFillColor(...LIME); doc.rect(0, 34, W, 2.2, 'F')
  doc.setFillColor(...LIME); doc.roundedRect(M, 8, 20, 20, 5, 5, 'F')
  doc.setTextColor(...DARK); doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.text('S', M + 10, 22, { align: 'center' })
  doc.setTextColor(255, 255, 255); doc.setFontSize(19); doc.text(clean(m.title).toUpperCase(), M + 26, 17)
  doc.setFontSize(10); doc.setTextColor(...LIME); doc.text(clean(m.rangeLabel), M + 26, 23.5)
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(clean(`${m.scopeLabel}  |  Bengaluru`), M + 26, 29)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.text('SRIDHI PREMIUM IDLI & DOSA BATTER', W - M, 15, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...LIME); doc.text('Telecaller performance report', W - M, 20, { align: 'right' })
  y = 46

  const ensure = (h) => { if (y + h > 280) { doc.addPage(); y = 16 } }
  const section = (title) => {
    ensure(14)
    doc.setFillColor(...LIME); doc.roundedRect(M, y - 4.2, 1.8, 5.6, 0.9, 0.9, 'F')
    doc.setTextColor(...DARK); doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.text(clean(title), M + 4.5, y)
    y += 5
  }

  // ---- KPI tiles
  const tiles = [
    ['Calls made', t.calls, GREEN], ['Connected', `${t.connected}  (${t.rate}%)`, GREEN], ['Not connected', t.notConnected, [180, 83, 9]], ['Details updated', t.updates, GREEN],
    ['Interested', t.interested, [234, 88, 12]], ['Meetings fixed', t.meetings, GREEN], ['Onboarded', t.onboarded, [22, 163, 74]], ['Leads contacted', t.touched, GREEN],
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

  // ---- outcomes
  if (r.outcomes.length) {
    section('Call outcomes')
    const max = Math.max(...r.outcomes.map((o) => o.count))
    r.outcomes.slice(0, 9).forEach((o) => {
      ensure(7)
      doc.setTextColor(...INK); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(clean(o.outcome), M, y + 3.6)
      doc.setFillColor(...SOFT); doc.roundedRect(M + 42, y, 110, 5, 2.5, 2.5, 'F')
      const good = ['Interested', 'Meeting Fixed', 'Onboarded'].includes(o.outcome)
      doc.setFillColor(...(good ? [34, 197, 94] : [148, 163, 184])); doc.roundedRect(M + 42, y, Math.max(4, (o.count / max) * 110), 5, 2.5, 2.5, 'F')
      doc.setFont('helvetica', 'bold'); doc.text(String(o.count), M + 156, y + 3.7)
      y += 7.5
    })
    y += 4
  }

  // ---- daily activity chart
  if (r.days.length > 1) {
    section('Daily activity')
    ensure(52)
    const n = r.days.length, bw = Math.min(11, (W - 2 * M) / n - 1.2), gap = ((W - 2 * M) - bw * n) / Math.max(1, n - 1), base = y + 36, mx = Math.max(1, ...r.days.map((d) => d.calls))
    r.days.forEach((d, i) => {
      const x = M + i * (bw + gap), h = (d.calls / mx) * 30
      doc.setFillColor(191, 227, 201); doc.roundedRect(x, base - Math.max(h, 0.6), bw, Math.max(h, 0.6), 1, 1, 'F')
      const ch = d.calls ? (d.connected / d.calls) * h : 0
      if (ch > 0) { doc.setFillColor(...GREEN); doc.roundedRect(x, base - ch, bw, ch, 1, 1, 'F') }
      doc.setTextColor(...INK); doc.setFont('helvetica', 'bold'); doc.setFontSize(7); if (d.calls) doc.text(String(d.calls), x + bw / 2, base - h - 1.4, { align: 'center' })
      doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal'); doc.setFontSize(n > 16 ? 5.5 : 6.5); doc.text(n > 16 ? String(d.d.getDate()) : d.label, x + bw / 2, base + 4, { align: 'center' })
    })
    doc.setFontSize(7.5); doc.setFillColor(...GREEN); doc.rect(W - M - 62, y - 2, 3, 3, 'F'); doc.setTextColor(...MUTED); doc.text('Connected', W - M - 58, y + 0.5)
    doc.setFillColor(191, 227, 201); doc.rect(W - M - 32, y - 2, 3, 3, 'F'); doc.text('Not connected', W - M - 28, y + 0.5)
    y += 46
  }

  const tableStyle = {
    margin: { left: M, right: M }, theme: 'striped', styles: { fontSize: 8, cellPadding: 2, textColor: INK, overflow: 'linebreak' },
    headStyles: { fillColor: GREEN, textColor: 255, fontStyle: 'bold', fontSize: 8 }, alternateRowStyles: { fillColor: [244, 248, 243] },
  }
  const table = (opts) => { autoTable(doc, { ...tableStyle, startY: y, ...opts }); y = doc.lastAutoTable.finalY + 8 }

  // ---- caller table
  if (r.perCaller.length > 1 || m.isTeam) {
    section('Caller-wise performance')
    table({
      head: [['Caller', 'Leads', 'Calls', 'Connected', 'Rate', 'Updates', 'Interested', 'Meetings', 'Onboarded', 'Not called', 'Overdue']],
      body: r.perCaller.map((c) => [clean(c.name), c.assigned, c.calls, c.connected, `${c.rate}%`, c.updates, c.interested, c.meetings, c.onboarded, c.notCalled, c.overdue]),
      columnStyles: { 0: { fontStyle: 'bold' } },
    })
  }

  // ---- pipeline
  section('Pipeline - interest level of leads')
  const total = Math.max(1, INTEREST.reduce((a, i) => a + (r.pipeline[i.id] || 0), 0))
  let px = M
  INTEREST.forEach((i) => {
    const w = ((r.pipeline[i.id] || 0) / total) * (W - 2 * M)
    if (w > 0) { doc.setFillColor(...hex(i.color)); doc.rect(px, y, w, 7, 'F'); px += w }
  })
  y += 12
  doc.setFontSize(8); let lx = M
  INTEREST.forEach((i) => {
    const txt = `${clean(i.label)}: ${r.pipeline[i.id] || 0}`
    doc.setFillColor(...hex(i.color)); doc.rect(lx, y - 2.6, 3, 3, 'F'); doc.setTextColor(...INK); doc.setFont('helvetica', 'normal'); doc.text(txt, lx + 4.5, y)
    lx += doc.getTextWidth(txt) + 11
  })
  y += 9

  // ---- highlights
  if (r.highlights.length) {
    section('Highlights')
    table({
      head: [['Lead', 'Area', 'Result', 'Remark', 'Caller']],
      body: r.highlights.slice(0, 25).map((h) => [clean(h.lead.name || h.lead.phone), clean(h.lead.area), h.outcome, clean(h.remark), clean(h.caller)]),
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 38 }, 2: { cellWidth: 28 } },
    })
  }

  // ---- follow-ups
  if (r.followups.length) {
    section(`Follow-ups planned for ${fmtDay(m.nextDay)}`)
    table({
      head: [['Time', 'Lead', 'Phone', 'Area', 'Status']],
      body: r.followups.slice(0, 40).map((l) => [new Date(l.nextFollowUp).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }), clean(l.name || l.phone), l.phone, clean(l.area), l.status]),
      columnStyles: { 1: { fontStyle: 'bold' } },
    })
  }

  // ---- call log
  if (r.log.length) {
    if (y > 215) { doc.addPage(); y = 18 }
    section(`Detailed activity log (${r.log.length})`)
    table({
      head: [['When', ...(m.isTeam || r.perCaller.length > 1 ? ['Caller'] : []), 'Lead', 'Phone', 'Area', 'Outcome', 'Remark', 'Next']],
      body: r.log.map((c) => [fmtDateTime(c.at), ...(m.isTeam || r.perCaller.length > 1 ? [clean(c.caller)] : []), clean(c.name), c.phone, clean(c.area), c.outcome, clean(c.remark), c.next ? fmtDateTime(c.next) : '']),
      styles: { ...tableStyle.styles, fontSize: 7.2 },
      columnStyles: { 0: { cellWidth: 22 } },
    })
  }

  // ---- footer on every page
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setDrawColor(...LIME); doc.setLineWidth(0.6); doc.line(M, 288, W - M, 288)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MUTED)
    doc.text(`Sridhi Premium Idli & Dosa Batter  |  Generated ${clean(fmtDateTime(m.generatedAt))}`, M, 292.5)
    doc.text(`Page ${i} of ${pages}`, W - M, 292.5, { align: 'right' })
  }
  return doc.output('blob')
}

/* ============================== Excel ============================== */
export async function makeXLSX(r) {
  const mod = await import('exceljs')
  const ExcelJS = mod.default || mod
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Sridhi Caller App'; wb.created = new Date()
  const t = r.totals, m = r.meta
  const G = 'FF0F6B34', DK = 'FF06301A', LM = 'FFD4E83A', SF = 'FFEEF4EC', ZB = 'FFF6FAF5'
  const fill = (c) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: c } })
  const thin = { style: 'thin', color: { argb: 'FFD7E3D4' } }
  const box = { top: thin, left: thin, bottom: thin, right: thin }

  const banner = (ws, cols, subtitle) => {
    ws.mergeCells(1, 1, 1, cols); ws.mergeCells(2, 1, 2, cols)
    const a = ws.getCell(1, 1); a.value = `SRIDHI PREMIUM IDLI & DOSA BATTER  -  ${m.title.toUpperCase()}`
    a.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } }; a.fill = fill(G); a.alignment = { vertical: 'middle', indent: 1 }
    const b = ws.getCell(2, 1); b.value = subtitle || `${m.rangeLabel}   |   ${m.scopeLabel}   |   Generated ${fmtDateTime(m.generatedAt)}`
    b.font = { size: 10, color: { argb: LM }, bold: true }; b.fill = fill(DK); b.alignment = { vertical: 'middle', indent: 1 }
    ws.getRow(1).height = 32; ws.getRow(2).height = 20
    for (let c = 1; c <= cols; c++) { ws.getCell(1, c).fill = fill(G); ws.getCell(2, c).fill = fill(DK) }
  }
  const table = (ws, startRow, headers, rows, widths) => {
    const h = ws.getRow(startRow)
    headers.forEach((x, i) => { const c = h.getCell(i + 1); c.value = x; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = fill(G); c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; c.border = box })
    h.height = 24
    rows.forEach((row, ri) => {
      const rr = ws.getRow(startRow + 1 + ri)
      row.forEach((v, i) => { const c = rr.getCell(i + 1); c.value = v; c.border = box; c.alignment = { vertical: 'middle', wrapText: true, horizontal: typeof v === 'number' ? 'center' : 'left' }; if (ri % 2) c.fill = fill(ZB) })
    })
    widths?.forEach((w, i) => { ws.getColumn(i + 1).width = w })
    return startRow + 1 + rows.length
  }
  const outcomeFill = { Interested: 'FFFFEDD5', 'Meeting Fixed': 'FFFEF9C3', Onboarded: 'FFDCFCE7', 'Not Interested': 'FFFEE2E2', 'Wrong Number': 'FFFEE2E2' }

  // ---- Summary
  const ws = wb.addWorksheet('Summary', { views: [{ showGridLines: false }] })
  banner(ws, 8)
  ;[['Calls made', t.calls], ['Connected', t.connected], ['Connected %', `${t.rate}%`], ['Not connected', t.notConnected], ['Details updated', t.updates], ['New leads added', t.added],
    ['Leads contacted', t.touched], ['Interested', t.interested], ['Meetings fixed', t.meetings], ['Onboarded', t.onboarded], ['Follow-ups next day', t.followups], ['Overdue follow-ups', t.overdue], ['Total leads', t.leads], ['Not yet called', t.notCalled]]
    .forEach(([k, v], i) => {
      const row = 4 + Math.floor(i / 2), col = 1 + (i % 2) * 4
      ws.mergeCells(row, col, row, col + 2)
      const a = ws.getCell(row, col); a.value = k; a.font = { bold: true, color: { argb: DK } }; a.fill = fill(SF); a.border = box; a.alignment = { vertical: 'middle', indent: 1 }
      const b = ws.getCell(row, col + 3); b.value = v; b.font = { bold: true, size: 13, color: { argb: G } }; b.fill = fill(SF); b.border = box; b.alignment = { horizontal: 'center', vertical: 'middle' }
      ws.getRow(row).height = 22
    })
  let row = 12
  ws.getCell(row, 1).value = 'Call outcomes'; ws.getCell(row, 1).font = { bold: true, size: 12, color: { argb: G } }; row++
  row = table(ws, row, ['Outcome', '', 'Calls'], r.outcomes.map((o) => [o.outcome, '', o.count]))
  ws.getColumn(1).width = 22; for (let c = 2; c <= 8; c++) ws.getColumn(c).width = 13
  r.outcomes.forEach((o, i) => { if (outcomeFill[o.outcome]) ws.getCell(13 + i + 1, 1).fill = fill(outcomeFill[o.outcome]) })
  row += 1
  ws.getCell(row, 1).value = 'Pipeline (interest level)'; ws.getCell(row, 1).font = { bold: true, size: 12, color: { argb: G } }; row++
  row = table(ws, row, ['Level', '', 'Leads'], INTEREST.map((i) => [i.label, '', r.pipeline[i.id] || 0]))
  INTEREST.forEach((i, k) => { ws.getCell(row - INTEREST.length + k, 1).fill = fill(`FF${i.color.slice(1).toUpperCase()}`); ws.getCell(row - INTEREST.length + k, 1).font = { bold: true, color: { argb: ['won', 'hot', 'tried'].includes(i.id) ? 'FFFFFFFF' : DK } } })
  if (r.days.length > 1) {
    row += 1
    ws.getCell(row, 1).value = 'Day by day'; ws.getCell(row, 1).font = { bold: true, size: 12, color: { argb: G } }; row++
    table(ws, row, ['Date', 'Day', 'Calls', 'Connected', 'Details updated'], r.days.map((d) => [d.label, d.dow, d.calls, d.connected, d.updates]))
  }

  // ---- By caller
  const wc = wb.addWorksheet('By Caller', { views: [{ showGridLines: false, state: 'frozen', ySplit: 4 }] })
  banner(wc, 11)
  table(wc, 4, ['Caller', 'Leads', 'Calls', 'Connected', 'Rate %', 'Details updated', 'Interested', 'Meetings', 'Onboarded', 'Not called', 'Overdue'],
    r.perCaller.map((c) => [c.name, c.assigned, c.calls, c.connected, c.rate, c.updates, c.interested, c.meetings, c.onboarded, c.notCalled, c.overdue]), [22, 9, 9, 11, 9, 14, 11, 10, 11, 11, 10])

  // ---- Activity log
  const wl = wb.addWorksheet('Activity Log', { views: [{ showGridLines: false, state: 'frozen', ySplit: 4 }] })
  banner(wl, 10)
  const end = table(wl, 4, ['Date', 'Time', 'Caller', 'Lead', 'Phone', 'Area', 'Type', 'Outcome', 'Remark', 'Next follow-up'],
    r.log.map((c) => [new Date(c.at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), new Date(c.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }), c.caller, c.name, c.phone, c.area, typeName(c.type), c.outcome, c.remark, c.next ? fmtDateTime(c.next) : '']),
    [13, 10, 14, 24, 14, 16, 12, 17, 40, 18])
  r.log.forEach((c, i) => { if (outcomeFill[c.outcome]) wl.getCell(5 + i, 8).fill = fill(outcomeFill[c.outcome]) })
  if (r.log.length) wl.autoFilter = { from: { row: 4, column: 1 }, to: { row: end - 1, column: 10 } }

  // ---- Highlights + follow-ups
  const wh = wb.addWorksheet('Highlights & Follow-ups', { views: [{ showGridLines: false }] })
  banner(wh, 6)
  wh.getCell(4, 1).value = 'Highlights'; wh.getCell(4, 1).font = { bold: true, size: 12, color: { argb: G } }
  let hr = table(wh, 5, ['Lead', 'Area', 'Result', 'Remark', 'Caller', 'Phone'], r.highlights.map((h) => [nameOfL(h.lead), h.lead.area || '', h.outcome, h.remark || '', h.caller || '', h.lead.phone || '']), [26, 18, 16, 42, 16, 15])
  hr += 1
  wh.getCell(hr, 1).value = `Follow-ups planned for ${fmtDay(m.nextDay)}`; wh.getCell(hr, 1).font = { bold: true, size: 12, color: { argb: G } }
  table(wh, hr + 1, ['Lead', 'Area', 'Time', 'Status', 'Priority', 'Phone'], r.followups.map((l) => [nameOfL(l), l.area || '', new Date(l.nextFollowUp).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }), l.status, l.priority || '', l.phone || '']))

  // ---- All leads snapshot
  const wa = wb.addWorksheet('Leads Snapshot', { views: [{ showGridLines: false, state: 'frozen', ySplit: 4 }] })
  banner(wa, 13, `All leads in scope  |  ${m.scopeLabel}  |  as of ${fmtDateTime(m.generatedAt)}`)
  const e2 = table(wa, 4, ['Lead', 'Phone', 'Area', 'Business', 'Type', 'Status', 'Interest', 'Caller', 'Calls', 'Last call', 'Last outcome', 'Last remark', 'Next follow-up'],
    r.leadRows.map((l) => [l.name, l.phone, l.area, l.company, typeName(l.type), l.status, l.interest, l.caller, l.calls, l.lastCall ? fmtDateTime(l.lastCall) : '', l.lastOutcome, l.lastRemark, l.next ? fmtDateTime(l.next) : '']),
    [24, 14, 16, 18, 12, 14, 14, 14, 7, 17, 16, 34, 18])
  if (r.leadRows.length) wa.autoFilter = { from: { row: 4, column: 1 }, to: { row: e2 - 1, column: 13 } }

  const buf = await wb.xlsx.writeBuffer()
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
const nameOfL = (l) => l.name || l.phone || 'Unknown'
