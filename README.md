# Sridhi Caller App 🌿📞

Telecaller app for **hiring distributors in Bengaluru** and **sales follow-up**.
React + Vite · Framer Motion + CSS 3D · Google Sheets as the database · installable on mobile.

## Run it

```bash
npm install
npm run dev        # open the URL on your PC, or on your phone (same Wi-Fi)
npm run build      # production build in /dist
```

## Google Sheets (automatic)

The Web app URL is built into `src/constants.js` (`DEFAULT_SHEET_URL`), so every device syncs by itself:
on open, every 30 s, when the app comes back to the screen, and the moment the internet returns.
Offline changes are queued on the phone and uploaded automatically.
The tabs **Leads**, **Calls** and **Callers** are created by the script itself.

### Update the Apps Script to v3 (needed for HR admin, callers, delete requests)
1. Open your Google Sheet → **Extensions → Apps Script**.
2. Replace everything with `apps-script/Code.gs` and **change `ADMIN_PIN`** (the HR admin password).
3. **Deploy → Manage deployments → ✏️ → Version: New version → Deploy.**
   The URL stays the same, so the app needs no change.

## HR admin + callers

- **Hidden admin:** open `yourdomain.com/control` → enter `ADMIN_PIN` (default `hr@sridhi`, change it). Installing the app from that page gives HR a separate "Sridhi HR Control" icon.
- **More → 🛡 Admin**
  - **Callers:** add a caller with a 4-digit PIN (HR gives her name + PIN).
  - **Assign:** filter leads, tick them, assign to a caller. Or **auto-distribute** between callers (area-wise or one by one).
  - **Import numbers:** paste *just phone numbers* (one per line) or name/phone/area columns, and assign on import.
  - **Requests:** callers cannot delete leads; they send a *delete request* (with a note) and HR approves or keeps the lead.
  - **Team:** calls today / 7 days, interested, onboarded, overdue per caller.
- Once callers exist, the app asks for **name + PIN**; each caller gets **only her own numbers** (filtered on the server).
  New assignments arrive automatically with a pop-up.

## Caller flow for a bare number

1. HR assigns numbers. The caller sees only the phone number, tagged **📞 Number**.
2. She taps **Call**. If nobody answers, she logs **No Response / Switched Off / Not Reachable / Busy / Wrong Number**
   with a remark; the number stays a number and a retry follow-up is set.
3. If the person picks up: **Move to Distributor lead** or **Move to Sales lead** → the call page opens →
   **Add details** (name, shop, area…) → log what they said → set the next **follow-up**
   (Google Calendar / Gmail reminder / `.ics`).

## Other features

3D splash, tilt cards, Call Mode swipe stack, live call timer, dashboard with target ring,
Reports + CSV export, scripts and WhatsApp templates, in-app due reminders with vibration, installable on the phone home screen.

## Real-app behaviour

- **Install as app:** banner on Home/Login/Settings (Android/Chrome one tap; iPhone: Share → Add to Home Screen).
- **Back button:** goes to the previous page / closes the open sheet instead of leaving the app; on the first page it asks "Press back again to exit".
- **Edit / Delete:** open a lead → ✏️ Edit, 🗑 Delete (admin deletes; callers send a request).
- `/control` needs SPA rewrites on the host: `vercel.json` and `public/_redirects` (Netlify/Cloudflare) are included. GitHub Pages has no rewrites, so use Vercel/Netlify/Cloudflare Pages.
