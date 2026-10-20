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

### Update the Apps Script to v4 (needed for HR admin, callers, delete requests, assigned date)
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

## HR admin dashboard (open `/control`)

- **Progress:** calls made, connected %, positive calls, onboarded, unassigned, overdue; calls-per-day chart, pipeline funnel, caller leaderboard and a live activity feed. Filter Today / 7 days / 30 days / All.
- **Callers:** one card per caller with last-active time, assigned / calls / connected % / interested / not called / overdue, an *interest-level bar* (Onboarded, Hot, Warm, Cold, Number tried, Not called), a 7-day chart, her leads (filter by interest) and recent calls. Add or remove callers here.
- **Assign, Leads, Requests, Settings** as before. On a PC the admin gets a sidebar; on a phone a bottom bar.
- Interest level: Onboarded = status Onboarded; Hot = priority Hot or status Interested / Meeting Fixed / Documentation; Cold = Not Interested or priority Cold; Warm = called, otherwise; Number tried = a bare number that was called; Not called = no calls yet.

## Mobile fixes
Bottom sheets are CSS-animated and can no longer get stuck on screen; after choosing a call outcome the panel scrolls to Remark / Follow-up and the **Save** button stays pinned at the bottom.

## EOD & reports

- **Caller:** More → **📋 EOD** (and the card on Home, highlighted after 5 PM). Pick Today / Yesterday / This week / This month / Custom dates, then:
  - **Copy for WhatsApp**: an emoji-formatted message (calls, connected, details updated, interested, meetings, onboarded, outcomes, highlights, tomorrow's follow-ups, pipeline, your note) ready to paste in the management group. Also *Open WhatsApp* and *Share…*.
  - **Download PDF** (branded, charts + tables + full call log) or **Download Excel** (Summary, By Caller, Activity Log, Highlights & Follow-ups, Leads Snapshot). On phones that support it, *Share PDF on WhatsApp* sends the file directly.
- **Admin:** sidebar **Reports** (or the card on Progress): same options for the whole team or one caller, with a caller-wise leaderboard.
- **What counts as "called":** logging a call, **adding a new lead after speaking**, or **updating a lead's details** all mark the lead as called (the first time it is touched it counts as a call; later edits are logged as *Details updated*).
- PDF/Excel libraries are loaded only when you press download, so the app stays fast.

## Assigned date & time
Every lead now remembers **when it was assigned** (`assignedAt`): on HR assign, import, reassign, or when a caller adds it. Callers see a **📥 Today, 2:57 pm** tag and a **🆕 New** tag on cards, leads are **grouped by day** (Today / Yesterday / date) with counts, and there are date chips (All dates, Today, Yesterday, This week, Pick date). Home shows "N new leads assigned today". The Excel report has an *Assigned on* column. Needs script **v4** (older leads fall back to the day they were added).

## Close every call + follow-up reminders
- Tapping **Call** records a pending call. When the caller comes back from the dialer (or reopens the app) a popup forces her to close it: **No Response / Switched Off / Not Reachable / Busy** (one tap, follow-up auto-set, can be changed with chips) or **Spoke to the person** (opens the lead with the outcome pre-selected).
- Another call cannot be started until the pending one is closed. "Later" snoozes 10 min and a red banner stays on Home.
- After login/open, and after 30+ min away, a **Follow-ups need you** popup lists overdue and today's leads with Call, WhatsApp, +1h and +1d snooze. "Remind me in 30 min" re-shows it later.

## Other + Wrong Audience
- Call outcomes now include **Other** (asks "What happened?", required) and **Wrong Audience** (popup: Household, Student, Hotel/Restaurant, Kirana, Already a distributor, Company, Other + type). The audience is saved on the lead and in the remark; the lead moves to Not Interested.
- Area in the lead form is a dropdown with **Other…**, which asks "Which area?".

## Hubs
- `src/hubData.js` holds the 40 hubs and 408 areas (5 km by road) from the hub plan workbook. The **Hubs** page (admin dock/sidebar, caller More → Hubs) shows each hub with its distributor count, areas and distributors, matched by the lead's Area. Leads with no area, or an area outside the plan, show under "No hub yet".
