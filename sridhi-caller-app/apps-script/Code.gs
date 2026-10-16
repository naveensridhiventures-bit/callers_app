/**
 * SRIDHI CALLER APP - Google Sheets backend
 * -----------------------------------------
 * 1. Open a new Google Sheet  ->  Extensions  ->  Apps Script
 * 2. Paste this whole file, Save.
 * 3. Deploy  ->  New deployment  ->  type: Web app
 *      Execute as: Me
 *      Who has access: Anyone
 * 4. Copy the Web app URL and paste it in the app:  More -> Settings -> Google Sheet URL
 *
 * Sheets "Leads" and "Calls" are created automatically.
 * Optional: set SECRET below, and enter the same value in the app (Settings -> Secret key).
 */
const SECRET = ''

const LEAD_HEADERS = [
  'id', 'type', 'name', 'phone', 'altPhone', 'email', 'company', 'bizType', 'area', 'city',
  'source', 'status', 'priority', 'investment', 'vehicle', 'coldStorage', 'experience', 'dailyQty',
  'notes', 'nextFollowUp', 'lastCall', 'lastOutcome', 'lastRemark', 'callCount',
  'createdAt', 'updatedAt', 'callsJson',
]
const CALL_HEADERS = ['at', 'leadId', 'name', 'phone', 'outcome', 'remark', 'next', 'by', 'duration']

function sheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  let sh = ss.getSheetByName(name)
  if (!sh) {
    sh = ss.insertSheet(name)
    sh.getRange(1, 1, sh.getMaxRows(), headers.length).setNumberFormat('@') // keep phones/dates as text
    sh.appendRow(headers)
    sh.setFrozenRows(1)
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#0f6b34').setFontColor('#ffffff')
  }
  return sh
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)
}

function authOk_(token) {
  return !SECRET || token === SECRET
}

function doGet(e) {
  try {
    if (!authOk_(e.parameter.token)) return json_({ error: 'Wrong secret key' })
    const sh = sheet_('Leads', LEAD_HEADERS)
    const last = sh.getLastRow()
    if (last < 2) return json_({ leads: [] })
    const rows = sh.getRange(2, 1, last - 1, LEAD_HEADERS.length).getValues()
    const leads = rows.map(function (r) {
      const o = {}
      LEAD_HEADERS.forEach(function (h, i) { o[h] = r[i] === '' ? '' : String(r[i]) })
      try { o.calls = o.callsJson ? JSON.parse(o.callsJson) : [] } catch (err) { o.calls = [] }
      delete o.callsJson
      o.callCount = Number(o.callCount) || 0
      return o
    })
    return json_({ leads: leads })
  } catch (err) {
    return json_({ error: String(err) })
  }
}

function leadRow_(l) {
  return LEAD_HEADERS.map(function (h) {
    if (h === 'callsJson') return JSON.stringify(l.calls || [])
    const v = l[h]
    return v === undefined || v === null ? '' : String(v)
  })
}

function upsertMany_(leads) {
  const sh = sheet_('Leads', LEAD_HEADERS)
  const last = sh.getLastRow()
  const ids = last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return String(r[0]) }) : []
  const index = {}
  ids.forEach(function (id, i) { index[id] = i + 2 })
  const fresh = []
  leads.forEach(function (l) {
    const row = leadRow_(l)
    if (index[l.id]) sh.getRange(index[l.id], 1, 1, row.length).setValues([row])
    else fresh.push(row)
  })
  if (fresh.length) sh.getRange(sh.getLastRow() + 1, 1, fresh.length, LEAD_HEADERS.length).setValues(fresh)
}

function doPost(e) {
  const lock = LockService.getScriptLock()
  lock.waitLock(20000)
  try {
    const body = JSON.parse(e.postData.contents)
    if (!authOk_(body.token)) return json_({ error: 'Wrong secret key' })

    if (body.action === 'upsert') {
      upsertMany_([body.lead])
      if (body.call) {
        const c = body.call
        sheet_('Calls', CALL_HEADERS).appendRow(CALL_HEADERS.map(function (h) { return c[h] === undefined ? '' : String(c[h]) }))
      }
    } else if (body.action === 'bulk') {
      upsertMany_(body.leads || [])
    } else if (body.action === 'delete') {
      const sh = sheet_('Leads', LEAD_HEADERS)
      const last = sh.getLastRow()
      if (last > 1) {
        const ids = sh.getRange(2, 1, last - 1, 1).getValues()
        for (let i = 0; i < ids.length; i++) {
          if (String(ids[i][0]) === String(body.id)) { sh.deleteRow(i + 2); break }
        }
      }
    }
    return json_({ ok: true })
  } catch (err) {
    return json_({ error: String(err) })
  } finally {
    lock.releaseLock()
  }
}
