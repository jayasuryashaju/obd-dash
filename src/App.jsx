import { useEffect, useRef, useState } from 'react';
import { useDash, actions } from './store.js';
import { WebBleTransport, isNative } from './obd/transports.js';
import { tyreFactor, tyreDiameter } from './car.js';
import Studio from './studio/Studio.jsx';
import Touring, { TouringNight } from './cluster/Touring.jsx';
import Heritage from './cluster/Heritage.jsx';
import Chrono from './cluster/Chrono.jsx';
import Digital from './cluster/Digital.jsx';
import Horizon from './cluster/Horizon.jsx';
import Sport from './cluster/Sport.jsx';
import Motorsport from './cluster/Motorsport.jsx';
import Data from './dashboards/Data.jsx';
import { sweep } from './cluster/kit.jsx';

export const DASHBOARDS = [
  { name: 'Studio', C: Studio },
  { name: 'Touring', C: Touring },
  { name: 'Touring Night', C: TouringNight },
  { name: 'Heritage', C: Heritage },
  { name: 'Chrono', C: Chrono },
  { name: 'Digital', C: Digital },
  { name: 'Horizon', C: Horizon },
  { name: 'Sport', C: Sport },
  { name: 'Motorsport', C: Motorsport },
  { name: 'Data', C: Data },
];

const STATUS_TEXT = {
  disconnected: 'Not connected',
  pairing: 'Choose your adapter…',
  connecting: 'Connecting…',
  initialising: 'Talking to ECU…',
  live: 'Live',
  error: 'Connection failed',
};

function useWakeLock(active) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock;
    const get = async () => { try { lock = await navigator.wakeLock.request('screen'); } catch { /* ignore */ } };
    const onVis = () => document.visibilityState === 'visible' && get();
    get();
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); lock?.release?.(); };
  }, [active]);
}

async function goFullscreen() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    await screen.orientation?.lock?.('landscape');
  } catch { /* not supported – fine */ }
}

export default function App() {
  const d = useDash();
  const idx = d.settings.dashboard % DASHBOARDS.length;
  const [chrome, setChrome] = useState(true);
  const [panel, setPanel] = useState(null); // 'settings' | 'log' | null
  const hideTimer = useRef();
  const swipe = useRef(null);
  const live = d.status === 'live';
  const showStart = d.status !== 'live';

  useWakeLock(live);

  const poke = () => {
    setChrome(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setChrome(false), 4000);
  };
  useEffect(() => { if (live) poke(); }, [live]);
  // OEM-style needle self-test sweep on connect and when switching cluster
  useEffect(() => { if (live) sweep(); }, [live, idx]);

  const go = (n) => {
    actions.updateSettings({ dashboard: (n + DASHBOARDS.length) % DASHBOARDS.length });
    poke();
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') go(idx + 1);
      if (e.key === 'ArrowLeft') go(idx - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onDown = (e) => { swipe.current = { x: e.clientX, y: e.clientY, t: Date.now() }; };
  const onUp = (e) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(idx + (dx < 0 ? 1 : -1));
    else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) chrome ? setChrome(false) : poke();
  };

  const { C } = DASHBOARDS[idx];

  return (
    <div className="app">
      <div className="stage" onPointerDown={onDown} onPointerUp={onUp}>
        <C d={d} />
      </div>

      {showStart && <StartScreen d={d} />}

      {!showStart && (
        <>
          <div className={`topbar ${chrome || panel ? 'show' : ''}`}>
            <span className={`pill ${d.status}`}>
              <i />{d.source === 'demo' ? 'Demo' : STATUS_TEXT[d.status]}
            </span>
            <div className="tabs">
              {DASHBOARDS.map((x, i) => (
                <button key={x.name} className={i === idx ? 'on' : ''} onClick={() => go(i)}>{x.name}</button>
              ))}
            </div>
            <div className="actions">
              <button onClick={goFullscreen} title="Fullscreen">⛶</button>
              <button onClick={() => setPanel(panel === 'log' ? null : 'log')} title="Log">≡</button>
              <button onClick={() => setPanel(panel === 'settings' ? null : 'settings')} title="Settings">⚙</button>
            </div>
          </div>
          <div className={`dots ${chrome ? 'show' : ''}`}>
            {DASHBOARDS.map((x, i) => <i key={x.name} className={i === idx ? 'on' : ''} />)}
          </div>
        </>
      )}

      {panel === 'settings' && <Settings d={d} close={() => setPanel(null)} />}
      {panel === 'log' && <LogPanel d={d} close={() => setPanel(null)} />}
    </div>
  );
}

function StartScreen({ d }) {
  const native = isNative();
  const bleOk = native || WebBleTransport.available();
  const busy = ['pairing', 'connecting', 'initialising'].includes(d.status);
  const [paired, setPaired] = useState(null); // null = list closed
  const last = d.settings.lastClassic;

  const connectClassic = (dev) => {
    setPaired(null);
    actions.updateSettings({ lastClassic: dev });
    goFullscreen();
    actions.connectObd('classic', dev);
  };
  const openPaired = async () => setPaired(await actions.listClassic());

  return (
    <div className="start">
      <div className="start-card">
        <h1>WagonR Dash</h1>
        <p className="sub">2016 WagonR VXi · K10B · OBD-II over Bluetooth</p>

        {busy ? (
          <div className="start-busy"><i className="spin" />{STATUS_TEXT[d.status]}</div>
        ) : paired ? (
          <div className="paired">
            <div className="paired-head">
              <b>Paired Classic Bluetooth devices</b>
              <button onClick={() => setPaired(null)}>✕</button>
            </div>
            {paired.length === 0 && (
              <p className="note">Nothing paired. Pair the adapter in Android Settings → Bluetooth first (PIN is usually 1234 or 0000).</p>
            )}
            {paired.map((dev) => (
              <button key={dev.address} className="paired-item" onClick={() => connectClassic(dev)}>
                <span>{dev.name || 'Unknown'}</span><small>{dev.address}</small>
              </button>
            ))}
          </div>
        ) : (
          <>
            {native && last && (
              <button className="reconnect" onClick={() => connectClassic(last)}>
                Reconnect <b>{last.name || last.address}</b>
              </button>
            )}
            <div className="start-btns">
              <button className="primary" disabled={!bleOk} onClick={() => { goFullscreen(); actions.connectObd('ble'); }}>
                BLE adapter
              </button>
              {native && <button className="primary alt" onClick={openPaired}>Classic Bluetooth</button>}
              <button onClick={() => { goFullscreen(); actions.startDemo(); }}>Demo drive</button>
            </div>
          </>
        )}

        {!native && (
          <p className="note">
            {bleOk ? 'In the browser, only BLE adapters work.' : <span className="warnc">This browser can't use Bluetooth. Use <b>Chrome on Android</b> over https.</span>}{' '}
            Adapters that pair with a PIN (Classic Bluetooth) need the <b>Android app</b> build.
          </p>
        )}
        {native && (
          <p className="note">
            <b>Classic</b>: adapters you pair in Android settings with a PIN (most blue ELM327 v1.5/v2.1).{' '}
            <b>BLE</b>: adapters that don't show up in Android pairing (Vgate iCar Pro BLE, Veepeak BLE…). Turn ignition ON first.
          </p>
        )}
        {d.log.length > 0 && <pre className="log">{d.log.slice(-8).join('\n')}</pre>}
      </div>
    </div>
  );
}

function Settings({ d, close }) {
  const s = d.settings;
  const num = (key, step) => (
    <input type="number" step={step} value={s[key]}
      onChange={(e) => actions.updateSettings({ [key]: parseFloat(e.target.value) || 0 })} />
  );
  const txt = (key) => (
    <input type="text" className="wide" value={s[key]} spellCheck={false}
      onChange={(e) => actions.updateSettings({ [key]: e.target.value.toUpperCase() })} />
  );
  const tf = tyreFactor(s.tyreStock, s.tyre);
  const dS = tyreDiameter(s.tyreStock);
  const dF = tyreDiameter(s.tyre);
  return (
    <div className="panel">
      <div className="panel-head"><h2>Settings</h2><button onClick={close}>✕</button></div>
      <h3>Tyres</h3>
      <label>Stock size (ECU calibration) {txt('tyreStock')}</label>
      <label>Fitted size {txt('tyre')}</label>
      <p className="note tight">
        {dS && dF
          ? <>Stock {dS.toFixed(0)} mm, fitted {dF.toFixed(0)} mm. OBD speed is scaled by <b>{((tf - 1) * 100).toFixed(1)}%</b> to show true speed.</>
          : <span className="warnc">Use the format 185/45R15.</span>}
      </p>
      <h3>Fuel</h3>
      <p className="note tight">
        Source: <b>{{ ecu: 'ECU fuel rate (PID 5E) – exact', maf: 'MAF airflow sensor', estimate: 'Estimated from MAP – set VE below to calibrate' }[d.fuelSrc] || 'not connected'}</b>
      </p>
      <h3>Engine</h3>
      <label>Shift light at (rpm) {num('shiftRpm', 100)}</label>
      <label>Redline (rpm) {num('redline', 100)}</label>
      <h3>Calibration</h3>
      <label>Extra speed trim × {num('speedCorrection', 0.01)}</label>
      <label>Volumetric efficiency (fuel calc) {num('ve', 0.01)}</label>
      <div className="panel-btns">
        <button onClick={actions.resetTrip}>Reset trip</button>
        <button className="danger" onClick={() => { actions.disconnect(); close(); }}>Disconnect</button>
      </div>
      <p className="note">Swipe left/right on the dashboard to switch designs. Tap to show/hide controls.</p>
    </div>
  );
}

function LogPanel({ d, close }) {
  return (
    <div className="panel">
      <div className="panel-head"><h2>Adapter log</h2><button onClick={close}>✕</button></div>
      <pre className="log tall">{d.log.join('\n') || 'Nothing yet.'}</pre>
    </div>
  );
}
