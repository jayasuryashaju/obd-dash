// "Heritage" – classic sports-car instruments: ivory faces under domed glass,
// polished chrome bezels, slim black needles with orange tips, drum counters,
// jewel warning lamps and four auxiliary gauges.
import { memo } from 'react';
import { CAR } from '../car.js';
import {
  VB_W, VB_H, arc, band, scale, tickPath, numerals, Needle, taper, Icon, LAMP, lampState, ClusterFrame,
} from './kit.jsx';
import './heritage.css';

const BIG = 318;
const SMALL = 150;
const SPD = { cx: 668, cy: 450 };
const TACH = { cx: 1332, cy: 450 };
const AUX = [
  { key: 'water', cx: 172, cy: 262 },
  { key: 'volts', cx: 172, cy: 638 },
  { key: 'map', cx: 1828, cy: 262 },
  { key: 'econ', cx: 1828, cy: 638 },
];
const A0 = -135;
const A1 = 135;
const S0 = -120;
const S1 = 120;

const Defs = memo(() => (
  <defs>
    <radialGradient id="hg-bg" cx="50%" cy="45%" r="75%">
      <stop offset="0" stopColor="#1f1d1a" />
      <stop offset="1" stopColor="#050505" />
    </radialGradient>
    <linearGradient id="hg-chrome" x1="0.1" y1="0" x2="0.9" y2="1">
      <stop offset="0" stopColor="#ffffff" />
      <stop offset="0.22" stopColor="#c9ccd0" />
      <stop offset="0.4" stopColor="#5f6368" />
      <stop offset="0.52" stopColor="#f4f5f6" />
      <stop offset="0.7" stopColor="#9da1a6" />
      <stop offset="0.86" stopColor="#3e4146" />
      <stop offset="1" stopColor="#d4d7da" />
    </linearGradient>
    <linearGradient id="hg-chrome-in" x1="0.9" y1="1" x2="0.1" y2="0">
      <stop offset="0" stopColor="#f6f7f8" />
      <stop offset="0.35" stopColor="#7b7f85" />
      <stop offset="0.6" stopColor="#e3e5e8" />
      <stop offset="1" stopColor="#4a4d52" />
    </linearGradient>
    <radialGradient id="hg-face" cx="50%" cy="44%" r="58%">
      <stop offset="0" stopColor="#f8f3e6" />
      <stop offset="0.7" stopColor="#eee5cf" />
      <stop offset="1" stopColor="#d8cbac" />
    </radialGradient>
    <radialGradient id="hg-cap" cx="36%" cy="30%" r="75%">
      <stop offset="0" stopColor="#ffffff" />
      <stop offset="0.4" stopColor="#a9adb2" />
      <stop offset="1" stopColor="#2c2e31" />
    </radialGradient>
    <linearGradient id="hg-glass" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stopColor="#fff" stopOpacity="0.38" />
      <stop offset="1" stopColor="#fff" stopOpacity="0" />
    </linearGradient>
    <filter id="hg-inner" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="16" />
    </filter>
    <filter id="hg-drop" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" />
    </filter>
    <filter id="hg-nshadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="5" dy="9" stdDeviation="5" floodColor="#000" floodOpacity="0.38" />
    </filter>
    <radialGradient id="hg-jewel-off">
      <stop offset="0" stopColor="#3a3632" />
      <stop offset="1" stopColor="#0d0c0b" />
    </radialGradient>
    {AUX.concat([{ key: 'spd', ...SPD, r: BIG }, { key: 'tach', ...TACH, r: BIG }]).map((g) => (
      <clipPath id={`hg-clip-${g.key}`} key={g.key}>
        <circle cx={g.cx} cy={g.cy} r={g.r ?? SMALL} />
      </clipPath>
    ))}
  </defs>
));

const Background = memo(() => (
  <g>
    <rect x="-500" y="-200" width={VB_W + 1000} height={VB_H + 400} fill="url(#hg-bg)" />
  </g>
));

/** Bezel + face + glass, shared by big and small dials. */
function Housing({ cx, cy, r, clip, children }) {
  const k = r / BIG;
  return (
    <g>
      <circle cx={cx} cy={cy + 14 * k} r={r + 34 * k} fill="#000" opacity="0.85" filter="url(#hg-drop)" />
      <circle cx={cx} cy={cy} r={r + 30 * k} fill="url(#hg-chrome)" />
      <circle cx={cx} cy={cy} r={r + 15 * k} fill="url(#hg-chrome-in)" />
      <circle cx={cx} cy={cy} r={r + 4 * k} fill="#141414" />
      <circle cx={cx} cy={cy} r={r} fill="url(#hg-face)" />
      <g clipPath={`url(#${clip})`}>
        {children}
        <circle cx={cx} cy={cy + 6 * k} r={r} fill="none" stroke="#3b2c14" strokeOpacity="0.5" strokeWidth={46 * k} filter="url(#hg-inner)" />
      </g>
    </g>
  );
}

const Glass = ({ cx, cy, r, clip }) => (
  <g clipPath={`url(#${clip})`} pointerEvents="none">
    <ellipse cx={cx - r * 0.18} cy={cy - r * 0.52} rx={r * 0.92} ry={r * 0.5}
      transform={`rotate(-24 ${cx} ${cy})`} fill="url(#hg-glass)" opacity="0.55" />
  </g>
);

function Drum({ x, y, text, cell = 34, h = 48, lastWhite = false, fs }) {
  const w = cell * text.length;
  return (
    <g>
      <rect x={x - w / 2 - 5} y={y - h / 2 - 5} width={w + 10} height={h + 10} rx="4" fill="#2a2620" />
      {text.split('').map((ch, i) => {
        const white = lastWhite && i === text.length - 1;
        const cxx = x - w / 2 + cell * i;
        return (
          <g key={i}>
            <rect x={cxx + 1} y={y - h / 2} width={cell - 2} height={h} fill={white ? '#f3eee0' : '#0f0e0d'} />
            <rect x={cxx + 1} y={y - h / 2} width={cell - 2} height={h / 2} fill="#fff" opacity="0.06" />
            <text x={cxx + cell / 2} y={y} dy="0.36em" textAnchor="middle" className={`hg-drum ${white ? 'w' : ''}`} style={fs ? { fontSize: fs } : undefined}>{ch}</text>
          </g>
        );
      })}
    </g>
  );
}

const BigFace = memo(function BigFace({ cx, cy, min, max, major, mid, minor, fmt, redFrom, numClass, clip, label, labelY }) {
  const ang = scale(min, max, A0, A1);
  const rO = BIG - 18;
  const base = { cx, cy, min, max, rOuter: rO, ang };
  return (
    <Housing cx={cx} cy={cy} r={BIG} clip={clip}>
      {redFrom != null && <path d={band(cx, cy, rO - 38, rO, ang(redFrom), A1)} className="hg-red" />}
      <path d={arc(cx, cy, rO, A0, A1)} className="hg-line" />
      <path d={tickPath({ ...base, step: minor, len: 14, skip: [mid, major] })} className="hg-tick minor" />
      <path d={tickPath({ ...base, step: mid, len: 24, skip: [major] })} className="hg-tick mid" />
      <path d={tickPath({ ...base, step: major, len: 38 })} className="hg-tick major" />
      {numerals({ cx, cy, min, max, step: major, r: rO - 80, ang, fmt, className: numClass })}
      <text x={cx} y={cy + labelY} textAnchor="middle" className="hg-label">{label}</text>
    </Housing>
  );
});

const AUX_SPEC = {
  water: { min: 40, max: 120, major: 20, minor: 10, top: '°C', label: 'WATER', red: [[105, 120]] },
  volts: { min: 8, max: 16, major: 2, minor: 1, top: 'V', label: 'VOLTS', red: [[8, 11], [15, 16]] },
  map: { min: 0, max: 120, major: 20, minor: 10, top: 'kPa', label: 'MANIFOLD', red: [] },
  econ: { min: 0, max: 30, major: 10, minor: 5, top: 'km/L', label: 'ECONOMY', red: [] },
};

const SmallFace = memo(function SmallFace({ k, cx, cy }) {
  const s = AUX_SPEC[k];
  const ang = scale(s.min, s.max, S0, S1);
  const rO = SMALL - 12;
  const base = { cx, cy, min: s.min, max: s.max, rOuter: rO, ang };
  return (
    <Housing cx={cx} cy={cy} r={SMALL} clip={`hg-clip-${k}`}>
      {s.red.map(([a, b]) => <path key={a} d={band(cx, cy, rO - 18, rO, ang(a), ang(b))} className="hg-red" />)}
      <path d={arc(cx, cy, rO, S0, S1)} className="hg-line" />
      <path d={tickPath({ ...base, step: s.minor, len: 11, skip: [s.major] })} className="hg-tick minor" />
      <path d={tickPath({ ...base, step: s.major, len: 22 })} className="hg-tick major sm" />
      {numerals({ cx, cy, min: s.min, max: s.max, step: s.major, r: rO - 44, ang, className: 'hg-num-sm' })}
      <text x={cx} y={cy - 46} textAnchor="middle" className="hg-unit-sm">{s.top}</text>
      <text x={cx} y={cy + 72} textAnchor="middle" className="hg-label-sm">{s.label}</text>
    </Housing>
  );
});

function HNeedle({ cx, cy, frac, len, w, a0, a1, cap, stiffness }) {
  const body = taper(cx, cy, { tip: len, tail: len * 0.2, wBase: w, wTip: w * 0.22, wTail: w * 1.25 });
  const tipStart = len * 0.7;
  const tip = taper(cx, cy - tipStart, { tip: len - tipStart, wBase: w * 0.5, wTip: w * 0.22 });
  const k = len / 300;
  return (
    <g>
      <g transform={`translate(${6 * k} ${11 * k})`} opacity="0.22">
        <Needle frac={frac} cx={cx} cy={cy} a0={a0} a1={a1} stiffness={stiffness} damping={0.8}>
          <polygon points={body} fill="#000" />
        </Needle>
      </g>
      <Needle frac={frac} cx={cx} cy={cy} a0={a0} a1={a1} stiffness={stiffness} damping={0.8}>
        <polygon points={body} fill="#141414" />
        <polygon points={tip} fill="#e2501f" />
      </Needle>
      <circle cx={cx + 3 * k} cy={cy + 6 * k} r={cap} fill="#000" opacity="0.25" />
      <circle cx={cx} cy={cy} r={cap} fill="url(#hg-cap)" stroke="#1a1a1a" strokeWidth="2" />
    </g>
  );
}

function Jewel({ x, y, on, color, kind }) {
  return (
    <g>
      <circle cx={x} cy={y} r="33" fill="url(#hg-chrome)" />
      <circle cx={x} cy={y} r="26" fill={on ? color : 'url(#hg-jewel-off)'}
        style={on ? { filter: `drop-shadow(0 0 14px ${color})` } : undefined} />
      <circle cx={x - 8} cy={y - 9} r="8" fill="#fff" opacity={on ? 0.55 : 0.12} />
      <g style={{ color: on ? '#1b0f05' : '#5a524a' }} opacity={on ? 0.85 : 0.5}>
        <g transform={`translate(${x - 14} ${y - 14}) scale(${28 / 48})`}>
          <Icon kind={kind} />
        </g>
      </g>
    </g>
  );
}

export default function Heritage({ d }) {
  const v = d.values;
  const L = lampState(d);
  const trip = String(Math.floor(d.trip.distanceKm * 10) % 1000000).padStart(6, '0');
  const fr = (k, val) => (val == null ? 0 : (val - AUX_SPEC[k].min) / (AUX_SPEC[k].max - AUX_SPEC[k].min));
  const auxVal = { water: v.coolant, volts: v.voltage, map: v.map, econ: d.kmpl };

  return (
    <ClusterFrame
      className="heritage"
      back={<HeritageBack redline={d.settings.redline} />}
      live={
        <>
          <Drum x={SPD.cx} y={SPD.cy + 128} text={trip} lastWhite />
          <Drum x={TACH.cx} y={TACH.cy + 132} text={d.gear} cell={58} h={74} fs={56} />
          {AUX.map((g) => (
            <HNeedle key={g.key} cx={g.cx} cy={g.cy} frac={fr(g.key, auxVal[g.key])} len={SMALL - 18} w={11}
              a0={S0} a1={S1} cap={17} stiffness={45} />
          ))}
          <HNeedle {...SPD} frac={(v.speed ?? 0) / CAR.maxSpeed} len={BIG - 24} w={17} a0={A0} a1={A1} cap={30} stiffness={95} />
          <HNeedle {...TACH} frac={(v.rpm ?? 0) / CAR.maxRpm} len={BIG - 24} w={17} a0={A0} a1={A1} cap={30} stiffness={120} />
          <Jewel x={928} y={150} kind="engine" on={L.engine} color={LAMP.amber} />
          <Jewel x={1000} y={128} kind="battery" on={L.battery} color={LAMP.red} />
          <Jewel x={1072} y={150} kind="temp" on={L.hot || L.cold} color={L.hot ? LAMP.red : LAMP.blue} />
          <Jewel x={928} y={750} kind="shift" on={L.shift} color={LAMP.green} />
          <Jewel x={1000} y={772} kind="eco" on={L.eco} color={LAMP.green} />
          <Jewel x={1072} y={750} kind="link" on={L.link} color={LAMP.blue} />
        </>
      }
      front={<HeritageGlass />}
    />
  );
}

const HeritageBack = memo(({ redline }) => (
  <>
    <Defs />
    <Background />
    {AUX.map((g) => <SmallFace key={g.key} k={g.key} cx={g.cx} cy={g.cy} />)}
    <BigFace {...SPD} min={0} max={CAR.maxSpeed} major={20} mid={10} minor={5} fmt={(x) => x}
      numClass="hg-num spd" clip="hg-clip-spd" label="km/h" labelY={-108} />
    <BigFace {...TACH} min={0} max={CAR.maxRpm} major={1000} mid={500} minor={250} fmt={(x) => x / 1000}
      redFrom={redline} numClass="hg-num" clip="hg-clip-tach" label="RPM × 1000" labelY={-108} />
    <text x={SPD.cx} y={SPD.cy + 190} textAnchor="middle" className="hg-label-sm">TRIP</text>
    <text x={TACH.cx} y={TACH.cy + 204} textAnchor="middle" className="hg-label-sm">GEAR</text>
  </>
));

const HeritageGlass = memo(() => (
  <>
    {AUX.map((g) => <Glass key={g.key} cx={g.cx} cy={g.cy} r={SMALL} clip={`hg-clip-${g.key}`} />)}
    <Glass {...SPD} r={BIG} clip="hg-clip-spd" />
    <Glass {...TACH} r={BIG} clip="hg-clip-tach" />
  </>
));
