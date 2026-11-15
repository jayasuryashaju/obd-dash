// "Digital" – virtual-cockpit TFT: glowing progress rings, light-blade
// needles, large digital centre readouts and a centre trip/engine data grid.
import { memo, useRef } from 'react';
import { CAR } from '../car.js';
import {
  VB_W, VB_H, arc, scale, tickPath, numerals, Needle, useSpring, Telltale, LAMP, lampState,
  f0, f1, clock, tripTime, avgKmpl, ClusterFrame,
} from './kit.jsx';
import './digital.css';

const R = 372;
const TACH = { cx: 432, cy: 452 };
const SPD = { cx: 1568, cy: 452 };
const A0 = -135;
const A1 = 135;
const TR = R - 26; // progress track radius
const SEG = { from: 201, to: 159, n: 10 }; // bottom mini segment bar (angles)

const Defs = memo(() => (
  <defs>
    <radialGradient id="dg-bg" cx="50%" cy="50%" r="70%">
      <stop offset="0" stopColor="#0c1728" />
      <stop offset="0.7" stopColor="#050a14" />
      <stop offset="1" stopColor="#010307" />
    </radialGradient>
    <radialGradient id="dg-face" cx="50%" cy="50%" r="50%">
      <stop offset="0" stopColor="#0c1a2d" />
      <stop offset="0.82" stopColor="#060d18" />
      <stop offset="1" stopColor="#0a1628" />
    </radialGradient>
    <linearGradient id="dg-ring" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#4f8dff" stopOpacity="0.7" />
      <stop offset="0.6" stopColor="#4f8dff" stopOpacity="0.05" />
    </linearGradient>
    {[TACH, SPD].map((c, i) => (
      <linearGradient key={i} id={`dg-prog-${i}`} gradientUnits="userSpaceOnUse"
        x1={c.cx - R} y1={c.cy} x2={c.cx + R} y2={c.cy - R}>
        <stop offset="0" stopColor="#0a7cff" />
        <stop offset="0.6" stopColor="#21c8ff" />
        <stop offset="1" stopColor="#bff3ff" />
      </linearGradient>
    ))}
    <linearGradient id="dg-blade" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stopColor="#7fdcff" stopOpacity="0" />
      <stop offset="0.7" stopColor="#bdf0ff" stopOpacity="0.9" />
      <stop offset="1" stopColor="#ffffff" />
    </linearGradient>
    <filter id="dg-soft" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="18" />
    </filter>
  </defs>
));

const Dial = memo(function Dial({ cx, cy, min, max, major, minor, fmt, redFrom, unit }) {
  const ang = scale(min, max, A0, A1);
  const rO = R - 52;
  const base = { cx, cy, min, max, rOuter: rO, ang };
  const segA = (i) => SEG.from + ((SEG.to - SEG.from) * i) / SEG.n;
  return (
    <g>
      <circle cx={cx} cy={cy} r={R + 30} fill="#2f6bff" opacity="0.07" filter="url(#dg-soft)" />
      <circle cx={cx} cy={cy} r={R} fill="url(#dg-face)" />
      <circle cx={cx} cy={cy} r={R + 14} fill="none" stroke="url(#dg-ring)" strokeWidth="3" />
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#14233a" strokeWidth="2" />
      <path d={arc(cx, cy, TR, A0, A1)} className="dg-track" />
      {redFrom != null && <path d={arc(cx, cy, TR, ang(redFrom), A1)} className="dg-track red" />}
      <path d={tickPath({ ...base, step: minor, len: 12, skip: [major] })} className="dg-tick minor" />
      <path d={tickPath({ ...base, step: major, len: 26, filter: (v) => redFrom == null || v < redFrom })} className="dg-tick major" />
      {redFrom != null && <path d={tickPath({ ...base, step: major, len: 26, filter: (v) => v >= redFrom })} className="dg-tick major red" />}
      {numerals({ cx, cy, min, max, step: major, r: rO - 64, ang, fmt, className: 'dg-num', redFrom, redClass: 'dg-num red' })}
      <circle cx={cx} cy={cy} r={R - 168} className="dg-inner" />
      <text x={cx} y={cy + R - 62} textAnchor="middle" className="dg-unit">{unit}</text>
      {Array.from({ length: SEG.n }, (_, i) => (
        <path key={i} d={arc(cx, cy, TR, segA(i + 1) + 0.6, segA(i) - 0.6)} className="dg-seg-off" />
      ))}
    </g>
  );
});

/** Glowing progress arc that follows the needle spring. */
function Progress({ cx, cy, frac, redFrac, idx }) {
  const main = useRef(null);
  const glow = useRef(null);
  const red = useRef(null);
  useSpring(frac, (f) => {
    const a = A0 + (A1 - A0) * Math.max(0.0005, f);
    const ra = A0 + (A1 - A0) * (redFrac ?? 2);
    const endMain = Math.min(a, ra);
    const dMain = arc(cx, cy, TR, A0, endMain);
    main.current?.setAttribute('d', dMain);
    glow.current?.setAttribute('d', dMain);
    if (red.current) red.current.setAttribute('d', a > ra ? arc(cx, cy, TR, ra, a) : '');
  }, { stiffness: 110, damping: 0.8 });
  return (
    <g>
      <path ref={glow} className="dg-prog-glow" stroke={`url(#dg-prog-${idx})`} />
      <path ref={main} className="dg-prog" stroke={`url(#dg-prog-${idx})`} />
      {redFrac != null && <path ref={red} className="dg-prog red" />}
    </g>
  );
}

function Blade({ cx, cy, frac }) {
  return (
    <Needle frac={frac} cx={cx} cy={cy} a0={A0} a1={A1} stiffness={110} damping={0.8}>
      <polygon points={`${cx - 9},${cy - R + 168} ${cx + 9},${cy - R + 168} ${cx + 3},${cy - R + 8} ${cx - 3},${cy - R + 8}`}
        fill="url(#dg-blade)" />
      <rect x={cx - 9} y={cy - R + 6} width="18" height="44" rx="6" fill="#ffffff" opacity="0.28" />
    </Needle>
  );
}

function Segments({ cx, cy, frac, color }) {
  const on = Math.round(Math.min(1, Math.max(0, frac || 0)) * SEG.n);
  const segA = (i) => SEG.from + ((SEG.to - SEG.from) * i) / SEG.n;
  return (
    <g>
      {Array.from({ length: on }, (_, i) => (
        <path key={i} d={arc(cx, cy, TR, segA(i + 1) + 0.6, segA(i) - 0.6)}
          className="dg-seg-on" stroke={typeof color === 'function' ? color(i) : color} />
      ))}
    </g>
  );
}

/* centre column: borderless two-column readouts with hairline dividers */
const COLX = [912, 1088];
const ROWY = [392, 502, 612, 722]; // value baselines
const ROWS = [
  [['AVG', 'km/L'], ['TRIP', 'km']],
  [['FUEL', 'km/L'], ['USED', 'L']],
  [['MAP', 'kPa'], ['IGNITION', '°']],
  [['DRIVE', ''], ['TOP', 'km/h']],
];
const BAR = { x1: 836, x2: 1164, y: 826 };

const Grid = memo(() => (
  <g>
    <defs>
      <linearGradient id="dg-hair" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#1e3658" stopOpacity="0" />
        <stop offset="0.5" stopColor="#1e3658" />
        <stop offset="1" stopColor="#1e3658" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="dg-vhair" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#1e3658" stopOpacity="0" />
        <stop offset="0.5" stopColor="#1e3658" />
        <stop offset="1" stopColor="#1e3658" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="dg-thr" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#0a7cff" />
        <stop offset="1" stopColor="#7fe3ff" />
      </linearGradient>
    </defs>
    {ROWS.map((row, r) => row.map(([label], c) => (
      <text key={label} x={COLX[c]} y={ROWY[r] - 44} textAnchor="middle" className="dg-clbl">{label}</text>
    )))}
    {[1, 2, 3].map((r) => (
      <rect key={r} x="840" y={ROWY[r] - 76} width="320" height="1.5" fill="url(#dg-hair)" />
    ))}
    <rect x="999" y="330" width="1.5" height="410" fill="url(#dg-vhair)" />
    <text x={BAR.x1} y={BAR.y - 16} className="dg-clbl">THROTTLE</text>
    <rect x={BAR.x1} y={BAR.y} width={BAR.x2 - BAR.x1} height="4" rx="2" fill="#0f1d33" />
  </g>
));

const Back = memo(({ redline }) => (
  <>
    <Defs />
    <rect x="-500" y="-200" width={VB_W + 1000} height={VB_H + 400} fill="url(#dg-bg)" />
    <Dial {...TACH} min={0} max={CAR.maxRpm} major={1000} minor={250} fmt={(x) => x / 1000}
      redFrom={redline} unit="°C" />
    <Dial {...SPD} min={0} max={CAR.maxSpeed} major={20} minor={10} fmt={(x) => x} unit="km/L" />
    <text x={TACH.cx} y={TACH.cy - 118} textAnchor="middle" className="dg-lbl">GEAR</text>
    <text x={SPD.cx} y={SPD.cy + 112} textAnchor="middle" className="dg-lbl">km/h</text>
    <Grid />
  </>
));

export default function Digital({ d }) {
  const v = d.values;
  const L = lampState(d);
  const redFrac = d.settings.redline / CAR.maxRpm;
  const hot = (v.coolant ?? 0) > 105;
  return (
    <ClusterFrame
      className="digital"
      back={<Back redline={d.settings.redline} />}
      live={
        <>
          <Progress {...TACH} idx={0} frac={(v.rpm ?? 0) / CAR.maxRpm} redFrac={redFrac} />
          <Progress {...SPD} idx={1} frac={(v.speed ?? 0) / CAR.maxSpeed} />
          <Blade {...TACH} frac={(v.rpm ?? 0) / CAR.maxRpm} />
          <Blade {...SPD} frac={(v.speed ?? 0) / CAR.maxSpeed} />
          <Segments {...TACH} frac={v.coolant == null ? 0 : (v.coolant - 50) / 70}
            color={(i) => (hot ? '#ff3d5e' : i > 7 ? '#ffb340' : '#35c8ff')} />
          <Segments {...SPD} frac={(d.kmpl ?? 0) / 30} color="#38f29a" />

          {/* tach centre: gear + rpm */}
          <text x={TACH.cx} y={TACH.cy + 62} textAnchor="middle" className={`dg-gear ${d.gear === 'N' ? 'n' : ''}`}>{d.gear}</text>
          <text x={TACH.cx} y={TACH.cy + 130} textAnchor="middle" className="dg-sub">{f0(v.rpm)} rpm</text>
          <Telltale kind="shift" x={TACH.cx + 118} y={TACH.cy - 10} size={44} on={L.shift} color={LAMP.green} />
          <text x={TACH.cx} y={TACH.cy + R - 92} textAnchor="middle" className="dg-mini">{f0(v.coolant)}</text>

          {/* speedo centre */}
          <text x={SPD.cx} y={SPD.cy + 58} textAnchor="middle" className="dg-speed">{f0(v.speed)}</text>
          <text x={SPD.cx} y={SPD.cy + R - 92} textAnchor="middle" className="dg-mini">{d.kmpl == null ? '--' : d.kmpl > 50 ? '50+' : f1(d.kmpl)}</text>

          {/* centre column */}
          <text x="1000" y="168" textAnchor="middle" className="dg-clock">{clock()}</text>
          <text x="1000" y="216" textAnchor="middle" className="dg-sub">{f0(v.iat)}°C  ·  {f1(v.voltage)} V</text>

          <GridValues d={d} />
          <Telltale kind="engine" x={864} y={70} on={L.engine} color={LAMP.amber} />
          <Telltale kind="battery" x={932} y={70} on={L.battery} color={LAMP.red} />
          <Telltale kind="temp" x={1000} y={70} on={L.hot || L.cold} color={L.hot ? LAMP.red : LAMP.blue} />
          <Telltale kind="eco" x={1068} y={70} on={L.eco} color={LAMP.green} />
          <Telltale kind="link" x={1136} y={70} on={L.link} color={LAMP.blue} />
        </>
      }
    />
  );
}

function GridValues({ d }) {
  const v = d.values;
  const vals = [
    [f1(avgKmpl(d.trip)), f1(d.trip.distanceKm)],
    [d.kmpl == null ? '--' : d.kmpl > 50 ? '50+' : f1(d.kmpl), d.trip.fuelL.toFixed(2)],
    [f0(v.map), f1(v.timing)],
    [tripTime(d.trip.movingS), f0(d.trip.maxSpeed)],
  ];
  const thr = Math.max(0, Math.min(1, (v.throttle ?? 0) / 100));
  return (
    <g>
      {ROWS.map((row, r) => row.map(([label, unit], c) => (
        <text key={label} x={COLX[c]} y={ROWY[r]} textAnchor="middle" className="dg-cval">
          {vals[r][c]}{unit && <tspan className="dg-cunit"> {unit}</tspan>}
        </text>
      )))}
      <text x={BAR.x2} y={BAR.y - 16} textAnchor="end" className="dg-cbarv">{f0(v.throttle)}%</text>
      <rect x={BAR.x1} y={BAR.y} width={(BAR.x2 - BAR.x1) * thr} height="4" rx="2" fill="url(#dg-thr)" />
    </g>
  );
}
