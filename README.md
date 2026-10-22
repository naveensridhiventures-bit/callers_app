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
- Hubs page has a **Download PDF** button: summary tiles, region bars, hub overview, distributors per hub, and an all-areas appendix.
- **Accurate area:** the lead form's area is now a searchable picker of the exact selling areas from the hub plan (each shows its Hub). Picking one stores the area and the hub on the lead. Typing something not in the plan shows a warning. The Hubs page (and PDF) shows per hub which areas already have a distributor and which are **still needed**.
- **Other area:** an area not in the hub plan goes under **Other** (hub = Other). The Hubs page and PDF list these in an 'Other areas' group; leads with no area show under 'No area yet'.

## Lapsed hotels, field person, Gmail follow-up mails (script v5)
- **Update Apps Script to v5** (paste `apps-script/Code.gs`, deploy a new version), set `ADMIN_EMAIL`, then in the Apps Script editor run **`setupFollowupMails`** once and accept the permissions. This starts a 10-minute timer that e-mails follow-ups (name, phone, map link) 30 min before they are due, even when the app is closed. HR gets an alert for follow-ups 2+ hours overdue.
- **HR → Callers → Add** now has a role: *Caller* or *Field person* (same name + PIN login).
- **HR → Hotels:** import hotels that stopped ordering (CSV/paste: hotel name, phone optional, map link optional), or convert existing Hotel/Restaurant leads, then **bulk assign to a caller and a field person** at once.
- **Caller + field person** see hotel name, contact (if given), address and a 📍 button → location popup (live map, Navigate, Open in Maps, Share, GPS check-in). Visits and win-back outcomes (Order Restarted, Will Order Soon, Revisit Needed, Hotel Closed…) are logged like calls, with follow-ups.
- **First login:** a popup asks for the Gmail ID used for follow-up mails.

## Field sales (Chennai) - v6

A person added as **Field** in HR Control gets a Chennai-only app: no Bengaluru hubs, distributors or scripts.

- **Today**: visits and calls so far, average interest, follow-ups due. Pick a Chennai area, then **Start visits**.
- **Visit run**: one hotel at a time, nearest first from the live GPS position (nearest-neighbour + 2-opt route), with a map, Navigate, call/WhatsApp, check-in, outcome, **1-5 star interest rating** and follow-up. The next hotel is re-planned from where you stand after every save.
- **Hotels**: filter by area. Add a hotel on the road with the + button and pin your current location.
- **Report**: pick a day, week, month or custom dates, filter by area and visits / calls, then download **PDF, Excel or CSV**, or copy the WhatsApp message.

Paste the new `apps-script/Code.gs` (version 6) and deploy a new version so ratings, visit/call type and area are saved to the Sheet.

## Field flow redesign (r1022a)

Built the way a field salesperson works through a day: **Follow up → Plan → Visit → Remark → Report**.

- **Today**: one "Do this next" card (follow-ups due first, then hotels waiting), KPIs, a 4-step guide and tap-to-plan area chips.
- **Plan** (tab): list switch *To visit / Follow-up due / Done today*, search, area chips, filters (why they stopped, KG, sort), tick hotels or **Select all**, then the pinned **Start visit** bar. Nothing ticked = visit everything shown, nearest first.
- **Hotel card**: why they stopped (colour tags + original reason), KG, distance, last outcome and remark, follow-up date, and one-tap **Map / Call / Remark / Visit**.
- **Visit card**: *Why they stopped* panel sits right above the map (with a "How to win them back" tip). **I have reached** is pinned at the bottom of the screen. The location popup shows the same panel.
- **Remark sheet**: numbered steps (How did it go → Interest → What they said and why they stopped → When to go back). Outcomes that need a revisit require a follow-up date. **Save** stays pinned.
- **Follow-ups** (tab): Overdue / Today / Upcoming, visit all due hotels in one run, move a follow-up (+1h, 5 PM, tomorrow, next week).
- The floating + button is removed for field users (it covered cards); use **+ Hotel** in the Plan header.
No Apps Script change needed.
