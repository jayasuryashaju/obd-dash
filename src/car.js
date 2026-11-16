// Vehicle profile: 2016 Maruti Suzuki WagonR VXi (K10B 998cc, 5MT).
// Gear ratios are approximate – gear detection uses a tolerance and can be
// fine-tuned later from a real drive log.

export const CAR = {
  name: 'WagonR VXi',
  displacementL: 0.998,
  redline: 6000,
  maxRpm: 7000,
  maxSpeed: 160,
  idleRpm: 800,
  finalDrive: 4.235,
  gears: [3.545, 1.904, 1.24, 0.906, 0.697],
  stockTyre: '155/65R14', // what the ECU's speed signal is calibrated for
  tyre: '185/45R15', // what's fitted now
  fuelDensity: 740, // g/L petrol
  afr: 14.7,
};

/** "185/45R15" → { width, aspect, rim } (spaces, slashes and "R" optional). */
export function parseTyre(s) {
  const m = /(\d{3})\s*\/?\s*(\d{2})\s*Z?R?\s*(\d{2})/i.exec(String(s || ''));
  return m ? { width: +m[1], aspect: +m[2], rim: +m[3] } : null;
}

/** Overall diameter in mm. */
export function tyreDiameter(s) {
  const t = parseTyre(s);
  return t ? t.rim * 25.4 + 2 * t.width * (t.aspect / 100) : null;
}

/**
 * The ECU computes speed assuming the stock rolling circumference. With a
 * smaller tyre the wheel turns more per km, so OBD speed reads high.
 * true speed = OBD speed × (fitted diameter / stock diameter).
 */
export function tyreFactor(stock = CAR.stockTyre, fitted = CAR.tyre) {
  const a = tyreDiameter(stock);
  const b = tyreDiameter(fitted);
  return a && b ? b / a : 1;
}

/** km/h at 1000 rpm for each gear (mutated by setTyre / setLearnedGears). */
export const KMH_PER_1000 = [];
let defaults = [];
let learned = null; // per-gear learned values (null entries = not learned yet)
let gearTol = 0.14;

/** Book values from gear ratios + fitted tyre size. */
export function defaultGearKmh(fitted = CAR.tyre) {
  const dia = tyreDiameter(fitted) ?? tyreDiameter(CAR.tyre);
  const circM = (Math.PI * dia) / 1000;
  return CAR.gears.map((g) => (1000 / (g * CAR.finalDrive)) * circM * 0.06);
}

function applyGears() {
  KMH_PER_1000.length = 0;
  defaults.forEach((d, i) => KMH_PER_1000.push(learned?.[i] ?? d));
  // once every gear is learned from real driving, matching can be stricter
  gearTol = learned && learned.every((x) => x != null) ? 0.09 : 0.14;
}

export function setTyre(fitted) {
  defaults = defaultGearKmh(fitted);
  applyGears();
}
setTyre(CAR.tyre);

/** Learned km/h-per-1000rpm per gear (array, null = keep default). */
export function setLearnedGears(arr) {
  learned = arr && arr.some((x) => x != null) ? arr.slice(0, defaults.length) : null;
  applyGears();
}

/** Best-guess gear from (true) speed & rpm. Returns 'N' when nothing fits. */
export function estimateGear(speed, rpm) {
  if (speed < 3 || rpm < 500) return 'N';
  const ratio = (speed / rpm) * 1000;
  let best = -1;
  let bestErr = Infinity;
  KMH_PER_1000.forEach((k, i) => {
    const err = Math.abs(ratio - k) / k;
    if (err < bestErr) { bestErr = err; best = i; }
  });
  return bestErr < gearTol ? String(best + 1) : 'N';
}

/**
 * Fuel flow in L/h, best source first:
 *   1. PID 5E engine fuel rate reported by the ECU (exact)
 *   2. MAF airflow
 *   3. speed-density estimate from MAP + IAT + RPM (needs VE calibration)
 */
export function fuelSource({ fuelRate, maf, map }) {
  if (fuelRate != null) return 'ecu';
  if (maf != null) return 'maf';
  if (map != null) return 'estimate';
  return null;
}

export function fuelRateLph({ fuelRate, maf, map, iat, rpm, throttle, load, stft, ltft }, ve = 0.82) {
  if (fuelRate != null && !Number.isNaN(fuelRate)) return fuelRate;
  if (!rpm || rpm < 300) return 0;
  let airGs = maf;
  if (airGs == null || Number.isNaN(airGs)) {
    if (map == null) return null;
    const T = (iat ?? 30) + 273.15;
    airGs = (map * CAR.displacementL * rpm * ve * 28.97) / (120 * 8.314 * T);
  }
  // Deceleration fuel cut: closed throttle above ~1300 rpm
  if (throttle != null && throttle < 1.5 && rpm > 1300) return 0;

  // Power enrichment: under heavy load the ECU leaves closed loop and runs
  // rich (~12.8:1). Blend in from 70 % to 90 % load/throttle.
  const demand = Math.max(load ?? 0, (throttle ?? 0) * 1.1);
  const rich = Math.min(1, Math.max(0, (demand - 70) / 20));
  const afr = CAR.afr + (12.8 - CAR.afr) * rich;

  // Closed-loop fuel trims: the ECU's own correction to its air estimate.
  // (Frozen/ignored while enriched – open loop.)
  const trim = rich > 0.5 ? 0 : ((stft ?? 0) + (ltft ?? 0)) / 100;
  const trimF = Math.min(1.3, Math.max(0.7, 1 + trim));

  return ((airGs / afr) / CAR.fuelDensity) * 3600 * trimF;
}
