# Sridhi Caller App 🌿📞

Telecaller app for **hiring distributors in Bengaluru** and **sales follow-up**.
React + Vite · Framer Motion + CSS 3D · Google Sheets as the database · installable on mobile.

## Run it

```bash
npm install
npm run dev        # open the URL on your PC, or on your phone (same Wi-Fi)
npm run build      # production build in /dist
```

## Connect Google Sheets (the database)

1. Create a new Google Sheet → **Extensions → Apps Script**.
2. Paste everything from `apps-script/Code.gs` → Save.
3. **Deploy → New deployment → Web app** → Execute as **Me**, access **Anyone**.
4. Copy the Web app URL → in the app go to **More → Settings → Web app URL** → **Sync now**.

Sheets `Leads` and `Calls` are created automatically. The app also works offline (saved on the device) and syncs when online.
Optional: set `SECRET` in the script and enter the same key in Settings.

## Put it on the telecaller's phone

Deploy the `dist` folder free on Vercel / Netlify / Cloudflare Pages, open the link in Chrome on the phone →
menu → **Add to Home screen**. It opens full-screen like an app.

## Features

- **3D splash**, 3D-tilt cards, flip stat cards, floating hero, spring animations everywhere
- **Dashboard**: daily call target ring, overdue / due today / hot / onboarded, weekly chart, pipeline funnel
- **Leads**: Distributor-hiring and Sales/Retailer types, Bengaluru areas, search, filters, sort, duplicate-phone warning
- **Call Mode**: swipeable card stack of due follow-ups + fresh leads, one-tap *Not answered / Busy / Wrong number*
- **Lead sheet**: Call button with live call timer, WhatsApp, outcome chips, quick remarks, temperature, status, next follow-up
- **Reminders**: Google Calendar link, Gmail reminder mail, `.ics` file (with alarms), in-app pop-up + vibration when a follow-up is due, snooze buttons
- **Follow-ups**: 10-day calendar strip, Due now / Upcoming, export all to calendar
- **Reports**: calls, connect %, outcomes, funnel, top areas, CSV export
- **Scripts**: pitch, qualifying questions, objection handling, WhatsApp templates (edit the `[placeholders]`)
- **Import** company data from CSV or paste from Excel; duplicates skipped
