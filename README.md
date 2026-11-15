# WagonR Dash

Web dashboard for a 2016 Maruti WagonR VXi (K10B) that reads live data from a Bluetooth ELM327 OBD2 adapter. It has eight instrument clusters (Touring, Touring Night, Heritage, Chrono, Digital, Horizon, Sport, Motorsport) plus a Data diagnostics page. Tyre sizes (stock and fitted) are set in Settings, and OBD speed is corrected automatically.

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
- `src/dashboards/Data.jsx`: sensor diagnostics grid
