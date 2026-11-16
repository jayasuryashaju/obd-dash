# WagonR Dash

Web dashboard for a 2016 Maruti WagonR VXi (K10B) that reads live data from a Bluetooth ELM327 OBD2 adapter. It opens on **Studio**, a fully customisable gauge screen (6 styles × dark/light, 5 complete layouts + 6 build-your-own panels, tap-to-edit any gauge), and also has eight fixed instrument clusters (Touring, Touring Night, Heritage, Chrono, Digital, Horizon, Sport, Motorsport) plus a Data diagnostics page. Tyre sizes (stock and fitted) are set in Settings, and OBD speed is corrected automatically.

## Run

```bash
npm install
npm run dev          # http://localhost:5173 on the PC (use "Demo drive")
npm run dev:phone    # https://<pc-ip>:5173 on your LAN, open it in Chrome on the phone
```

Web Bluetooth only works on **https** or **localhost**, and only in **Chrome on Android** (it doesn't work on iPhone Safari). `dev:phone` uses a self-signed certificate. On the phone, tap *Advanced → Proceed* once.

To use it in the car permanently, run `npm run build` and host `dist/` on any https host (Vercel, Netlify, GitHub Pages). Then use Chrome's *Add to Home screen* so it opens fullscreen.

## Adapters: BLE and Classic Bluetooth

| Adapter type | How to tell | Browser (Chrome Android) | Android app |
|---|---|---|---|
| **BLE** (Vgate iCar Pro BLE, Veepeak BLE, OBDLink CX) | Doesn't appear in Android Bluetooth pairing | yes | yes |
| **Classic** (most blue ELM327 v1.5/v2.1) | Pairs in Android settings with PIN 1234 / 0000 | no | yes |

## Android app (supports both)

`WagonR-Dash.apk` in this folder is a debug build. Copy it to the phone and install it (you'll need to allow "install unknown apps").

For a Classic adapter, pair it first in Android Settings → Bluetooth. Then open the app, tap **Classic Bluetooth** and pick it. After the first connection there's a one-tap **Reconnect** button.

Rebuild after changing code (Android Studio's JDK 17+ is required):

```bash
npm run android:sync
cd android && ./gradlew assembleDebug    # → android/app/build/outputs/apk/debug/app-debug.apk
```

`npm run android:open` opens the project in Android Studio if you'd rather run it from there.

## Structure

- `src/obd/elm327.js`: ELM327 init and PID polling loop (transport-agnostic)
- `src/obd/transports.js`: Web Bluetooth, native BLE and Classic SPP links
- `android/app/src/main/java/com/obddash/wagonr/ClassicBtPlugin.java`: native Classic Bluetooth (RFCOMM) plugin
- `src/obd/pids.js`: PID formulas and supported-PID detection
- `src/obd/simulator.js`: fake drive for demo mode
- `src/car.js`: WagonR profile (gear ratios, tyre size, redline), gear estimate, fuel-rate calculation
- `src/store.js`: live state, trip stats, history, settings
- `src/cluster/kit.jsx`: gauge engine (geometry, spring needles, start-up sweep, warning lamps, layered rendering)
- `src/cluster/*`: one file per instrument cluster
- `src/studio/*`: Studio – sensor catalogue, styles, blade gauge widgets, layouts and the editor UI
- `src/dashboards/Data.jsx`: sensor diagnostics grid

## Learning & Insights (on-device)

Everything below is learned on the phone and stored locally – nothing leaves the device unless you use **Ask AI**. Demo-mode data is kept separate from your car's data.

- **Trips** are recorded automatically (engine on → off, or disconnect): distance, economy, idle time, harsh acceleration/braking, shift points and a 0–100 score.
- **Gear learning**: steady driving teaches the real speed-to-rpm ratio of each gear; after 25 samples per gear the learned value replaces the book value.
- **Fuel calibration**: log every fill-up in *Insights → Fuel & tank*. Each full-to-full tank solves correction factors per rpm range, so km/L converges on your engine. The same data drives the tank level and range estimate.
- **Driving style**: shift points, throttle use, harshness and idling build a profile (Eco / Balanced / Sporty). The shift-up hint adapts – an efficient point at light throttle, your shift-light rpm when accelerating hard.
- **Car health**: the app learns what's normal for *your* car (battery at rest, charging voltage, running temperature, warm-up time, long-term fuel trim, idle rpm) and alerts you when a drive is well outside that.

Code: `src/learn/learner.js`, UI in `src/insights/`.

## Ask AI (optional)

`server/index.js` is a tiny Node server that keeps your Anthropic API key off the phone and forwards questions (with a compact summary of the learned data) to Claude.

Deploy it on Render as a **Web Service** from this repo:

- Build command: `npm ci --omit=dev`
- Start command: `node server/index.js`
- Environment variables:
  - `ANTHROPIC_API_KEY` – your key from console.anthropic.com
  - `APP_TOKEN` – any long random string (a password for your server)

Then in the app open *Insights → Ask AI → Server settings*, set the server address (e.g. `https://wagonr-dash-api.onrender.com`) and paste the same `APP_TOKEN`. The server allows requests only from the web app and the Android app, limits each IP to 40 questions an hour, and uses `claude-opus-5-5`.
