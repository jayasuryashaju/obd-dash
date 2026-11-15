// Instrument-cluster kit: geometry, spring-driven needles, start-up sweep,
// tick/numeral generators and telltale (warning lamp) icons.
//
// Angles: 0° = 12 o'clock, positive = clockwise. All clusters draw into a
// fixed 2000×900 viewBox so the whole composition scales like a real cluster.
import { useEffect, useRef } from 'react';

export const VB_W = 2000;
export const VB_H = 900;

/* ------------------------------------------------------------------ geometry */
const rad = (d) => (d * Math.PI) / 180;
export const polar = (cx, cy, r, deg) => [cx + r * Math.sin(rad(deg)), cy - r * Math.cos(rad(deg))];
const n = (v) => Math.round(v * 100) / 100;

/** Arc path from a1 to a2 (degrees). Works both directions. */
export function arc(cx, cy, r, a1, a2) {
  const [x1, y1] = polar(cx, cy, r, a1);
  const [x2, y2] = polar(cx, cy, r, a2);
  const large = Math.abs(a2 - a1) > 180 ? 1 : 0;
  const sweep = a2 >= a1 ? 1 : 0;
  return `M${n(x1)} ${n(y1)}A${r} ${r} 0 ${large} ${sweep} ${n(x2)} ${n(y2)}`;
}

/** Filled annular sector between radii r1<r2. */
export function band(cx, cy, r1, r2, a1, a2) {
  const [ax, ay] = polar(cx, cy, r2, a1);
  const [bx, by] = polar(cx, cy, r2, a2);
  const [cx2, cy2] = polar(cx, cy, r1, a2);
  const [dx, dy] = polar(cx, cy, r1, a1);
  const large = Math.abs(a2 - a1) > 180 ? 1 : 0;
  return `M${n(ax)} ${n(ay)}A${r2} ${r2} 0 ${large} 1 ${n(bx)} ${n(by)}L${n(cx2)} ${n(cy2)}A${r1} ${r1} 0 ${large} 0 ${n(dx)} ${n(dy)}Z`;
}

/** Linear value→angle scale. */
export const scale = (min, max, a0, a1) => (v) => a0 + ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * (a1 - a0);

/**
 * One <path d> containing every tick for values min..max stepping `step`,
 * skipping values that are multiples of any step in `skip`.
 * Optional `filter(v)` limits which values are drawn.
 */
export function tickPath({ cx, cy, min, max, step, rOuter, len, ang, skip = [], filter }) {
  let d = '';
  const count = Math.round((max - min) / step);
  for (let i = 0; i <= count; i++) {
    const v = min + i * step;
    if (skip.some((s) => Math.abs(v / s - Math.round(v / s)) < 1e-6)) continue;
    if (filter && !filter(v)) continue;
    const a = ang(v);
    const [x1, y1] = polar(cx, cy, rOuter, a);
    const [x2, y2] = polar(cx, cy, rOuter - len, a);
    d += `M${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}`;
  }
  return d;
}

/** Numerals placed around a dial; returns array of <text>. */
export function numerals({ cx, cy, min, max, step, r, ang, fmt = (v) => v, className, redFrom, redClass, dy = '0.36em' }) {
  const out = [];
  const count = Math.round((max - min) / step);
  for (let i = 0; i <= count; i++) {
    const v = min + i * step;
    const [x, y] = polar(cx, cy, r, ang(v));
    out.push(
      <text key={v} x={n(x)} y={n(y)} dy={dy} textAnchor="middle"
        className={redFrom != null && v >= redFrom ? redClass : className}>{fmt(v)}</text>,
    );
  }
  return out;
}

/* ---------------------------------------------------- spring animator + sweep */
// One rAF loop drives every needle. Each item works in "fraction" space 0..1
// with a damped spring, which gives the weighted motion of a stepper-motor
// needle instead of CSS-transition jerkiness.
const items = new Set();
let raf = 0;
let last = 0;
let sweepAt = -1e9;
const SWEEP_UP = 750;
const SWEEP_HOLD = 250;
const SWEEP_DOWN = 800;

/** Needle sweep (full scale and back) like an OEM cluster self-test. */
export function sweep() { sweepAt = performance.now(); }

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const st = now - sweepAt;
  for (const it of items) {
    let tgt = it.target();
    if (tgt == null || Number.isNaN(tgt)) tgt = 0;
    tgt = Math.min(1, Math.max(0, tgt));
    let k = it.k;
    if (it.sweep && st < SWEEP_UP + SWEEP_HOLD + SWEEP_DOWN) {
      tgt = st < SWEEP_UP + SWEEP_HOLD ? 1 : 0;
      k = 55;
    }
    const c = 2 * it.z * Math.sqrt(k);
    for (let s = 0; s < 3; s++) {
      const h = dt / 3;
      it.v += (k * (tgt - it.x) - c * it.v) * h;
      it.x += it.v * h;
    }
    // mechanical stop pins
    if (it.x < -0.004) { it.x = -0.004; it.v = Math.max(0, it.v); }
    if (it.x > 1.012) { it.x = 1.012; it.v = Math.min(0, it.v); }
    if (Math.abs(it.x - it.shown) > 0.00005) {
      it.shown = it.x;
      it.apply(it.x);
    }
  }
  raf = items.size ? requestAnimationFrame(loop) : 0;
}

function register(it) {
  items.add(it);
  if (!raf) {
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }
  return () => items.delete(it);
}

/**
 * Animate a 0..1 fraction with a spring and hand each frame to `apply(f)`.
 * stiffness ~ 40 (lazy) … 160 (snappy). damping 0.7–0.9.
 */
export function useSpring(frac, apply, { stiffness = 90, damping = 0.82, sweep: doSweep = true } = {}) {
  const target = useRef(frac);
  target.current = frac;
  const applyRef = useRef(apply);
  applyRef.current = apply;
  useEffect(() => register({
    target: () => target.current,
    apply: (f) => applyRef.current(f),
    x: 0, v: 0, shown: -1, k: stiffness, z: damping, sweep: doSweep,
  }), [stiffness, damping, doSweep]);
}

/**
 * Segment bar driven by a spring: returns a ref array for `n` elements and
 * toggles their class each frame without re-rendering React.
 * cls(i, on) → class string.
 */
export function useSegments(frac, n, cls, opts) {
  const refs = useRef([]);
  const lit = useRef(-1);
  const clsRef = useRef(cls);
  clsRef.current = cls;
  useSpring(frac, (f) => {
    const k = Math.round(Math.max(0, Math.min(1, f)) * n);
    if (k === lit.current) return;
    lit.current = k;
    refs.current.forEach((el, i) => el && el.setAttribute('class', clsRef.current(i, i < k)));
  }, opts);
  return refs;
}

/** Rotating needle group. Children are drawn pointing straight up at (cx,cy). */
export function Needle({ frac, cx, cy, a0, a1, stiffness, damping, children, sweep: s = true }) {
  const ref = useRef(null);
  useSpring(frac, (f) => {
    ref.current?.setAttribute('transform', `rotate(${(a0 + (a1 - a0) * f).toFixed(3)} ${cx} ${cy})`);
  }, { stiffness, damping, sweep: s });
  return <g ref={ref} transform={`rotate(${a0} ${cx} ${cy})`}>{children}</g>;
}

/** Tapered needle polygon pointing up from (cx,cy). */
export const taper = (cx, cy, { tip, tail = 0, wBase, wTip, wTail = wBase }) =>
  `${cx - wTail / 2},${cy + tail} ${cx - wBase / 2},${cy} ${cx - wTip / 2},${cy - tip} ${cx + wTip / 2},${cy - tip} ${cx + wBase / 2},${cy} ${cx + wTail / 2},${cy + tail}`;

/* ------------------------------------------------------------ layering */
// Static artwork is rasterised once on its own compositor layer; only the thin
// "live" layer (needles + readouts) repaints while driving. Ids in <defs> are
// document-global, so every layer can reference the gradients in `back`.
const vb = `0 0 ${VB_W} ${VB_H}`;
export function ClusterFrame({ className, back, live, front }) {
  return (
    <div className={`cluster ${className}`}>
      <svg className="layer static" viewBox={vb} preserveAspectRatio="xMidYMid meet">{back}</svg>
      <svg className="layer" viewBox={vb} preserveAspectRatio="xMidYMid meet">{live}</svg>
      {front && <svg className="layer static" viewBox={vb} preserveAspectRatio="xMidYMid meet">{front}</svg>}
    </div>
  );
}

/* -------------------------------------------------------------- telltales */
// 48×48 icon artwork, drawn in currentColor.
const ICONS = {
  engine: (
    <path fill="currentColor" d="M13 14h14v4h-5v3h7l4 4h3v-3h4v16h-4v-3h-3l-5 6H17l-4-4H9v4H5V24h4v-3h4v-3h5v-3h-5z" />
  ),
  battery: (
    <g fill="none" stroke="currentColor" strokeWidth="3.5">
      <rect x="5" y="14" width="38" height="25" rx="2" />
      <path d="M11 14v-4h7v4M30 14v-4h7v4M10 27h9M29 27h9M33.5 22.5v9" />
    </g>
  ),
  temp: (
    <g fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
      <path d="M24 6v22M24 10h7M24 16h7M24 22h7" />
      <circle cx="24" cy="31" r="4.5" fill="currentColor" />
      <path d="M5 42c3-3 6-3 9 0s6 3 9 0 6-3 9 0 6 3 9 0" />
    </g>
  ),
  shift: <path fill="currentColor" d="M24 5 41 23H31v20H17V23H7z" />,
  eco: (
    <g fill="currentColor">
      <path d="M38 8C20 8 9 15 9 28c0 4 1 7 3 9 3-8 9-14 18-18-8 5-13 11-15 20 2 1 5 2 8 2 13 0 16-14 15-33z" />
    </g>
  ),
  link: (
    <path fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinejoin="round"
      d="M14 15l20 18-10 9V6l10 9-20 18" />
  ),
};

export const Icon = ({ kind }) => ICONS[kind];

export function Telltale({ kind, x, y, size = 48, on, color }) {
  const s = size / 48;
  return (
    <g transform={`translate(${x - size / 2} ${y - size / 2}) scale(${s})`}
      className={`tt ${on ? 'on' : ''}`} style={{ color: on ? color : undefined }}>
      {ICONS[kind]}
    </g>
  );
}

export const LAMP = { red: '#ff3826', amber: '#ffb000', green: '#2ee66b', blue: '#3d8bff' };

/** Which warning lamps are lit, from live data. */
export function lampState(d) {
  const v = d.values;
  const live = d.status === 'live';
  return {
    link: live,
    engine: live && v.status01 != null && (v.status01 & 0x80) !== 0,
    battery: live && v.voltage != null && ((v.rpm > 500 && v.voltage < 12.6) || v.voltage > 15.3),
    hot: live && v.coolant != null && v.coolant > 108,
    cold: live && v.coolant != null && v.coolant < 50,
    shift: live && d.shiftHint,
    eco: live && d.kmpl != null && d.kmpl > 22 && (v.speed ?? 0) > 10,
  };
}

export const f0 = (v) => (v == null || Number.isNaN(v) ? '--' : Math.round(v).toString());
export const f1 = (v) => (v == null || Number.isNaN(v) ? '--.-' : v.toFixed(1));
export const clock = () => {
  const t = new Date();
  return `${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}`;
};
export const tripTime = (s) => {
  const m = Math.floor(s / 60);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
};
export const avgKmpl = (trip) => (trip.fuelL > 0.02 ? trip.distanceKm / trip.fuelL : null);
