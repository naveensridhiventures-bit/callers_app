import { useRef, useState } from 'react'
import { useApp } from '../store'
import { Icon } from '../ui'
import InstallBanner from '../components/InstallBanner'
import { fmtTime, parseCSV, rowsToLeads } from '../utils'
import script from '../../apps-script/Code.gs?raw'
import { readUpload } from '../cancelled'

export default function Settings() {
  const { settings, setSettings, sync, syncNow, importLeads, importHotels, leads, clearAll, loadSample, toast, session, logout } = useApp()
  const [paste, setPaste] = useState('')
  const file = useRef()
  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }))
  const canManageData = !session || session.role === 'admin'

  const doImport = (text) => {
    const arr = rowsToLeads(parseCSV(text))
    if (!arr.length) return toast('No rows found. Need columns: name, phone, area…', 'warn')
    const { added, skipped } = importLeads(arr)
    toast(`Imported ${added} leads${skipped ? ` · ${skipped} duplicates skipped` : ''} ✓`)
    setPaste('')
  }
  const onFile = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      const res = await readUpload(f)
      if (res.kind === 'cancelled') {
        // the cancelled-order list is a hotel list, so it goes to the hotels (not the number leads)
        const { added, skipped } = importHotels(res.leads)
        toast(`${added} cancelled-order hotel${added === 1 ? '' : 's'} imported${skipped ? ` · ${skipped} already there` : ''} ✓ Open the Hotels tab to assign them.`)
      } else doImport(res.text)
    } catch (err) { toast(`Could not read that file${err?.message ? `: ${String(err.message).slice(0, 80)}` : ''}`, 'warn') }
  }
  const notif = async () => {
    if (!('Notification' in window)) return toast('Notifications not supported here', 'warn')
    const p = await Notification.requestPermission()
    toast(p === 'granted' ? 'Reminders enabled 🔔' : 'Permission not granted', p === 'granted' ? 'ok' : 'warn')
  }

  const st = {
    idle: ['#94a3b8', 'Starting…'], syncing: ['#f59e0b', 'Syncing…'],
    ok: ['#16a34a', 'Up to date'], error: ['#ef4444', 'Will retry automatically'],
  }[sync.state]

  return (
    <div className="sub">
      <InstallBanner />
      {session && (
        <section className="card form">
          <h3>{session.role === 'admin' ? '🛡 HR admin' : `👤 ${session.name}`}</h3>
          <p className="mini-note">Signed in on this device.</p>
          <button className="btn-soft danger" onClick={async () => { await logout(); toast('Signed out') }}>Sign out</button>
        </section>
      )}

      <section className="card form">
        <h3>☁️ Google Sheets · auto-sync</h3>
        <div className="sync-st"><i style={{ background: st[0] }} />{st[1]}{sync.at && sync.state === 'ok' && <small> · {fmtTime(sync.at)}</small>}</div>
        <p className="mini-note">Everything you add or update is saved to the Google Sheet automatically, and new assignments arrive by themselves. No button needed. Offline? Changes wait on the phone and upload when the internet is back.</p>
        {sync.state === 'error' && sync.msg && <div className="warn">{sync.msg}</div>}
        <details className="adv">
          <summary>Advanced</summary>
          <button className="btn-soft sm" onClick={async () => toast((await syncNow()) ? 'Synced ✓' : 'Could not sync yet', 'ok')}><Icon name="refresh" size={16} /> Sync now</button>
          <label className="field"><span>Web app URL</span><input value={settings.sheetUrl} onChange={(e) => set('sheetUrl', e.target.value.trim())} /></label>
          <label className="field"><span>Secret key (optional)</span><input value={settings.token} onChange={(e) => set('token', e.target.value)} placeholder="same as SECRET in the script" /></label>
          <button className="btn-soft sm" onClick={() => { navigator.clipboard?.writeText(script); toast('Apps Script copied ✓') }}><Icon name="copy" size={16} /> Copy Apps Script (v2)</button>
        </details>
      </section>

      <section className="card form">
        <h3>🔔 My settings</h3>
        <div className="grid2">
          {!session && <label className="field"><span>Your name</span><input value={settings.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Priya" /></label>}
          <label className="field"><span>Gmail (for reminders)</span><input type="email" value={settings.email} onChange={(e) => set('email', e.target.value)} placeholder="you@gmail.com" /></label>
        </div>
        <label className="field"><span>Daily call target</span><input inputMode="numeric" value={settings.target} onChange={(e) => set('target', Number(e.target.value.replace(/\D/g, '')) || 0)} /></label>
        <button className="btn-soft" onClick={notif}><Icon name="bell" /> Enable in-app reminders</button>
      </section>

      {canManageData && (
        <>
          <section className="card form">
            <h3>📥 Import company data</h3>
            <p className="mini-note">Paste <b>phone numbers one per line</b>, or CSV / Excel columns: <b>name, phone, area, company, type, notes</b>. Duplicate phone numbers are skipped.{session?.role === 'admin' ? ' To import AND assign to a caller, use the Admin tab.' : ''}</p>
            <input ref={file} type="file" accept=".xlsx,.csv,text/csv,.txt,.tsv" hidden onChange={onFile} />
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
        </>
      )}
    </div>
  )
}
