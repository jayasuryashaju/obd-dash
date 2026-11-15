// "Horizon" – modern minimalist HUD: one wide rev arc sweeping across the
// whole screen, huge light-weight speed digits, gear box and data tiles.
import { memo } from 'react';
import { CAR } from '../car.js';
import {
  VB_W, VB_H, band, polar, useSegments, Telltale, LAMP, lampState, f0, f1, avgKmpl, ClusterFrame,
} from './kit.jsx';
import './horizon.css';

const C = { cx: 1000, cy: 1480 };
const R1 = 1328;
const R2 = 1392;
const A0 = -38;
const A1 = 38;
const N = 70;
const segA = (i) => A0 + ((A1 - A0) * i) / N;
const segPath = (i) => band(C.cx, C.cy, R1, R2, segA(i) + 0.13, segA(i + 1) - 0.13);
const rpmAng = (r) => A0 + ((A1 - A0) * r) / CAR.maxRpm;

const TILES = [
  { key: 'water', label: 'COOLANT', unit: '°C', x: 300 },
  { key: 'volt', label: 'BATTERY', unit: 'V', x: 655 },
  { key: 'econ', label: 'ECONOMY', unit: 'km/L', x: 1010 },
  { key: 'trip', label: 'TRIP', unit: 'km', x: 1365 },
];
const TW = 335;

const Back = memo(({ redline }) => {
  const ticks = [];
  for (let r = 0; r <= CAR.maxRpm; r += 500) {
    const major = r % 1000 === 0;
    const a = rpmAng(r);
    const [x1, y1] = polar(C.cx, C.cy, R1 - 10, a);
    const [x2, y2] = polar(C.cx, C.cy, R1 - (major ? 34 : 22), a);
    ticks.push(<line key={r} x1={x1} y1={y1} x2={x2} y2={y2} className={`hz-tick ${major ? 'major' : ''} ${r >= redline ? 'red' : ''}`} />);
    if (major) {
      const [tx, ty] = polar(C.cx, C.cy, R1 - 70, a);
      ticks.push(<text key={`t${r}`} x={tx} y={ty} dy="0.35em" textAnchor="middle" className={`hz-num ${r >= redline ? 'red' : ''}`}>{r / 1000}</text>);
    }
  }
  return (
    <>
      <defs>
        <radialGradient id="hz-bg" cx="50%" cy="95%" r="80%">
          <stop offset="0" stopColor="#0a1a1d" />
          <stop offset="0.6" stopColor="#030607" />
          <stop offset="1" stopColor="#000" />
        </radialGradient>
        <linearGradient id="hz-tile" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0e1417" />
          <stop offset="1" stopColor="#080b0d" />
        </linearGradient>
        <filter id="hz-soft" x="-10%" y="-50%" width="120%" height="200%"><feGaussianBlur stdDeviation="22" /></filter>
      </defs>
      <rect x="-500" y="-200" width={VB_W + 1000} height={VB_H + 400} fill="url(#hz-bg)" />
      <path d={band(C.cx, C.cy, R1 - 6, R2 + 6, A0 - 0.5, A1 + 0.5)} fill="#0b1013" stroke="#1a2328" strokeWidth="2" />
      <path d={band(C.cx, C.cy, R2 + 10, R2 + 14, rpmAng(redline), A1)} fill="#ff3355" />
      {ticks}
      <text x={C.cx} y={262} textAnchor="middle" className="hz-cap">rpm × 1000</text>

      {/* gear box */}
      <rect x="470" y="400" width="190" height="230" rx="22" fill="url(#hz-tile)" stroke="#1f2a30" strokeWidth="2" />
      <text x="565" y="438" textAnchor="middle" className="hz-lbl">GEAR</text>
      {/* rpm readout */}
      <text x="1530" y="446" textAnchor="end" className="hz-lbl">ENGINE</text>
      <text x="1530" y="600" textAnchor="end" className="hz-lbl">rpm</text>
      <text x={C.cx} y={690} textAnchor="middle" className="hz-lbl">km/h</text>

      {TILES.map((t) => (
        <g key={t.key}>
          <rect x={t.x} y="722" width={TW} height="128" rx="18" fill="url(#hz-tile)" stroke="#1a2328" strokeWidth="2" />
          <text x={t.x + 26} y="764" className="hz-lbl">{t.label}</text>
          <text x={t.x + TW - 24} y="764" textAnchor="end" className="hz-lbl dim">{t.unit}</text>
          <rect x={t.x + 26} y="826" width={TW - 52} height="5" rx="2.5" fill="#182126" />
        </g>
      ))}
    </>
  );
});

/** teal → white along the arc */
function segColor(t) {
  const a = [47, 224, 207];
  const b = [242, 255, 253];
  const m = a.map((x, i) => Math.round(x + (b[i] - x) * t));
  return `rgb(${m.join(',')})`;
}

function RevArc({ rpm, redline }) {
  const red = Math.floor((redline / CAR.maxRpm) * N);
  const cls = (i, on) => `hz-seg ${on ? (i >= red ? 'on red' : 'on') : ''}`;
  const refs = useSegments(rpm / CAR.maxRpm, N, cls, { stiffness: 130, damping: 0.8 });
  return (
    <g>
      {Array.from({ length: N }, (_, i) => (
        <path key={i} ref={(el) => { refs.current[i] = el; }} d={segPath(i)} className={cls(i, false)}
          style={{ '--c': segColor(i / N) }} />
      ))}
    </g>
  );
}

const pct = (v, a, b) => (v == null ? 0 : Math.max(0, Math.min(1, (v - a) / (b - a))));

export default function Horizon({ d }) {
  const v = d.values;
  const L = lampState(d);
  const avg = avgKmpl(d.trip);
  const tiles = {
    water: [f0(v.coolant), pct(v.coolant, 40, 120), v.coolant > 105],
    volt: [f1(v.voltage), pct(v.voltage, 11, 15), L.battery],
    econ: [d.kmpl == null ? '--' : d.kmpl > 50 ? '50+' : f1(d.kmpl), pct(d.kmpl, 0, 30), false],
    trip: [f1(d.trip.distanceKm), 0, false],
  };
  return (
    <ClusterFrame
      className="horizon"
      back={<Back redline={d.settings.redline} />}
      live={
        <>
          <RevArc rpm={v.rpm ?? 0} redline={d.settings.redline} />
          <text x="565" y="602" textAnchor="middle" className={`hz-gear ${d.gear === 'N' ? 'n' : ''}`}>{d.gear}</text>
          <Telltale kind="shift" x={565} y={360} size={46} on={L.shift} color={LAMP.green} />
          <text x="1530" y="548" textAnchor="end" className="hz-rpm">{f0(v.rpm)}</text>
          <text x={C.cx} y={620} textAnchor="middle" className="hz-speed">{f0(v.speed)}</text>
          {TILES.map((t) => {
            const [val, frac, warn] = tiles[t.key];
            return (
              <g key={t.key}>
                <text x={t.x + 26} y="814" className={`hz-val ${warn ? 'warn' : ''}`}>{val}</text>
                {t.key === 'trip'
                  ? <text x={t.x + TW - 24} y="814" textAnchor="end" className="hz-sub">{f1(avg)} avg</text>
                  : <rect x={t.x + 26} y="826" width={(TW - 52) * frac} height="5" rx="2.5" className={`hz-fill ${warn ? 'warn' : ''}`} />}
              </g>
            );
          })}
          <Telltale kind="engine" x={892} y={318} size={40} on={L.engine} color={LAMP.amber} />
          <Telltale kind="battery" x={964} y={318} size={40} on={L.battery} color={LAMP.red} />
          <Telltale kind="temp" x={1036} y={318} size={40} on={L.hot || L.cold} color={L.hot ? LAMP.red : LAMP.blue} />
          <Telltale kind="link" x={1108} y={318} size={40} on={L.link} color={LAMP.blue} />
          <Telltale kind="eco" x={1435} y={360} size={40} on={L.eco} color={LAMP.green} />
        </>
      }
    />
  );
}
