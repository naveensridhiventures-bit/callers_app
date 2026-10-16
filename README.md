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

### Update the Apps Script to v2 (needed for HR admin + callers)
1. Open your Google Sheet → **Extensions → Apps Script**.
2. Replace everything with `apps-script/Code.gs` and **change `ADMIN_PIN`** (the HR admin password).
3. **Deploy → Manage deployments → ✏️ → Version: New version → Deploy.**
   The URL stays the same, so the app needs no change.

## HR admin + callers

- **Hidden admin:** tap the *Sridhi* logo 5 times (login screen or top-left of the app) → enter `ADMIN_PIN`.
- **More → 🛡 Admin**
  - **Callers:** add a caller with a 4-digit PIN (HR gives her name + PIN).
  - **Assign:** filter leads, tick them, assign to a caller. Or **auto-distribute** between callers (area-wise or one by one).
  - **Import numbers:** paste *just phone numbers* (one per line) or name/phone/area columns, and assign on import.
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
