/**
 * SRIDHI CALLER APP - Google Sheets backend  (version 3)
 * ------------------------------------------------------
 * Paste this whole file into the Apps Script of your Google Sheet
 * (Extensions -> Apps Script), Save, then:
 *   Deploy -> Manage deployments -> (pencil) -> Version: New version -> Deploy
 * The Web app URL stays the SAME, so the app needs no change.
 * First time ever: Deploy -> New deployment -> Web app -> Execute as: Me, Access: Anyone.
 *
 * Tabs "Leads", "Calls" and "Callers" are created automatically, and new columns are
 * added automatically when the app needs them. Nothing to set up by hand.
 *
 * CHANGE ADMIN_PIN below. It is the HR admin password, asked at  yoursite.com/control
 */
const ADMIN_PIN = 'hr@sridhi'
const SECRET = '' // optional extra key; if you set it, enter the same in the app (Settings -> Advanced)
const VERSION = 3

const LEAD_HEADERS = [
  'id', 'type', 'name', 'phone', 'altPhone', 'email', 'company', 'bizType', 'area', 'city',
  'source', 'status', 'priority', 'assignedTo', 'assignedName', 'investment', 'vehicle', 'coldStorage',
  'experience', 'dailyQty', 'notes', 'nextFollowUp', 'lastCall', 'lastOutcome', 'lastRemark',
  'callCount', 'createdAt', 'updatedAt', 'delReq', 'delReqBy', 'delReqAt', 'delReqNote', 'callsJson',
]
const CALL_HEADERS = ['at', 'leadId', 'name', 'phone', 'outcome', 'remark', 'next', 'by', 'duration']
const CALLER_HEADERS = ['id', 'name', 'pin', 'active', 'createdAt']

/* ---------- sheet helpers ---------- */
function style_(sh, from, count) {
  sh.getRange(1, from, 1, count).setFontWeight('bold').setBackground('#0f6b34').setFontColor('#ffffff')
}

function sheet_(name, wanted) {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  let sh = ss.getSheetByName(name)
  if (!sh) {
    sh = ss.insertSheet(name)
    sh.getRange(1, 1, sh.getMaxRows(), wanted.length).setNumberFormat('@') // keep phones / dates as text
    sh.getRange(1, 1, 1, wanted.length).setValues([wanted])
    sh.setFrozenRows(1)
    style_(sh, 1, wanted.length)
    return sh
  }
  const lastCol = sh.getLastColumn()
  const cur = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : []
  const miss = wanted.filter(function (h) { return cur.indexOf(h) < 0 })
  if (miss.length) {
    const start = lastCol + 1
    sh.getRange(1, start, sh.getMaxRows(), miss.length).setNumberFormat('@')
    sh.getRange(1, start, 1, miss.length).setValues([miss])
    style_(sh, start, miss.length)
  }
  return sh
}

function hdrs_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String)
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)
}

/* ---------- callers + auth ---------- */
function callers_() {
  const sh = sheet_('Callers', CALLER_HEADERS)
  const last = sh.getLastRow()
  if (last < 2) return []
  const h = hdrs_(sh)
  return sh.getRange(2, 1, last - 1, h.length).getValues().map(function (r) {
    const o = {}
    h.forEach(function (k, i) { o[k] = r[i] === '' ? '' : String(r[i]) })
    o.active = o.active !== 'false'
    return o
  }).filter(function (c) { return c.id })
}

/** who is calling?  admin | caller | open (no callers created yet) | null (not allowed) */
function who_(auth) {
  if (auth && auth.role === 'admin' && ADMIN_PIN && String(auth.pin) === ADMIN_PIN) return { role: 'admin' }
  const cs = callers_().filter(function (c) { return c.active })
  if (!cs.length) return { role: 'open' }
  if (auth && auth.role === 'caller') {
    const c = cs.filter(function (x) { return x.id === auth.id && String(x.pin) === String(auth.pin) })[0]
    if (c) return { role: 'caller', id: c.id, name: c.name }
  }
  return null
}

/* ---------- read ---------- */
function doGet(e) {
  try {
    const p = e.parameter || {}
    if (SECRET && p.token !== SECRET) return json_({ error: 'Wrong secret key' })

    if (p.action === 'callers') {
      const cs = callers_().filter(function (c) { return c.active })
      return json_({
        version: VERSION, open: cs.length === 0,
        callers: cs.map(function (c) { return { id: c.id, name: c.name } }),
      })
    }

    let auth = null
    try { auth = p.auth ? JSON.parse(p.auth) : null } catch (x) { auth = null }
    const w = who_(auth)
    if (!w) return json_({ error: 'Login required' })

    const sh = sheet_('Leads', LEAD_HEADERS)
    const out = { leads: [], version: VERSION }
    const last = sh.getLastRow()
    if (last > 1) {
      const h = hdrs_(sh)
      out.leads = sh.getRange(2, 1, last - 1, h.length).getValues().map(function (r) {
        const o = {}
        h.forEach(function (k, i) { o[k] = r[i] === '' ? '' : String(r[i]) })
        try { o.calls = o.callsJson ? JSON.parse(o.callsJson) : [] } catch (err) { o.calls = [] }
        delete o.callsJson
        o.callCount = Number(o.callCount) || 0
        return o
      }).filter(function (o) {
        return o.id && (w.role !== 'caller' || o.assignedTo === w.id)
      })
    }
    if (w.role === 'admin') out.callers = callers_()
    return json_(out)
  } catch (err) {
    return json_({ error: String(err) })
  }
}

/* ---------- write ---------- */
function upsertMany_(leads, w) {
  const sh = sheet_('Leads', LEAD_HEADERS)
  const h = hdrs_(sh)
  const idCol = h.indexOf('id')
  const asCol = h.indexOf('assignedTo')
  const last = sh.getLastRow()
  const data = last > 1 ? sh.getRange(2, 1, last - 1, h.length).getValues() : []
  const index = {}
  const owner = {}
  data.forEach(function (r, i) { index[String(r[idCol])] = i + 2; owner[String(r[idCol])] = String(r[asCol]) })

  const fresh = []
  let rejected = 0
  leads.forEach(function (l) {
    if (w.role === 'caller') {
      if (index[l.id] && owner[l.id] !== w.id) { rejected++; return } // not her lead
      l.assignedTo = w.id
      l.assignedName = w.name
    }
    const row = h.map(function (k) {
      if (k === 'callsJson') return JSON.stringify(l.calls || [])
      return l[k] === undefined || l[k] === null ? '' : String(l[k])
    })
    if (index[l.id]) sh.getRange(index[l.id], 1, 1, row.length).setValues([row])
    else fresh.push(row)
  })
  if (fresh.length) sh.getRange(sh.getLastRow() + 1, 1, fresh.length, h.length).setValues(fresh)
  return rejected
}

function doPost(e) {
  const lock = LockService.getScriptLock()
  lock.waitLock(20000)
  try {
    const body = JSON.parse(e.postData.contents)
    if (SECRET && body.token !== SECRET) return json_({ error: 'Wrong secret key' })

    if (body.action === 'adminLogin') {
      if (ADMIN_PIN && String(body.pin) === ADMIN_PIN) return json_({ ok: true, admin: true, version: VERSION })
      return json_({ error: 'Wrong admin password' })
    }
    if (body.action === 'login') {
      const c = callers_().filter(function (x) {
        return x.active && x.id === body.callerId && String(x.pin) === String(body.pin)
      })[0]
      return c ? json_({ ok: true, name: c.name }) : json_({ error: 'Wrong PIN' })
    }

    const w = who_(body.auth)
    if (!w) return json_({ error: 'Login required' })

    if (body.action === 'upsert') {
      const rejected = upsertMany_([body.lead], w)
      if (body.call && !rejected) {
        const c = body.call
        const cs = sheet_('Calls', CALL_HEADERS)
        const ch = hdrs_(cs)
        cs.appendRow(ch.map(function (k) { return c[k] === undefined ? '' : String(c[k]) }))
      }
      if (rejected) return json_({ error: 'Not your lead' })
    } else if (body.action === 'bulk') {
      upsertMany_(body.leads || [], w)
    } else if (body.action === 'delete') {
      if (w.role === 'caller') return json_({ error: 'Only HR can delete leads' })
      const sh = sheet_('Leads', LEAD_HEADERS)
      const last = sh.getLastRow()
      if (last > 1) {
        const ids = sh.getRange(2, 1, last - 1, 1).getValues()
        for (let i = 0; i < ids.length; i++) {
          if (String(ids[i][0]) === String(body.id)) { sh.deleteRow(i + 2); break }
        }
      }
    } else if (body.action === 'callerUpsert' || body.action === 'callerDelete') {
      if (w.role !== 'admin') return json_({ error: 'Admin only' })
      const sh = sheet_('Callers', CALLER_HEADERS)
      const h = hdrs_(sh)
      const last = sh.getLastRow()
      const ids = last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return String(r[0]) }) : []
      if (body.action === 'callerUpsert') {
        const c = body.caller
        const row = h.map(function (k) { return c[k] === undefined || c[k] === null ? '' : String(c[k]) })
        const at = ids.indexOf(String(c.id))
        if (at >= 0) sh.getRange(at + 2, 1, 1, row.length).setValues([row])
        else sh.getRange(sh.getLastRow() + 1, 1, 1, row.length).setValues([row])
      } else {
        const at = ids.indexOf(String(body.id))
        if (at >= 0) sh.deleteRow(at + 2)
      }
    }
    return json_({ ok: true })
  } catch (err) {
    return json_({ error: String(err) })
  } finally {
    lock.releaseLock()
  }
}
