// Tiny external store: live values, derived values (gear, fuel), trip stats,
// short history for sparklines and persisted settings.
import { useSyncExternalStore } from 'react';
import { estimateGear, fuelRateLph, fuelSource, CAR, setTyre, tyreFactor } from './car.js';
import { Elm327 } from './obd/elm327.js';
import { WebBleTransport, NativeBleTransport, ClassicTransport, isNative } from './obd/transports.js';
import { Simulator } from './obd/simulator.js';
import { createLearner } from './learn/learner.js';

const SETTINGS_KEY = 'obd-dash-settings';
const HIST_KEYS = ['rpm', 'speed', 'throttle', 'load', 'map', 'coolant', 'iat', 'voltage', 'timing', 'stft', 'kmpl'];
const HIST_LEN = 120; // 60s at 2Hz

const defaultSettings = {
  dashboard: 0,
  shiftRpm: 5200,
  redline: CAR.redline,
  tyreStock: CAR.stockTyre,
  tyre: CAR.tyre,
  speedCorrection: 1.0, // extra manual trim on top of the tyre correction
  ve: 0.82,
  showHints: true,
  learning: true,
  aiUrl: 'https://wagonr-dash-api.onrender.com',
  aiToken: '',
};

function loadSettings() {
  try {
    return { ...defaultSettings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return { ...defaultSettings };
  }
}

const freshTrip = () => ({ start: Date.now(), distanceKm: 0, fuelL: 0, maxSpeed: 0, maxRpm: 0, movingS: 0 });

let state = {
  status: 'disconnected', // disconnected | pairing | connecting | initialising | live | error
  source: null, // 'obd' | 'demo'
  values: {},
  gear: 'N',
  shiftHint: false,
  fuelLph: null,
  fuelSrc: null,
  kmpl: null,
  trip: freshTrip(),
  history: Object.fromEntries(HIST_KEYS.map((k) => [k, []])),
  log: [],
  settings: loadSettings(),
  learn: null, // { tank, score, style, alerts } refreshed ~1 Hz
  toast: null,
};
setTyre(state.settings.tyre);

// Separate learners so demo driving never pollutes what's learned from the car.
export const learners = { obd: createLearner('wd'), demo: createLearner('wd-demo') };
let learner = learners.obd;
learner.onTyre(state.settings.tyre);
export const activeLearner = () => learner;
function useLearner(kind) {
  learner = learners[kind];
  learner.onTyre(state.settings.tyre); // re-applies its learned gears
}
let speedFactor = tyreFactor(state.settings.tyreStock, state.settings.tyre) * state.settings.speedCorrection;

const listeners = new Set();
let emitQueued = false;
function emit() {
  if (emitQueued) return;
  emitQueued = true;
  requestAnimationFrame(() => {
    emitQueued = false;
    listeners.forEach((l) => l());
  });
}
function set(patch) {
  state = { ...state, ...patch };
  emit();
}

let lastTs = 0;
let lastHist = 0;
function onData(partial) {
  const values = { ...state.values, ...partial };
  if (partial.speed != null) values.speed = partial.speed * speedFactor;
  const now = performance.now();
  const dt = lastTs ? Math.min(1, (now - lastTs) / 1000) : 0;
  lastTs = now;

  const gear = estimateGear(values.speed ?? 0, values.rpm ?? 0);
  const rpm = values.rpm ?? 0;
  const fuelSrc = fuelSource(values);
  const rawFuelLph = fuelRateLph(values, state.settings.ve);
  // calibrated with what's been learned from fill-ups (ECU fuel rate is exact)
  const fuelLph = rawFuelLph == null ? null : fuelSrc === 'ecu' ? rawFuelLph : rawFuelLph * learner.fuelFactor(rpm);
  const kmpl = fuelLph == null ? null : fuelLph < 0.05 ? (values.speed > 5 ? 99.9 : null) : Math.min(99.9, (values.speed ?? 0) / fuelLph);

  // Adaptive shift hint: light throttle → your learned efficient shift point,
  // hard acceleration → the shift-light rpm from Settings.
  const shiftHint = /^[1-4]$/.test(gear) &&
    rpm >= learner.shiftThreshold(values.throttle ?? 0, state.settings.shiftRpm);

  if (state.settings.learning) learner.ingest(values, { dt, gear, fuelLph, rawFuelLph, fuelSrc });

  const t = state.trip;
  const trip = {
    ...t,
    distanceKm: t.distanceKm + ((values.speed ?? 0) * dt) / 3600,
    fuelL: t.fuelL + ((fuelLph ?? 0) * dt) / 3600,
    maxSpeed: Math.max(t.maxSpeed, values.speed ?? 0),
    maxRpm: Math.max(t.maxRpm, values.rpm ?? 0),
    movingS: t.movingS + ((values.speed ?? 0) > 2 ? dt : 0),
  };

  let history = state.history;
  if (now - lastHist > 500) {
    lastHist = now;
    history = {};
    for (const k of HIST_KEYS) {
      const v = k === 'kmpl' ? kmpl : values[k];
      const arr = state.history[k];
      history[k] = v == null ? arr : [...arr.slice(-(HIST_LEN - 1)), v];
    }
  }
  const patch = { values, gear, shiftHint, fuelLph, fuelSrc, kmpl, trip, history };
  if (now - lastLearnSnap > 1000) {
    lastLearnSnap = now;
    patch.learn = learnSnapshot();
    const fresh = learner.takeNewAlerts();
    if (fresh.length) patch.toast = { ...fresh[fresh.length - 1], shownAt: Date.now() };
  }
  set(patch);
}

let lastLearnSnap = 0;
function learnSnapshot() {
  const lt = learner.liveTrip;
  return {
    tank: learner.tankInfo(),
    style: learner.styleLabel(),
    score: lt && lt.dist > 0.2 ? learner.scoreOf(lt) : null,
    alerts: learner.model.health.alerts.length,
    version: Date.now(),
  };
}

function log(msg) {
  const line = `${new Date().toLocaleTimeString()}  ${msg}`;
  set({ log: [...state.log.slice(-60), line] });
}

let source = null;
const handlers = { onData, onStatus: (status) => set({ status }), onLog: log };

export const actions = {
  /** kind: 'ble' | 'classic'; device: paired classic device {name, address} */
  async connectObd(kind = 'ble', device) {
    actions.disconnect();
    let transport;
    if (kind === 'classic') {
      transport = new ClassicTransport(device);
    } else if (isNative()) {
      transport = new NativeBleTransport();
    } else if (WebBleTransport.available()) {
      transport = new WebBleTransport();
    } else {
      log('Web Bluetooth not available. Use Chrome on Android, or the Android app.');
      set({ status: 'error' });
      return;
    }
    source = new Elm327(transport, handlers);
    useLearner('obd');
    set({ lastSource: 'obd', source: 'obd', status: 'pairing', values: {}, trip: freshTrip() });
    try {
      await source.connect();
    } catch (e) {
      log(e.message || String(e));
      source?.disconnect();
      source = null;
      set({ status: 'error', source: null });
    }
  },
  async listClassic() {
    try {
      return await ClassicTransport.listPaired();
    } catch (e) {
      log(e.message || String(e));
      return [];
    }
  },
  startDemo() {
    actions.disconnect();
    source = new Simulator(handlers);
    useLearner('demo');
    set({ lastSource: 'demo', source: 'demo', values: {}, trip: freshTrip() });
    source.connect();
  },
  disconnect() {
    learner.endTrip();
    if (source) source.disconnect();
    source = null;
    lastTs = 0;
    set({ status: 'disconnected', source: null });
  },
  resetTrip() {
    set({ trip: freshTrip() });
  },
  dismissToast() {
    set({ toast: null });
  },
  refreshLearn() {
    set({ learn: learnSnapshot() });
  },
  updateSettings(patch) {
    const settings = { ...state.settings, ...patch };
    setTyre(settings.tyre);
    learner.onTyre(settings.tyre);
    speedFactor = tyreFactor(settings.tyreStock, settings.tyre) * settings.speedCorrection;
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
    set({ settings });
  },
};

const subscribe = (l) => (listeners.add(l), () => listeners.delete(l));
const getSnapshot = () => state;
export const useDash = () => useSyncExternalStore(subscribe, getSnapshot);

// Save the trip in progress if the app is closed or backgrounded for good.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => learner.endTrip());
}
