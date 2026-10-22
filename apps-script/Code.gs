/**
 * SRIDHI CALLER APP - Google Sheets backend  (version 6)
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
const ADMIN_EMAIL = '' // HR Gmail: gets an alert when a follow-up is 2+ hours overdue (leave '' to switch off)
const VERSION = 6

const LEAD_HEADERS = [
  'id', 'type', 'name', 'phone', 'altPhone', 'email', 'company', 'bizType', 'area', 'city',
  'source', 'status', 'priority', 'assignedTo', 'assignedName', 'assignedAt', 'investment', 'vehicle', 'coldStorage',
  'experience', 'dailyQty', 'notes', 'nextFollowUp', 'lastCall', 'lastOutcome', 'lastRemark',
  'callCount', 'createdAt', 'updatedAt', 'delReq', 'delReqBy', 'delReqAt', 'delReqNote', 'callsJson',
  // lapsed-hotel / field-person fields (v5)
  'fieldId', 'fieldName', 'fieldAt', 'contactName', 'address', 'mapUrl', 'lat', 'lng', 'lastOrderOn', 'stopReason', 'monthlyQty',
  // field sales (v6): star rating 1-5 of the hotel's interest
  'rating',
  'mailedFor', 'escalatedFor',
]
const SERVER_ONLY = ['mailedFor', 'escalatedFor'] // owned by the reminder job, never overwritten by the app
const CALL_HEADERS = ['at', 'leadId', 'name', 'phone', 'outcome', 'remark', 'next', 'by', 'duration', 'mode', 'lat', 'lng', 'rating', 'area'] // mode: visit | call
const CALLER_HEADERS = ['id', 'name', 'pin', 'active', 'createdAt', 'role', 'email'] // role: caller | field

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
    o.role = o.role === 'field' ? 'field' : 'caller'
    return o
  }).filter(function (c) { return c.id })
}

/** who is calling?  admin | caller | open (no callers created yet) | null (not allowed) */
function who_(auth) {
  if (auth && auth.role === 'admin' && ADMIN_PIN && String(auth.pin) === ADMIN_PIN) return { role: 'admin' }
  const cs = callers_().filter(function (c) { return c.active })
  if (!cs.length) return { role: 'open' }
  if (auth && (auth.role === 'caller' || auth.role === 'field')) {
    const c = cs.filter(function (x) { return x.id === auth.id && String(x.pin) === String(auth.pin) })[0]
    if (c) return { role: c.role, id: c.id, name: c.name, email: c.email || '' }
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
        callers: cs.map(function (c) { return { id: c.id, name: c.name, role: c.role } }),
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
        return o.id && (w.role === 'admin' || w.role === 'open' || o.assignedTo === w.id || o.fieldId === w.id)
      })
    }
    if (w.role === 'admin') out.callers = callers_()
    else if (w.id) out.me = { email: w.email || '', role: w.role }
    return json_(out)
  } catch (err) {
    return json_({ error: String(err) })
  }
}

/* ---------- write ---------- */
function upsertMany_(leads, w) {
  const sh = sheet_('Leads', LEAD_HEADERS)
  let h = hdrs_(sh)
  // future-proof: any new simple field the app sends gets its own column automatically
  const extra = []
  leads.forEach(function (l) {
    Object.keys(l).forEach(function (k) {
      if (h.indexOf(k) < 0 && extra.indexOf(k) < 0 && /^[A-Za-z][A-Za-z0-9_]{0,30}$/.test(k) && k !== 'calls' && k !== 'callsJson' && typeof l[k] !== 'object') extra.push(k)
    })
  })
  if (extra.length) {
    const start = sh.getLastColumn() + 1
    sh.getRange(1, start, sh.getMaxRows(), extra.length).setNumberFormat('@')
    sh.getRange(1, start, 1, extra.length).setValues([extra])
    style_(sh, start, extra.length)
    h = hdrs_(sh)
  }
  const idCol = h.indexOf('id')
  const asCol = h.indexOf('assignedTo')
  const fCol = h.indexOf('fieldId')
  const last = sh.getLastRow()
  const data = last > 1 ? sh.getRange(2, 1, last - 1, h.length).getValues() : []
  const index = {}
  const owner = {}
  const fowner = {}
  const OWNED = ['assignedTo', 'assignedName', 'assignedAt', 'fieldId', 'fieldName', 'fieldAt']
  data.forEach(function (r, i) { index[String(r[idCol])] = i + 2; owner[String(r[idCol])] = String(r[asCol]); fowner[String(r[idCol])] = fCol >= 0 ? String(r[fCol]) : '' })

  const fresh = []
  let rejected = 0
  leads.forEach(function (l) {
    const at = index[l.id]
    const mine = w.role === 'caller' || w.role === 'field'
    if (mine) {
      if (at && owner[l.id] !== w.id && fowner[l.id] !== w.id) { rejected++; return } // not her lead
      if (!at) { // a brand-new lead she created herself
        if (w.role === 'field') { l.fieldId = w.id; l.fieldName = w.name } else { l.assignedTo = w.id; l.assignedName = w.name }
      }
    }
    const old = at ? data[at - 2] : null
    const row = h.map(function (k, i) {
      if (old && (SERVER_ONLY.indexOf(k) >= 0 || (mine && OWNED.indexOf(k) >= 0))) return old[i] // callers/field people cannot change owners or reminder marks
      if (k === 'callsJson') return JSON.stringify(l.calls || [])
      return l[k] === undefined || l[k] === null ? '' : String(l[k])
    })
    if (at) sh.getRange(at, 1, 1, row.length).setValues([row])
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
      return c ? json_({ ok: true, name: c.name, role: c.role, email: c.email || '' }) : json_({ error: 'Wrong PIN' })
    }

    const w = who_(body.auth)
    if (!w) return json_({ error: 'Login required' })

    if (body.action === 'resolveMap') return json_(resolveMap_(String(body.url || '')))

    if (body.action === 'setEmail') {
      if (!w.id) return json_({ error: 'Login required' })
      const em = String(body.email || '').trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return json_({ error: 'Enter a valid email' })
      const csh = sheet_('Callers', CALLER_HEADERS), ch = hdrs_(csh), cl = csh.getLastRow()
      const ids = cl > 1 ? csh.getRange(2, 1, cl - 1, 1).getValues().map(function (r) { return String(r[0]) }) : []
      const at = ids.indexOf(String(w.id))
      if (at < 0) return json_({ error: 'Caller not found' })
      csh.getRange(at + 2, ch.indexOf('email') + 1).setValue(em)
      try { ensureTrigger_() } catch (x) {} // needs the one-time authorisation described in the README
      return json_({ ok: true, email: em })
    }

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
      if (w.role === 'caller' || w.role === 'field') return json_({ error: 'Only HR can delete leads' })
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


/* ---------- follow-up e-mails: they go out even if the phone is off or the app is closed ---------- */
function ensureTrigger_() {
  const have = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'sendFollowupMails' })
  if (!have) ScriptApp.newTrigger('sendFollowupMails').timeBased().everyMinutes(10).create()
}
/** Run this ONCE from the Apps Script editor (Run -> setupFollowupMails) and accept the permissions. */
function setupFollowupMails() { ensureTrigger_(); sendFollowupMails() }

function sendFollowupMails() {
  const lock = LockService.getScriptLock()
  lock.waitLock(20000)
  try {
    const sh = sheet_('Leads', LEAD_HEADERS), last = sh.getLastRow()
    if (last < 2) return
    const h = hdrs_(sh), rows = sh.getRange(2, 1, last - 1, h.length).getValues()
    const col = function (k) { return h.indexOf(k) }
    const people = {}
    callers_().forEach(function (c) { people[c.id] = c })
    const now = Date.now(), CLOSED = ['Onboarded', 'Not Interested', 'Reactivated']
    const mails = {}, late = []
    rows.forEach(function (r, i) {
      const g = function (k) { return String(r[col(k)] || '') }
      const nf = g('nextFollowUp'), t = new Date(nf).getTime()
      if (!nf || isNaN(t) || CLOSED.indexOf(g('status')) >= 0 || now - t > 48 * 3600e3) return
      const item = { name: g('name') || g('phone'), phone: g('phone'), area: g('area'), addr: g('address'), map: g('mapUrl'), remark: g('lastRemark'), when: nf, type: g('type') }
      if (t - now <= 30 * 60000 && g('mailedFor') !== nf) {
        [g('assignedTo'), g('fieldId')].forEach(function (id) {
          const p = people[id]
          if (p && p.email) (mails[p.email] = mails[p.email] || []).push(item)
        })
        sh.getRange(i + 2, col('mailedFor') + 1).setValue(nf)
      }
      if (ADMIN_EMAIL && now - t > 2 * 3600e3 && g('escalatedFor') !== nf) {
        late.push(item)
        sh.getRange(i + 2, col('escalatedFor') + 1).setValue(nf)
      }
    })
    const fmt = function (iso) { return Utilities.formatDate(new Date(iso), 'Asia/Kolkata', 'dd MMM, h:mm a') }
    const li = function (x) {
      return '<li style="margin-bottom:10px"><b>' + x.name + '</b> (' + fmt(x.when) + ')<br>' +
        (x.phone ? '<a href="tel:+91' + x.phone.slice(-10) + '">Call ' + x.phone + '</a> ' : '') +
        (x.area || x.addr ? ' · ' + (x.addr || x.area) : '') +
        (x.type === 'hotel' ? ' · <a href="' + (x.map || 'https://www.google.com/maps/search/' + encodeURIComponent((x.name + ' ' + (x.addr || x.area) + ' Chennai'))) + '">📍 Map</a>' : '') +
        (x.remark ? '<br><i>Last: ' + x.remark + '</i>' : '') + '</li>'
    }
    Object.keys(mails).forEach(function (to) {
      MailApp.sendEmail({ to: to, subject: '⏰ Follow-up due: ' + mails[to].length + ' to call / visit', htmlBody: '<p>Your follow-ups are due:</p><ul>' + mails[to].map(li).join('') + '</ul><p>— Sridhi Caller App</p>' })
    })
    if (late.length) MailApp.sendEmail({ to: ADMIN_EMAIL, subject: '🚨 ' + late.length + ' follow-up(s) overdue by 2+ hours', htmlBody: '<ul>' + late.map(li).join('') + '</ul>' })
  } finally { lock.releaseLock() }
}


/* ---------- Google Maps short links (maps.app.goo.gl) -> coordinates ----------
 * Phones share short links that hide the coordinates. The browser cannot open them (CORS),
 * so the app asks this script to follow the redirects and read the latitude / longitude.
 * One-time: in the editor run authorizeFetch() once and accept the permission. */
function authorizeFetch() { UrlFetchApp.fetch('https://www.google.com/generate_204', { muteHttpExceptions: true }) }

function mapCoords_(t) {
  t = String(t || '')
  try { t = decodeURIComponent(t) } catch (x) {}
  var m = t.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)               // the exact marker
       || t.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)                  // map centre
       || t.match(/[?&](?:q|ll|query|destination|daddr)=(-?\d+\.\d+)[,+ ]+(-?\d+\.\d+)/)
       || t.match(/center=(-?\d+\.\d+)[,&]+(?:amp;)?(-?\d+\.\d+)/)
       || t.match(/\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/)
  if (!m) return null
  var la = Number(m[1]), ln = Number(m[2])
  return la > 5 && la < 38 && ln > 66 && ln < 99 ? { lat: la, lng: ln } : null
}

function resolveMap_(url) {
  var u = (url.match(/https?:\/\/[^\s]+/) || [''])[0]
  if (!/^https?:\/\/((maps\.app\.)?goo\.gl|(www\.|maps\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|g\.co\/kgs)/i.test(u)) return { ok: false, reason: 'That is not a Google Maps link' }
  var cur = u
  try {
    for (var i = 0; i < 7; i++) {
      var p = mapCoords_(cur)
      if (p) return { ok: true, lat: p.lat, lng: p.lng, url: cur }
      var r = UrlFetchApp.fetch(cur, { followRedirects: false, muteHttpExceptions: true, headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36', 'Accept-Language': 'en-IN,en;q=0.9' } })
      var code = r.getResponseCode(), h = r.getHeaders(), loc = h['Location'] || h['location']
      if (code >= 300 && code < 400 && loc) { cur = loc.indexOf('http') === 0 ? loc : 'https://www.google.com' + loc; continue }
      var q = mapCoords_(r.getContentText())
      if (q) return { ok: true, lat: q.lat, lng: q.lng, url: cur }
      break
    }
  } catch (e) {
    return { ok: false, reason: /permission|authoriz/i.test(String(e.message || e)) ? 'The script needs permission to open links. In Apps Script run authorizeFetch once and accept, then Deploy a New version.' : 'Could not open the link: ' + String(e.message || e).slice(0, 120) }
  }
  return { ok: false, reason: 'No coordinates found in that link. Open it in Google Maps and use Share, or paste the numbers.' }
}
