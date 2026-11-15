// "Touring" – German-premium style: deep black faces in chrome-ringed cowls,
// crisp white DIN-style numerals, lit red needles, centre trip computer.
import { memo } from 'react';
import { CAR } from '../car.js';
import {
  VB_W, VB_H, arc, band, scale, tickPath, numerals, Needle, taper, Telltale, LAMP,
  lampState, f0, f1, clock, tripTime, avgKmpl, ClusterFrame,
} from './kit.jsx';
import './touring.css';

const R = 368;
const TACH = { cx: 438, cy: 450 };
const SPD = { cx: 1562, cy: 450 };
const A0 = -135;
const A1 = 135;
const RO = R - 20; // tick outer radius
const MINI = { r: 262, left: 201, right: 159 }; // bottom mini-gauge (angles)

const Defs = memo(() => (
  <defs>
    <radialGradient id="tr-bg" cx="50%" cy="38%" r="70%">
      <stop offset="0" stopColor="#15181c" />
      <stop offset="1" stopColor="#000" />
    </radialGradient>
    <radialGradient id="tr-cowl">
      <stop offset="0.86" stopColor="#000" />
      <stop offset="0.93" stopColor="#191b1e" />
      <stop offset="0.975" stopColor="#2b2e33" />
      <stop offset="1" stopColor="#060607" />
    </radialGradient>
    <linearGradient id="tr-chrome" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stopColor="#fbfcfd" />
      <stop offset="0.2" stopColor="#b9bdc3" />
      <stop offset="0.42" stopColor="#53575d" />
      <stop offset="0.55" stopColor="#eceef1" />
      <stop offset="0.78" stopColor="#8b9096" />
      <stop offset="1" stopColor="#33363b" />
    </linearGradient>
    <radialGradient id="tr-face" cx="50%" cy="45%" r="55%">
      <stop offset="0" stopColor="#1a1c20" />
      <stop offset="0.65" stopColor="#0d0e10" />
      <stop offset="1" stopColor="#040405" />
    </radialGradient>
    <linearGradient id="tr-hood" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#000" stopOpacity="0.75" />
      <stop offset="0.28" stopColor="#000" stopOpacity="0" />
    </linearGradient>
    <linearGradient id="tr-needle" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stopColor="#a8160b" />
      <stop offset="0.5" stopColor="#ff7255" />
      <stop offset="1" stopColor="#a8160b" />
    </linearGradient>
    <radialGradient id="tr-hub" cx="40%" cy="32%" r="70%">
      <stop offset="0" stopColor="#6a6f76" />
      <stop offset="0.45" stopColor="#24272b" />
      <stop offset="1" stopColor="#060708" />
    </radialGradient>
    <linearGradient id="tr-glass" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0" stopColor="#fff" stopOpacity="0.07" />
      <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
    </linearGradient>
    <linearGradient id="tr-mid" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#0e1217" />
      <stop offset="1" stopColor="#06080a" />
    </linearGradient>
    <filter id="tr-glow" x="-50%" y="-10%" width="200%" height="120%">
      <feGaussianBlur stdDeviation="7" />
    </filter>
    <filter id="tr-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="14" />
    </filter>
  </defs>
));

/** Static dial artwork (memoised – never re-renders while driving). */
const Dial = memo(function Dial({ cx, cy, min, max, major, mid, minor, numFmt, redFrom, unit, mini }) {
  const ang = scale(min, max, A0, A1);
  const base = { cx, cy, min, max, rOuter: RO, ang };
  const notRed = (v) => redFrom == null || v < redFrom;
  const isRed = (v) => redFrom != null && v >= redFrom;
  const mAng = (f) => MINI.left + (MINI.right - MINI.left) * f;
  return (
    <g>
      {/* cowl, chrome ring, face */}
      <circle cx={cx} cy={cy + 12} r={R + 44} fill="#000" filter="url(#tr-shadow)" />
      <circle cx={cx} cy={cy} r={R + 44} fill="url(#tr-cowl)" />
      <circle cx={cx} cy={cy} r={R + 13} fill="none" stroke="url(#tr-chrome)" strokeWidth="11" />
      <circle cx={cx} cy={cy} r={R + 5} fill="none" stroke="#000" strokeWidth="6" />
      <circle cx={cx} cy={cy} r={R} fill="url(#tr-face)" />
      <circle cx={cx} cy={cy} r={R - 3} fill="none" stroke="#ff2a1a" strokeOpacity="0.28" strokeWidth="2" />

      {/* scale */}
      <path d={arc(cx, cy, RO + 1, A0, A1)} className="tr-baseline" />
      {redFrom != null && <path d={band(cx, cy, RO - 62, RO - 50, ang(redFrom), A1)} className="tr-redband" />}
      <path d={tickPath({ ...base, step: minor, len: 16, skip: [mid, major], filter: notRed })} className="tr-tick minor" />
      <path d={tickPath({ ...base, step: mid, len: 28, skip: [major], filter: notRed })} className="tr-tick mid" />
      <path d={tickPath({ ...base, step: major, len: 46, filter: notRed })} className="tr-tick major" />
      {redFrom != null && (
        <>
          <path d={tickPath({ ...base, step: minor, len: 16, skip: [mid, major], filter: isRed })} className="tr-tick minor red" />
          <path d={tickPath({ ...base, step: mid, len: 28, skip: [major], filter: isRed })} className="tr-tick mid red" />
          <path d={tickPath({ ...base, step: major, len: 46, filter: isRed })} className="tr-tick major red" />
        </>
      )}
      {numerals({ cx, cy, min, max, step: major, r: RO - 96, ang, fmt: numFmt, className: 'tr-num', redFrom, redClass: 'tr-num red' })}
      <text x={cx} y={cy - 128} textAnchor="middle" className="tr-unit">{unit}</text>

      {/* bottom mini gauge */}
      <path d={arc(cx, cy, MINI.r, MINI.right, MINI.left)} className="tr-mini-track" />
      {mini.redFrom != null && <path d={band(cx, cy, MINI.r - 2, MINI.r + 14, mAng(1), mAng(mini.redFrom))} className="tr-redband" />}
      <path d={[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const a = (mAng(f) * Math.PI) / 180;
        const L = f === 0.5 ? 22 : 16;
        return `M${cx + MINI.r * Math.sin(a)} ${cy - MINI.r * Math.cos(a)}L${cx + (MINI.r + L) * Math.sin(a)} ${cy - (MINI.r + L) * Math.cos(a)}`;
      }).join('')} className="tr-tick mid" />
      <text x={cx - 118} y={cy + 268} textAnchor="middle" className="tr-mini-lbl">{mini.l}</text>
      <text x={cx + 118} y={cy + 268} textAnchor="middle" className="tr-mini-lbl">{mini.r}</text>
      <Telltale kind={mini.icon} x={cx} y={cy + 196} size={36} on color="#8e959d" />

      {/* hood shadow + glass */}
      <circle cx={cx} cy={cy} r={R} fill="url(#tr-hood)" />
    </g>
  );
});

function BigNeedle({ cx, cy, frac }) {
  const red = taper(cx, cy, { tip: RO - 4, tail: 0, wBase: 20, wTip: 5 });
  const halo = taper(cx, cy, { tip: RO + 2, tail: 0, wBase: 46, wTip: 18 });
  const halo2 = taper(cx, cy, { tip: RO, tail: 0, wBase: 32, wTip: 11 });
  return (
    <Needle frac={frac} cx={cx} cy={cy} a0={A0} a1={A1} stiffness={110} damping={0.78}>
      <polygon points={halo} fill="#ff2a14" opacity="0.12" />
      <polygon points={halo2} fill="#ff3a1c" opacity="0.22" />
      <rect x={cx - 13} y={cy} width="26" height="78" rx="9" fill="#0b0b0c" />
      <polygon points={red} fill="url(#tr-needle)" />
    </Needle>
  );
}

function MiniNeedle({ cx, cy, frac }) {
  return (
    <Needle frac={frac} cx={cx} cy={cy} a0={MINI.left} a1={MINI.right} stiffness={40} damping={0.9}>
      <polygon points={`${cx - 4},${cy - MINI.r + 26} ${cx + 4},${cy - MINI.r + 26} ${cx + 2},${cy - MINI.r - 22} ${cx - 2},${cy - MINI.r - 22}`}
        fill="#ff3a22" />
    </Needle>
  );
}

const Hub = ({ cx, cy }) => (
  <g>
    <circle cx={cx} cy={cy} r="46" fill="url(#tr-hub)" stroke="#000" strokeWidth="4" />
    <circle cx={cx} cy={cy} r="12" fill="#0a0a0b" />
    <circle cx={cx} cy={cy} r={R} fill="url(#tr-glass)" pointerEvents="none" />
  </g>
);

export default function Touring({ d, night = false }) {
  const v = d.values;
  const L = lampState(d);
  const avg = avgKmpl(d.trip);
  const gearN = d.gear === 'N';
  return (
    <ClusterFrame
      className={night ? "touring night" : "touring"}
      back={<TouringBack redline={d.settings.redline} />}
      live={
        <>
          <MiniNeedle {...TACH} frac={v.coolant == null ? 0 : (v.coolant - 50) / 75} />
          <MiniNeedle {...SPD} frac={(d.kmpl ?? 0) / 30} />
          <BigNeedle {...TACH} frac={(v.rpm ?? 0) / CAR.maxRpm} />
          <BigNeedle {...SPD} frac={(v.speed ?? 0) / CAR.maxSpeed} />

          <g className="tr-mid">
            <text x="886" y="196" className="tr-mid-sm">{clock()}</text>
            <text x="1114" y="196" textAnchor="end" className="tr-mid-sm">{f0(v.iat)}°C</text>
            <text x="1000" y="452" textAnchor="middle" className={`tr-gear ${gearN ? 'n' : ''}`}>{d.gear}</text>
            <Telltale kind="shift" x={1100} y={330} size={40} on={L.shift} color={LAMP.green} />
            <text x="1034" y="560" textAnchor="end" className="tr-speed">{f0(v.speed)}</text>
            <text x="1114" y="642" textAnchor="end" className="tr-mid-val">{f1(avg)}<tspan className="tr-mid-u"> km/L</tspan></text>
            <text x="1114" y="686" textAnchor="end" className="tr-mid-val">{f1(d.trip.distanceKm)}<tspan className="tr-mid-u"> km</tspan></text>
            <text x="1114" y="730" textAnchor="end" className="tr-mid-val">{tripTime(d.trip.movingS)}</text>
          </g>

          <Telltale kind="engine" x={898} y={84} on={L.engine} color={LAMP.amber} />
          <Telltale kind="battery" x={966} y={84} on={L.battery} color={LAMP.red} />
          <Telltale kind="temp" x={1034} y={84} on={L.hot || L.cold} color={L.hot ? LAMP.red : LAMP.blue} />
          <Telltale kind="link" x={1102} y={84} on={L.link} color={LAMP.blue} />
          <Telltale kind="eco" x={1000} y={816} on={L.eco} color={LAMP.green} />
        </>
      }
      front={<><Hub {...TACH} /><Hub {...SPD} /></>}
    />
  );
}

const TouringBack = memo(({ redline }) => (
  <>
    <Defs />
    <rect x="-500" y="-200" width={VB_W + 1000} height={VB_H + 400} fill="url(#tr-bg)" />
    <Dial cx={TACH.cx} cy={TACH.cy} min={0} max={CAR.maxRpm} major={1000} mid={500} minor={250}
      numFmt={(x) => x / 1000} redFrom={redline} unit="1/min × 1000"
      mini={{ l: 'C', r: 'H', icon: 'temp', redFrom: 0.8 }} />
    <Dial cx={SPD.cx} cy={SPD.cy} min={0} max={CAR.maxSpeed} major={20} mid={10} minor={5}
      numFmt={(x) => x} unit="km/h" mini={{ l: '0', r: '30', icon: 'eco' }} />
    <rect x="862" y="140" width="276" height="620" rx="26" fill="url(#tr-mid)" stroke="#1c232c" strokeWidth="3" />
    <path d="M884 222H1116M884 596H1116" className="tr-rule" />
    <text x="1000" y="272" textAnchor="middle" className="tr-mid-lbl">GEAR</text>
    <text x="1044" y="560" className="tr-mid-lbl">km/h</text>
    <text x="886" y="642" className="tr-mid-lbl">AVG</text>
    <text x="886" y="686" className="tr-mid-lbl">TRIP</text>
    <text x="886" y="730" className="tr-mid-lbl">TIME</text>
  </>
));

/** Same cluster with classic amber night illumination. */
export const TouringNight = ({ d }) => <Touring d={d} night />;
