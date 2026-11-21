# Batter Stock – Idli Dosa Batter daily stock app (React + Vite PWA)

## Run on a computer
    npm install
    npm run dev        # test
    npm run build      # creates the `dist` folder

## Put it on the internet (so phones can install it)
Upload the `dist` folder to Netlify (drag & drop at app.netlify.com/drop), Vercel or Cloudflare Pages.
Open the link on the phone in Chrome -> "Install app" / "Add to Home screen".

## Daily formula
Closing = Opening + Purchase - Vehicle load - Extra load + Returned - Damage(cold room) - Sampling - Mixing
Sold    = Load + Extra - Returned - Damage(in vehicle)
Closing (or the physical count entered under "Close the day") becomes the next day's opening.

Data is stored on the phone (localStorage + IndexedDB for photos). Use Settings -> Backup to move/save it.

## Push & deploy (easiest)
1. Push this folder to a GitHub repo.
2. Connect the repo on Netlify / Vercel / Cloudflare Pages (build: `npm run build`, output: `dist`).
3. Open the link on the phone in Chrome -> Install app.
Or skip the build: upload the ready `dist` folder directly.
