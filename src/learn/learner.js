// On-device learning engine. Everything runs locally and persists to
// localStorage – no network. One instance per data source so demo-mode
// driving never pollutes the model learned from the real car.
//
//   • Trip recorder        – distance, fuel, idle, harsh events, shifts, health samples
//   • Gear learning        – real km/h-per-1000rpm for each gear from steady driving
//   • Fuel model           – per-rpm-band correction factors solved from fill-ups
//   • Tank & range         – counts down from the last full tank
//   • Driving style        – shift points, throttle use, harshness → adaptive shift hint
//   • Health baselines     – what's normal for THIS car → early-warning alerts
import { CAR, defaultGearKmh, setLearnedGears } from '../car.js';

const TRIP_CAP = 300;
const ALERT_CAP = 60;
const BANDS = ['<1500', '1500–2500', '2500–3500', '>3500'];
export const BAND_LABELS = BANDS;
const bandOf = (rpm) => (rpm < 1500 ? 0 : rpm < 2500 ? 1 : rpm < 3500 ? 2 : 3);
const GEAR_MIN_SAMPLES = 25;

const median = (arr) => {
  if (!arr || !arr.length) return null;
  const a = [...arr].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
const quantile = (arr, q) => {
  if (!arr || !arr.length) return null;
  const a = [...arr].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor(q * a.length))];
};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ema = (old, x, n, min = 0.12) => (old == null ? x : old + Math.max(min, 1 / (n + 1)) * (x - old));

function freshModel() {
  return {
    v: 1,
    gears: { tyre: null, centers: null, counts: [0, 0, 0, 0, 0] },
    fuel: { factors: [1, 1, 1, 1], global: 1, rows: [], fills: [], sinceFull: null, lastCheck: null },
    tank: { capacity: 35, level: null },
    style: { n: 0, shiftLight: null, shiftHeavy: null, p90Thr: null, harshPer100: null, idlePct: null, kmplBase: null, kmplN: 0 },
    health: { base: {}, alerts: [] },
  };
}

function readJSON(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key, v) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage full / blocked */ }
}

/** Solve a small linear system A·x = b (Gaussian elimination). */
function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    if (Math.abs(M[c][c]) < 1e-12) return null;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/* ------------------------------------------------------------- health rules */
// Each metric: how to describe it, when a deviation from YOUR baseline matters.
export const HEALTH = {
  vRest: { label: 'Battery at rest', unit: 'V', dec: 2, lowBy: 0.3, absLow: 12.2,
    low: 'Battery voltage before starting is lower than usual – the battery may be weakening or something is draining it overnight.' },
  vRun: { label: 'Charging voltage', unit: 'V', dec: 2, lowBy: 0.4, highBy: 0.5, absLow: 13.2, absHigh: 15.0,
    low: 'Charging voltage is low – check the alternator belt and alternator.',
    high: 'Charging voltage is high – the voltage regulator may be failing.' },
  coolRun: { label: 'Running temperature', unit: '°C', dec: 0, highBy: 6, absHigh: 104,
    high: 'The engine is running hotter than its normal – check coolant level, radiator fan and radiator.' },
  warmupS: { label: 'Warm-up time (to 75 °C)', unit: 's', dec: 0, highRatio: 1.6,
    high: 'The engine is taking much longer than usual to warm up – the thermostat may be stuck open.' },
  ltft: { label: 'Long-term fuel trim', unit: '%', dec: 1, highBy: 5, lowBy: 5, absHigh: 10, absLow: -10,
    high: 'Fuel trims are drifting rich-correcting (adding fuel) – possible vacuum/intake leak, weak fuel pump or dirty sensor.',
    low: 'Fuel trims are drifting lean-correcting (removing fuel) – possible leaking injector or sensor fault.' },
  idleRpm: { label: 'Warm idle speed', unit: 'rpm', dec: 0, highBy: 150, lowBy: 150,
    high: 'Idle speed is higher than usual – possible vacuum leak or dirty throttle body.',
    low: 'Idle speed is lower than usual – possible dirty throttle body or idle control issue.' },
};

export function createLearner(prefix) {
  const KEY_MODEL = `${prefix}-learn`;
  const KEY_TRIPS = `${prefix}-trips`;
  let model = { ...freshModel(), ...readJSON(KEY_MODEL, {}) };
  let tripsCache = null;
  let trip = null;
  let pendingVRest = null;
  let offSince = null;
  let lastSample = 0;
  let lastSave = 0;
  const newAlerts = [];
  const listeners = new Set();
  const notify = () => listeners.forEach((l) => l());

  const save = () => { writeJSON(KEY_MODEL, model); lastSave = Date.now(); };
  const trips = () => (tripsCache ??= readJSON(KEY_TRIPS, []));

  /* ------------------------------------------------------------ gears */
  function applyGears() {
    const { centers, counts } = model.gears;
    setLearnedGears(centers ? centers.map((c, i) => (counts[i] >= GEAR_MIN_SAMPLES ? c : null)) : null);
  }
  function onTyre(tyre) {
    if (model.gears.tyre && model.gears.tyre !== tyre) {
      model.gears = { tyre, centers: null, counts: [0, 0, 0, 0, 0] };
      save();
    }
    model.gears.tyre = tyre;
    applyGears();
  }
  function learnGear(ratio) {
    const g = model.gears;
    if (!g.centers) g.centers = defaultGearKmh(g.tyre || CAR.tyre);
    let best = -1;
    let err = Infinity;
    g.centers.forEach((c, i) => {
      const e = Math.abs(ratio - c) / c;
      if (e < err) { err = e; best = i; }
    });
    if (err > 0.12) return;
    const n = g.counts[best];
    g.centers[best] += Math.max(0.02, 1 / (n + 1)) * (ratio - g.centers[best]);
    g.counts[best] = n + 1;
    if (g.counts[best] === GEAR_MIN_SAMPLES) applyGears();
    else if (g.counts[best] > GEAR_MIN_SAMPLES && g.counts[best] % 20 === 0) applyGears();
  }

  /* ------------------------------------------------------------- fuel */
  const fuelFactor = (rpm) => model.fuel.factors[bandOf(rpm)] ?? 1;

  function solveFuel() {
    const rows = model.fuel.rows.slice(-12);
    if (!rows.length) return;
    const sumX = rows.reduce((s, r) => s + r.x.reduce((a, b) => a + b, 0), 0);
    const sumY = rows.reduce((s, r) => s + r.y, 0);
    const g = clamp(sumY / sumX, 0.6, 1.7);
    const meanSq = rows.reduce((s, r) => s + r.x.reduce((a, b) => a + b, 0) ** 2, 0) / rows.length;
    const lam = 0.25 * meanSq / Math.max(1, rows.length);
    const A = [0, 1, 2, 3].map((i) => [0, 1, 2, 3].map((j) => rows.reduce((s, r) => s + r.x[i] * r.x[j], 0) + (i === j ? lam : 0)));
    const b = [0, 1, 2, 3].map((i) => rows.reduce((s, r) => s + r.x[i] * r.y, 0) + lam * g);
    const f = solve(A, b);
    model.fuel.global = g;
    model.fuel.factors = f ? f.map((x) => clamp(x, 0.6, 1.7)) : [g, g, g, g];
  }

  function logFill({ litres, full = true, price = null }) {
    const L = Number(litres);
    if (!(L > 0)) return null;
    const f = model.fuel;
    const sf = f.sinceFull;
    const est = sf ? sf.raw.reduce((s, x, i) => s + x * (sf.factorsAtStart?.[i] ?? 1), 0) : null;
    const entry = { t: Date.now(), litres: L, full, price: price ? Number(price) : null, kmSince: sf?.km ?? null, estL: est };
    f.fills.push(entry);
    f.fills = f.fills.slice(-40);
    let check = null;
    if (full) {
      const rawTotal = sf ? sf.raw.reduce((a, b) => a + b, 0) : 0;
      if (sf && rawTotal > 1 && L > 2) {
        f.rows.push({ x: sf.raw.slice(), y: L + (sf.partialL || 0), t: Date.now() });
        check = { appL: est + 0, pumpL: L + (sf.partialL || 0), km: sf.km };
        check.errPct = ((check.appL - check.pumpL) / check.pumpL) * 100;
        f.lastCheck = check;
        solveFuel();
      }
      f.sinceFull = { raw: [0, 0, 0, 0], km: 0, t: Date.now(), partialL: 0, factorsAtStart: f.factors.slice() };
      model.tank.level = model.tank.capacity;
    } else {
      if (sf) sf.partialL = (sf.partialL || 0) + L;
      if (model.tank.level != null) model.tank.level = Math.min(model.tank.capacity, model.tank.level + L);
    }
    save();
    notify();
    return check;
  }

  /* ------------------------------------------------------------- style */
  function shiftThreshold(throttle, settingsShift) {
    const s = model.style;
    // Light-throttle target: start at an efficient 2500 and drift toward your
    // own habit (but never coach below 2100 or above 2900).
    const eco = s.shiftLight != null ? clamp(0.5 * s.shiftLight + 0.5 * 2400, 2100, 2900) : 2500;
    const t = clamp(((throttle ?? 0) - 30) / 30, 0, 1); // 30 % → eco, 60 %+ → performance
    return eco + (settingsShift - eco) * t;
  }
  function styleLabel() {
    const s = model.style;
    if (!s.n) return null;
    const x = 0.4 * clamp((s.p90Thr ?? 40) / 100, 0, 1)
      + 0.3 * clamp((s.harshPer100 ?? 0) / 10, 0, 1)
      + 0.3 * clamp(((s.shiftLight ?? 2500) - 2000) / 2000, 0, 1);
    return x < 0.33 ? 'Eco' : x < 0.55 ? 'Balanced' : 'Sporty';
  }

  /* ------------------------------------------------------------- scoring */
  function scoreOf(t) {
    const km = t.km ?? t.dist;
    const kmpl = t.kmpl ?? (t.fuel > 0.01 ? t.dist / t.fuel : null);
    const base = model.style.kmplBase ?? 17;
    const eco = kmpl == null ? 70 : clamp(50 + (kmpl / base - 1) * 250, 0, 100);
    const harsh = (t.harshAcc ?? 0) + (t.harshBrk ?? 0);
    const smooth = clamp(100 - (km > 0.5 ? (harsh / km) * 10 * 15 : harsh * 10), 0, 100);
    const dur = t.durS ?? t.dur ?? 1;
    const idlePct = (100 * (t.idleS ?? t.idle ?? 0)) / Math.max(1, dur);
    const idle = clamp(100 - Math.max(0, idlePct - 10) * 2.5, 0, 100);
    return { eco: Math.round(eco), smooth: Math.round(smooth), idle: Math.round(idle), total: Math.round(0.5 * eco + 0.3 * smooth + 0.2 * idle) };
  }

  /* ------------------------------------------------------------- alerts */
  function pushAlert(a) {
    const today = new Date().toDateString();
    const dup = model.health.alerts.find((x) => x.key === a.key && new Date(x.t).toDateString() === today);
    if (dup) return;
    const alert = { t: Date.now(), ...a };
    model.health.alerts.push(alert);
    model.health.alerts = model.health.alerts.slice(-ALERT_CAP);
    newAlerts.push(alert);
    save();
    notify();
  }

  function evaluateHealth(metrics) {
    const base = model.health.base;
    const found = [];
    for (const [k, rule] of Object.entries(HEALTH)) {
      const x = metrics[k];
      if (x == null) continue;
      const b = base[k];
      const fmt = (v) => `${v.toFixed(rule.dec)} ${rule.unit}`;
      let dir = null;
      if (rule.absLow != null && x < rule.absLow) dir = 'low';
      if (rule.absHigh != null && x > rule.absHigh) dir = 'high';
      if (b && b.n >= 5) {
        const tol = Math.max(b.dev * 3, 0);
        if (rule.lowBy != null && x < b.mean - Math.max(rule.lowBy, tol)) dir = 'low';
        if (rule.highBy != null && x > b.mean + Math.max(rule.highBy, tol)) dir = 'high';
        if (rule.highRatio != null && x > b.mean * rule.highRatio) dir = 'high';
      }
      if (dir && rule[dir]) {
        found.push({
          key: `${k}-${dir}`, level: k === 'coolRun' || k === 'vRun' ? 'crit' : 'warn', metric: k,
          title: `${rule.label}: ${fmt(x)}${b && b.n >= 5 ? ` (your normal ${fmt(b.mean)})` : ''}`,
          detail: rule[dir],
        });
      } else {
        // only learn from readings that look normal
        const o = base[k] || { mean: x, dev: 0, n: 0 };
        const a = Math.max(0.1, 1 / (o.n + 1));
        o.dev = o.n ? (1 - a) * o.dev + a * Math.abs(x - o.mean) : 0;
        o.mean = o.n ? (1 - a) * o.mean + a * x : x;
        o.n += 1;
        o.last = x;
        base[k] = o;
      }
    }
    return found;
  }

  /* ------------------------------------------------------------- trips */
  function startTrip(now) {
    trip = {
      id: now, start: Date.now(), dist: 0, fuel: 0, dur: 0, moving: 0, idle: 0, idleFuel: 0,
      maxSpeed: 0, maxRpm: 0, harshAcc: 0, harshBrk: 0, highRpm: 0, thr: [],
      shifts: [], coolStart: null, coolMax: null, warmupS: null, vRest: pendingVRest,
      s: { vRun: [], coolRun: [], ltft: [], stftIdle: [], idleRpm: [] },
      speedBuf: [], rpmBuf: [], lastGear: 'N', lastHarsh: 0, mil: false, lowV: 0,
    };
    pendingVRest = null;
  }

  function endTrip() {
    const t = trip;
    trip = null;
    if (!t) return null;
    if (t.dist < 0.3 && t.dur < 120) return null;
    const metrics = {
      vRest: t.vRest,
      vRun: median(t.s.vRun),
      coolRun: t.s.coolRun.length > 30 ? median(t.s.coolRun) : null,
      warmupS: t.warmupS,
      ltft: t.s.ltft.length > 30 ? median(t.s.ltft) : null,
      idleRpm: t.s.idleRpm.length > 20 ? median(t.s.idleRpm) : null,
    };
    const light = t.shifts.filter((x) => x.thr < 35).map((x) => x.rpm);
    const heavy = t.shifts.filter((x) => x.thr >= 50).map((x) => x.rpm);
    const kmpl = t.fuel > 0.02 ? t.dist / t.fuel : null;
    const summary = {
      id: t.id, start: t.start, end: Date.now(),
      km: +t.dist.toFixed(2), durS: Math.round(t.dur), movingS: Math.round(t.moving), idleS: Math.round(t.idle),
      fuelL: +t.fuel.toFixed(3), idleFuelL: +t.idleFuel.toFixed(3), kmpl: kmpl == null ? null : +kmpl.toFixed(2),
      avgSpeed: t.moving > 0 ? +((t.dist / t.moving) * 3600).toFixed(1) : 0,
      maxSpeed: Math.round(t.maxSpeed), maxRpm: Math.round(t.maxRpm),
      harshAcc: t.harshAcc, harshBrk: t.harshBrk,
      highRpmPct: +((100 * t.highRpm) / Math.max(1, t.dur)).toFixed(1),
      p90Thr: quantile(t.thr, 0.9),
      shiftLight: median(light), shiftHeavy: median(heavy), shifts: t.shifts.length,
      coldStart: t.coolStart != null && t.coolStart < 40,
      short: t.dist < 4,
      metrics,
    };
    summary.score = scoreOf(summary);
    summary.alerts = evaluateHealth(metrics).map((a) => { pushAlert(a); return a.key; });

    // style profile (learn from real drives > 1 km)
    if (t.dist > 1) {
      const s = model.style;
      s.n += 1;
      if (summary.shiftLight != null) s.shiftLight = ema(s.shiftLight, summary.shiftLight, s.n);
      if (summary.shiftHeavy != null) s.shiftHeavy = ema(s.shiftHeavy, summary.shiftHeavy, s.n);
      if (summary.p90Thr != null) s.p90Thr = ema(s.p90Thr, summary.p90Thr, s.n);
      s.harshPer100 = ema(s.harshPer100, ((t.harshAcc + t.harshBrk) / t.dist) * 100, s.n);
      s.idlePct = ema(s.idlePct, (100 * t.idle) / Math.max(1, t.dur), s.n);
      if (kmpl != null && t.dist > 3 && kmpl < 60) { s.kmplN += 1; s.kmplBase = ema(s.kmplBase, kmpl, s.kmplN, 0.08); }
    }
    const list = trips();
    list.unshift(summary);
    if (list.length > TRIP_CAP) list.length = TRIP_CAP;
    writeJSON(KEY_TRIPS, list);
    save();
    notify();
    return summary;
  }

  /**
   * Feed one data update. ctx: { dt, gear, fuelLph (calibrated L/h), rawFuelLph, fuelSrc, settings }
   */
  function ingest(v, ctx) {
    const now = performance.now();
    const rpm = v.rpm ?? 0;
    const speed = v.speed ?? 0;
    const { dt } = ctx;

    // ignition on, engine off → resting battery voltage
    if (rpm < 100 && v.voltage != null && !trip) pendingVRest = v.voltage;

    if (!trip) {
      if (rpm > 400) startTrip(now);
      else return;
    }
    if (rpm < 100) {
      offSince ??= now;
      if (now - offSince > 20000) { endTrip(); offSince = null; }
      return;
    }
    offSince = null;
    const t = trip;
    const fuelL = ((ctx.fuelLph ?? 0) * dt) / 3600;
    t.dur += dt;
    t.dist += (speed * dt) / 3600;
    t.fuel += fuelL;
    if (speed > 2) {
      t.moving += dt;
      if (v.throttle != null) t.thr.length < 4000 && t.thr.push(v.throttle);
    } else {
      t.idle += dt;
      t.idleFuel += fuelL;
    }
    t.maxSpeed = Math.max(t.maxSpeed, speed);
    t.maxRpm = Math.max(t.maxRpm, rpm);
    if (rpm > 4000) t.highRpm += dt;

    // fuel model bookkeeping since the last full tank
    const sf = model.fuel.sinceFull;
    if (sf && ctx.fuelSrc !== 'ecu') {
      sf.raw[bandOf(rpm)] += ((ctx.rawFuelLph ?? 0) * dt) / 3600;
      sf.km += (speed * dt) / 3600;
    }
    if (model.tank.level != null) model.tank.level = Math.max(0, model.tank.level - fuelL);

    // harsh acceleration / braking (speed change over ~1 s)
    t.speedBuf.push([now, speed]);
    while (t.speedBuf.length && now - t.speedBuf[0][0] > 1500) t.speedBuf.shift();
    const [t0, v0] = t.speedBuf[0];
    const span = (now - t0) / 1000;
    const accel = span > 0.7 ? (speed - v0) / 3.6 / span : 0;
    if (now - t.lastHarsh > 3000) {
      if (accel > 2.8) { t.harshAcc++; t.lastHarsh = now; }
      if (accel < -3.5) { t.harshBrk++; t.lastHarsh = now; }
    }

    // upshift detection: rpm/throttle just before the gear change
    t.rpmBuf.push([now, rpm, v.throttle ?? 0]);
    while (t.rpmBuf.length && now - t.rpmBuf[0][0] > 2500) t.rpmBuf.shift();
    const g = ctx.gear;
    if (g !== 'N' && g !== t.lastGear) {
      if (/^\d$/.test(t.lastGear) && +g === +t.lastGear + 1) {
        const before = t.rpmBuf.filter((x) => now - x[0] > 300);
        if (before.length) {
          t.shifts.push({
            rpm: Math.max(...before.map((x) => x[1])),
            thr: before.reduce((s, x) => s + x[2], 0) / before.length,
          });
        }
      }
      t.lastGear = g;
    }

    // coolant warm-up
    if (v.coolant != null) {
      t.coolStart ??= v.coolant;
      t.coolMax = Math.max(t.coolMax ?? v.coolant, v.coolant);
      if (t.warmupS == null && t.coolStart < 40 && v.coolant >= 75) t.warmupS = Math.round(t.dur);
    }

    // live safety alerts
    if (!t.mil && v.status01 != null && (v.status01 & 0x80)) {
      t.mil = true;
      pushAlert({ key: 'mil', level: 'crit', title: 'Check-engine light is ON', detail: 'The ECU has stored a fault. Get the trouble codes read soon.' });
    }
    if (v.voltage != null && rpm > 1000 && v.voltage < 12.4) {
      t.lowV += dt;
      if (t.lowV > 30) pushAlert({ key: 'charging-live', level: 'crit', title: `Battery not charging (${v.voltage.toFixed(1)} V)`, detail: 'Voltage stayed below 12.4 V with the engine running – check the alternator and its belt.' });
    } else t.lowV = 0;

    // 1 Hz samples for health baselines + gear learning
    if (now - lastSample >= 1000) {
      lastSample = now;
      const warm = (v.coolant ?? 0) > 75;
      if (warm && rpm > 1500 && v.voltage != null) t.s.vRun.push(v.voltage);
      if (warm && speed > 30 && t.dur > 600 && v.coolant != null) t.s.coolRun.push(v.coolant);
      if (warm && v.ltft != null) t.s.ltft.push(v.ltft);
      if (warm && speed < 1 && (v.throttle ?? 0) < 3 && rpm > 400) {
        t.s.idleRpm.push(rpm);
        if (v.stft != null) t.s.stftIdle.push(v.stft);
      }
      for (const k of Object.keys(t.s)) if (t.s[k].length > 3600) t.s[k].shift();
      if (speed > 15 && rpm > 1000 && (v.throttle ?? 0) > 3 && Math.abs(accel) < 0.3) learnGear((speed / rpm) * 1000);
    }
    if (Date.now() - lastSave > 30000) save();
  }

  return {
    ingest,
    endTrip,
    logFill,
    onTyre,
    activate: applyGears,
    fuelFactor,
    shiftThreshold,
    styleLabel,
    scoreOf,
    trips,
    get model() { return model; },
    get liveTrip() { return trip; },
    takeNewAlerts: () => newAlerts.splice(0),
    subscribe: (l) => (listeners.add(l), () => listeners.delete(l)),
    setCapacity(c) { model.tank.capacity = Number(c) || 35; save(); notify(); },
    setTankLevel(l) { model.tank.level = l == null ? null : clamp(Number(l), 0, model.tank.capacity); save(); notify(); },
    dismissAlert(t) { model.health.alerts = model.health.alerts.filter((a) => a.t !== t); save(); notify(); },
    deleteTrip(id) { const l = trips(); const i = l.findIndex((x) => x.id === id); if (i >= 0) { l.splice(i, 1); writeJSON(KEY_TRIPS, l); notify(); } },
    reset() {
      model = freshModel();
      tripsCache = [];
      trip = null;
      writeJSON(KEY_TRIPS, []);
      save();
      applyGears();
      notify();
    },
    tankInfo() {
      const lvl = model.tank.level;
      const kmpl = model.style.kmplBase;
      return {
        level: lvl, capacity: model.tank.capacity,
        pct: lvl == null ? null : (100 * lvl) / model.tank.capacity,
        rangeKm: lvl == null || !kmpl ? null : lvl * kmpl,
      };
    },
    /** Compact, privacy-light summary for the AI assistant. */
    aiContext() {
      const list = trips().slice(0, 25).map((x) => ({
        date: new Date(x.start).toISOString().slice(0, 16), km: x.km, min: Math.round(x.durS / 60),
        kmpl: x.kmpl, avgKmh: x.avgSpeed, maxKmh: x.maxSpeed, idlePct: Math.round((100 * x.idleS) / Math.max(1, x.durS)),
        harsh: x.harshAcc + x.harshBrk, cold: x.coldStart, short: x.short, score: x.score?.total, shiftRpm: x.shiftLight,
        alerts: x.alerts,
      }));
      const H = {};
      for (const [k, b] of Object.entries(model.health.base)) H[k] = { normal: +b.mean.toFixed(2), last: b.last, n: b.n };
      return {
        car: '2016 Maruti Suzuki WagonR VXi, K10B 998cc petrol, 5-speed manual, tyres 185/45R15 (stock 155/65R14)',
        fuelSource: 'estimated from MAP sensor (ECU does not report fuel rate), calibrated with fill-ups',
        fuelCalibration: { fills: model.fuel.rows.length, factorsByRpmBand: model.fuel.factors.map((x) => +x.toFixed(3)), lastCheck: model.fuel.lastCheck },
        tank: this.tankInfo(),
        style: { label: styleLabel(), ...model.style },
        gearsLearned: model.gears.counts.map((c) => c >= GEAR_MIN_SAMPLES),
        health: H,
        recentAlerts: model.health.alerts.slice(-10).map((a) => ({ date: new Date(a.t).toISOString().slice(0, 10), title: a.title })),
        trips: list,
      };
    },
  };
}
