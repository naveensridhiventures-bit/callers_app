import { useRef, useState } from 'react'
import { useApp } from '../store'
import { Icon } from '../ui'
import { parseCSV, rowsToLeads } from '../utils'
import script from '../../apps-script/Code.gs?raw'

export default function Settings() {
  const { settings, setSettings, sync, syncNow, importLeads, leads, clearAll, loadSample, toast } = useApp()
  const [paste, setPaste] = useState('')
  const [guide, setGuide] = useState(false)
  const file = useRef()
  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }))

  const doImport = (text) => {
    const arr = rowsToLeads(parseCSV(text))
    if (!arr.length) return toast('No rows found. Need columns: name, phone, area…', 'warn')
    const { added, skipped } = importLeads(arr)
    toast(`Imported ${added} leads${skipped ? ` · ${skipped} duplicates skipped` : ''} ✓`)
    setPaste('')
  }
  const onFile = async (e) => {
    const f = e.target.files?.[0]
    if (f) doImport(await f.text())
    e.target.value = ''
  }
  const notif = async () => {
    if (!('Notification' in window)) return toast('Notifications not supported here', 'warn')
    const p = await Notification.requestPermission()
    toast(p === 'granted' ? 'Reminders enabled 🔔' : 'Permission not granted', p === 'granted' ? 'ok' : 'warn')
  }

  const status = { off: ['#94a3b8', 'Not connected'], syncing: ['#f59e0b', 'Syncing…'], ok: ['#16a34a', 'Connected'], error: ['#ef4444', 'Error'] }[sync.state]

  return (
    <div className="sub">
      <section className="card form">
        <h3>👤 Telecaller profile</h3>
        <div className="grid2">
          <label className="field"><span>Your name</span><input value={settings.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Priya" /></label>
          <label className="field"><span>Gmail (for reminders)</span><input type="email" value={settings.email} onChange={(e) => set('email', e.target.value)} placeholder="you@gmail.com" /></label>
        </div>
        <label className="field"><span>Daily call target</span><input inputMode="numeric" value={settings.target} onChange={(e) => set('target', Number(e.target.value.replace(/\D/g, '')) || 0)} /></label>
        <button className="btn-soft" onClick={notif}><Icon name="bell" /> Enable in-app reminders</button>
      </section>

      <section className="card form">
        <h3>☁️ Google Sheets database</h3>
        <div className="sync-st"><i style={{ background: status[0] }} />{status[1]}{sync.msg && <small> · {sync.msg}</small>}</div>
        <label className="field"><span>Web app URL</span><input value={settings.sheetUrl} onChange={(e) => set('sheetUrl', e.target.value.trim())} placeholder="https://script.google.com/macros/s/…/exec" /></label>
        <label className="field"><span>Secret key (optional)</span><input value={settings.token} onChange={(e) => set('token', e.target.value)} placeholder="same as SECRET in the script" /></label>
        <div className="row-btns">
          <button className="btn3d" onClick={async () => toast((await syncNow()) ? 'Synced with Google Sheet ✓' : 'Sync failed - check URL', 'ok')}><Icon name="refresh" /> Sync now</button>
          <button className="btn-soft" onClick={() => setGuide((g) => !g)}><Icon name="book" /> {guide ? 'Hide' : 'Setup'} guide</button>
        </div>
        {guide && (
          <ol className="guide">
            <li>Create a new <b>Google Sheet</b> → <b>Extensions → Apps Script</b>.</li>
            <li>Delete the default code, paste the script below, and Save.</li>
            <li><b>Deploy → New deployment → Web app</b>. Execute as <b>Me</b>, access <b>Anyone</b>.</li>
            <li>Authorize, copy the <b>Web app URL</b> and paste it above, then tap <b>Sync now</b>.</li>
          </ol>
        )}
        {guide && <button className="btn-soft" onClick={() => { navigator.clipboard?.writeText(script); toast('Apps Script copied ✓') }}><Icon name="copy" /> Copy Apps Script</button>}
        <small className="hint">Works offline too - data is saved on this device and syncs when you are online.</small>
      </section>

      <section className="card form">
        <h3>📥 Import company data</h3>
        <p className="mini-note">CSV / Excel-paste with columns: <b>name, phone, area, company, type, notes</b>. Duplicate phone numbers are skipped.</p>
        <input ref={file} type="file" accept=".csv,text/csv,.txt,.tsv" hidden onChange={onFile} />
        <button className="btn-soft" onClick={() => file.current.click()}><Icon name="upload" /> Choose CSV file</button>
        <textarea rows={4} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'…or paste rows copied from Excel / Google Sheets\nname\tphone\tarea\nRavi\t9876543210\tWhitefield'} />
        {paste.trim() && <button className="btn3d" onClick={() => doImport(paste)}>Import pasted rows</button>}
      </section>

      <section className="card form">
        <h3>🧰 Data</h3>
        <p className="mini-note">{leads.length} leads on this device.</p>
        <div className="row-btns">
          <button className="btn-soft" onClick={loadSample}>Load sample data</button>
          <button className="btn-soft danger" onClick={() => { if (confirm('Delete ALL leads from this device? (Google Sheet data is not touched)')) { clearAll(); toast('Local data cleared') } }}>Clear local data</button>
        </div>
      </section>
    </div>
  )
}
