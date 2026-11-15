// "Chrono" – luxury-watch inspired: navy sunburst dials, polished steel
// bezels, applied baton indices, faceted dauphine hands with lume, guilloché
// sub-dials, a working analog clock and a date-window gear indicator.
import { memo } from 'react';
import { CAR } from '../car.js';
import {
  VB_W, VB_H, polar, band, scale, tickPath, numerals, Needle, Telltale, LAMP, lampState,
  f0, f1, avgKmpl, ClusterFrame,
} from './kit.jsx';
import './chrono.css';

const R = 352;
const TACH = { cx: 446, cy: 450 };
const SPD = { cx: 1554, cy: 450 };
const A0 = -135;
const A1 = 135;
const SUB = { dy: 168, r: 80, a0: -120, a1: 120 };
const CLK = { cx: 1000, cy: 300, r: 112 };

const Defs = memo(() => (
  <defs>
    <radialGradient id="ch-bg" cx="50%" cy="40%" r="75%">
      <stop offset="0" stopColor="#1d1f24" />
      <stop offset="1" stopColor="#040405" />
    </radialGradient>
    <pattern id="ch-brush" width="6" height="6" patternUnits="userSpaceOnUse">
      <rect width="6" height="1" fill="#fff" opacity="0.018" />
    </pattern>
    <linearGradient id="ch-steel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#f5f6f8" />
      <stop offset="0.25" stopColor="#9ca2aa" />
      <stop offset="0.45" stopColor="#e7e9ec" />
      <stop offset="0.6" stopColor="#5d636b" />
      <stop offset="0.8" stopColor="#c9cdd2" />
      <stop offset="1" stopColor="#40454c" />
    </linearGradient>
    <radialGradient id="ch-sun" cx="50%" cy="50%" r="50%">
      <stop offset="0" stopColor="#24375a" />
      <stop offset="0.6" stopColor="#14223b" />
      <stop offset="1" stopColor="#0a1222" />
    </radialGradient>
    <linearGradient id="ch-sheen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#9cc0ff" stopOpacity="0.16" />
      <stop offset="0.45" stopColor="#9cc0ff" stopOpacity="0" />
      <stop offset="0.6" stopColor="#000" stopOpacity="0" />
      <stop offset="1" stopColor="#000" stopOpacity="0.3" />
    </linearGradient>
    <linearGradient id="ch-baton" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stopColor="#6d737c" />
      <stop offset="0.35" stopColor="#ffffff" />
      <stop offset="0.5" stopColor="#c3c8cf" />
      <stop offset="1" stopColor="#555a62" />
    </linearGradient>
    <linearGradient id="ch-baton-red" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stopColor="#7a1610" />
      <stop offset="0.35" stopColor="#ff6b55" />
      <stop offset="1" stopColor="#6a120c" />
    </linearGradient>
    <radialGradient id="ch-cap" cx="38%" cy="32%" r="70%">
      <stop offset="0" stopColor="#ffffff" />
      <stop offset="0.5" stopColor="#9aa0a8" />
      <stop offset="1" stopColor="#2a2e33" />
    </radialGradient>
    <linearGradient id="ch-window" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#d9d5cc" />
      <stop offset="0.18" stopColor="#f7f4ec" />
      <stop offset="1" stopColor="#ebe6da" />
    </linearGradient>
    <filter id="ch-drop" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="12" /></filter>
  </defs>
));

/** Sunburst: fine radial strokes over the gradient face. */
function sunburst(cx, cy, r, n = 144) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const [x1, y1] = polar(cx, cy, 6, (360 * i) / n);
    const [x2, y2] = polar(cx, cy, r, (360 * i) / n);
    d += `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }
  return d;
}

function Case({ cx, cy, r }) {
  const k = r / R;
  return (
    <g>
      <circle cx={cx} cy={cy + 14 * k} r={r + 32 * k} fill="#000" opacity="0.9" filter="url(#ch-drop)" />
      <circle cx={cx} cy={cy} r={r + 30 * k} fill="url(#ch-steel)" />
      <circle cx={cx} cy={cy} r={r + 18 * k} fill="#08090b" />
      <circle cx={cx} cy={cy} r={r + 13 * k} fill="none" stroke="url(#ch-steel)" strokeWidth={4 * k} />
      <circle cx={cx} cy={cy} r={r} fill="url(#ch-sun)" />
      <path d={sunburst(cx, cy, r)} stroke="#cfe0ff" strokeOpacity="0.035" strokeWidth={5 * k} />
      <circle cx={cx} cy={cy} r={r} fill="url(#ch-sheen)" />
    </g>
  );
}

/** Applied baton index: a raised polished bar with a lume tip. */
function Baton({ cx, cy, a, r1, r2, w, red }) {
  return (
    <g transform={`rotate(${a} ${cx} ${cy})`}>
      <rect x={cx - w / 2 + 2} y={cy - r1 + 4} width={w} height={r1 - r2} fill="#000" opacity="0.4" />
      <rect x={cx - w / 2} y={cy - r1} width={w} height={r1 - r2} fill={red ? 'url(#ch-baton-red)' : 'url(#ch-baton)'} />
      <rect x={cx - w / 2 + 3} y={cy - r1 + 4} width={w - 6} height={(r1 - r2) * 0.32} fill="#e6f3dc" opacity="0.9" />
    </g>
  );
}

const MainDial = memo(function MainDial({ cx, cy, min, max, major, minor, fmt, redFrom, label, sub }) {
  const ang = scale(min, max, A0, A1);
  const base = { cx, cy, min, max, rOuter: R - 4, ang };
  const sAng = scale(sub.min, sub.max, SUB.a0, SUB.a1);
  const scx = cx;
  const scy = cy + SUB.dy;
  const rings = [];
  for (let rr = 10; rr < SUB.r; rr += 7) rings.push(<circle key={rr} cx={scx} cy={scy} r={rr} />);
  const vals = [];
  for (let x = min; x <= max + 1e-6; x += major) vals.push(x);
  return (
    <g>
      <Case cx={cx} cy={cy} r={R} />
      {/* chapter ring */}
      <circle cx={cx} cy={cy} r={R - 20} fill="none" stroke="#0a1426" strokeWidth="40" />
      <circle cx={cx} cy={cy} r={R - 40} fill="none" stroke="#33476b" strokeWidth="1.5" />
      {redFrom != null && <path d={band(cx, cy, R - 40, R - 2, ang(redFrom), A1)} fill="#b3261a" opacity="0.75" />}
      <path d={tickPath({ ...base, step: minor, len: 14, skip: [major] })} className="ch-minute" />
      <path d={tickPath({ ...base, step: major, len: 30 })} className="ch-minute major" />
      {vals.map((x) => (
        <Baton key={x} cx={cx} cy={cy} a={ang(x)} r1={R - 54} r2={R - 112} w={15} red={redFrom != null && x >= redFrom} />
      ))}
      {numerals({ cx, cy, min, max, step: major, r: R - 152, ang, fmt, className: 'ch-num', redFrom, redClass: 'ch-num red' })}
      <text x={cx} y={cy - 104} textAnchor="middle" className="ch-label">{label}</text>

      {/* guilloché sub-dial */}
      <circle cx={scx} cy={scy} r={SUB.r + 6} fill="url(#ch-steel)" />
      <circle cx={scx} cy={scy} r={SUB.r} fill="#0b1426" />
      <g fill="none" stroke="#9cc0ff" strokeOpacity="0.07" strokeWidth="2">{rings}</g>
      <path d={tickPath({ cx: scx, cy: scy, min: sub.min, max: sub.max, step: sub.step, rOuter: SUB.r - 6, len: 12, ang: sAng })}
        className="ch-minute" />
      {sub.red && <path d={band(scx, scy, SUB.r - 18, SUB.r - 6, sAng(sub.red[0]), sAng(sub.red[1]))} fill="#c0392b" />}
      <text x={scx - 38} y={scy + 50} textAnchor="middle" className="ch-sublbl">{sub.lo}</text>
      <text x={scx + 38} y={scy + 50} textAnchor="middle" className="ch-sublbl">{sub.hi}</text>
      <text x={scx} y={scy + 30} textAnchor="middle" className="ch-subname">{sub.name}</text>
    </g>
  );
});

function Dauphine({ cx, cy, len, w, lume = true }) {
  const mid = cy - len * 0.32;
  return (
    <g>
      <polygon points={`${cx},${cy - len} ${cx - w / 2},${mid} ${cx},${cy + 22}`} fill="#f4f6f9" />
      <polygon points={`${cx},${cy - len} ${cx + w / 2},${mid} ${cx},${cy + 22}`} fill="#8a919b" />
      {lume && (
        <polygon points={`${cx},${cy - len * 0.9} ${cx - w * 0.16},${cy - len * 0.55} ${cx},${cy - len * 0.42} ${cx + w * 0.16},${cy - len * 0.55}`}
          fill="#dff6cf" />
      )}
    </g>
  );
}

function MainHand({ cx, cy, frac }) {
  const L = R - 46;
  const hand = (
    <>
      <rect x={cx - 3.5} y={cy} width="7" height="82" fill="#c9ced5" />
      <circle cx={cx} cy={cy + 70} r="13" fill="#c9ced5" />
      <Dauphine cx={cx} cy={cy} len={L} w={30} />
    </>
  );
  return (
    <g>
      <g transform="translate(5 9)" opacity="0.3">
        <Needle frac={frac} cx={cx} cy={cy} a0={A0} a1={A1} stiffness={100} damping={0.8}>
          <polygon points={`${cx},${cy - L} ${cx - 15},${cy - L * 0.32} ${cx},${cy + 80} ${cx + 15},${cy - L * 0.32}`} fill="#000" />
        </Needle>
      </g>
      <Needle frac={frac} cx={cx} cy={cy} a0={A0} a1={A1} stiffness={100} damping={0.8}>{hand}</Needle>
      <circle cx={cx} cy={cy} r="20" fill="url(#ch-cap)" />
    </g>
  );
}

function SubHand({ cx, cy, frac }) {
  return (
    <g>
      <Needle frac={frac} cx={cx} cy={cy} a0={SUB.a0} a1={SUB.a1} stiffness={40} damping={0.9}>
        <polygon points={`${cx - 3},${cy + 14} ${cx + 3},${cy + 14} ${cx + 1.2},${cy - SUB.r + 10} ${cx - 1.2},${cy - SUB.r + 10}`} fill="#e9ecf0" />
      </Needle>
      <circle cx={cx} cy={cy} r="8" fill="url(#ch-cap)" />
    </g>
  );
}

const ClockFace = memo(() => {
  const { cx, cy, r } = CLK;
  return (
    <g>
      <Case cx={cx} cy={cy} r={r} />
      {Array.from({ length: 12 }, (_, i) => (
        <Baton key={i} cx={cx} cy={cy} a={i * 30} r1={r - 10} r2={i % 3 === 0 ? r - 38 : r - 28} w={i % 3 === 0 ? 9 : 6} />
      ))}
      <path d={tickPath({ cx, cy, min: 0, max: 60, step: 1, rOuter: r - 4, len: 5, skip: [5], ang: (v) => v * 6 })} className="ch-minute thin" />
    </g>
  );
});

function ClockHands() {
  const { cx, cy, r } = CLK;
  const t = new Date();
  const s = t.getSeconds();
  const m = t.getMinutes() + s / 60;
  const h = (t.getHours() % 12) + m / 60;
  return (
    <g>
      <g transform={`rotate(${h * 30} ${cx} ${cy})`}><Dauphine cx={cx} cy={cy} len={r * 0.55} w={16} /></g>
      <g transform={`rotate(${m * 6} ${cx} ${cy})`}><Dauphine cx={cx} cy={cy} len={r * 0.82} w={12} /></g>
      <g transform={`rotate(${s * 6} ${cx} ${cy})`}>
        <rect x={cx - 1.2} y={cy - r * 0.86} width="2.4" height={r * 1.1} fill="#e8402c" />
        <circle cx={cx} cy={cy + r * 0.17} r="5" fill="#e8402c" />
      </g>
      <circle cx={cx} cy={cy} r="7" fill="url(#ch-cap)" />
    </g>
  );
}

const Back = memo(({ redline }) => (
  <>
    <Defs />
    <rect x="-500" y="-200" width={VB_W + 1000} height={VB_H + 400} fill="url(#ch-bg)" />
    <rect x="-500" y="-200" width={VB_W + 1000} height={VB_H + 400} fill="url(#ch-brush)" />
    <MainDial {...TACH} min={0} max={CAR.maxRpm} major={1000} minor={250} fmt={(x) => x / 1000} redFrom={redline}
      label="RPM × 1000" sub={{ min: 40, max: 120, step: 20, lo: 'C', hi: 'H', name: 'TEMP', red: [105, 120] }} />
    <MainDial {...SPD} min={0} max={CAR.maxSpeed} major={20} minor={5} fmt={(x) => x}
      label="km/h" sub={{ min: 10, max: 16, step: 1, lo: '10', hi: '16', name: 'VOLT', red: [10, 11.5] }} />
    <ClockFace />
    {/* date-style gear window */}
    <rect x="938" y="478" width="124" height="138" rx="10" fill="url(#ch-steel)" />
    <rect x="946" y="486" width="108" height="122" rx="6" fill="url(#ch-window)" />
    <rect x="946" y="486" width="108" height="14" rx="6" fill="#000" opacity="0.12" />
    <text x="1000" y="650" textAnchor="middle" className="ch-label">GEAR</text>
  </>
));

export default function Chrono({ d }) {
  const v = d.values;
  const L = lampState(d);
  return (
    <ClusterFrame
      className="chrono"
      back={<Back redline={d.settings.redline} />}
      live={
        <>
          <SubHand cx={TACH.cx} cy={TACH.cy + SUB.dy} frac={v.coolant == null ? 0 : (v.coolant - 40) / 80} />
          <SubHand cx={SPD.cx} cy={SPD.cy + SUB.dy} frac={v.voltage == null ? 0 : (v.voltage - 10) / 6} />
          <MainHand {...TACH} frac={(v.rpm ?? 0) / CAR.maxRpm} />
          <MainHand {...SPD} frac={(v.speed ?? 0) / CAR.maxSpeed} />
          <ClockHands />
          <text x="1000" y="582" textAnchor="middle" className={`ch-gear ${d.gear === 'N' ? 'n' : ''}`}>{d.gear}</text>
          <text x="1000" y="722" textAnchor="middle" className="ch-speed">{f0(v.speed)}<tspan className="ch-u"> km/h</tspan></text>
          <text x="1000" y="772" textAnchor="middle" className="ch-trip">{f1(avgKmpl(d.trip))} km/L · {f1(d.trip.distanceKm)} km</text>
          <Telltale kind="engine" x={898} y={92} size={40} on={L.engine} color={LAMP.amber} />
          <Telltale kind="battery" x={966} y={92} size={40} on={L.battery} color={LAMP.red} />
          <Telltale kind="temp" x={1034} y={92} size={40} on={L.hot || L.cold} color={L.hot ? LAMP.red : LAMP.blue} />
          <Telltale kind="link" x={1102} y={92} size={40} on={L.link} color={LAMP.blue} />
          <Telltale kind="shift" x={1100} y={548} size={40} on={L.shift} color={LAMP.green} />
          <Telltale kind="eco" x={1000} y={838} size={40} on={L.eco} color={LAMP.green} />
        </>
      }
    />
  );
}
