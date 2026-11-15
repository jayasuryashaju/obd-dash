// "Sport" – performance-car layout: one large white-faced tachometer with
// bezel-mounted shift LEDs, an inset LCD for gear + speed, curved segment
// wings for coolant and throttle, and carbon side panels with live data.
import { memo } from 'react';
import { CAR } from '../car.js';
import {
  VB_W, VB_H, arc, band, polar, scale, tickPath, numerals, Needle, taper, Telltale, LAMP, lampState,
  f0, f1, tripTime, avgKmpl, ClusterFrame,
} from './kit.jsx';
import './sport.css';

const C = { cx: 1000, cy: 462 };
const R = 388;
const A0 = -135;
const A1 = 105;
const RO = R - 20;
const LEDS = 11;
const LED_R = 417;
const WING = { r1: 458, r2: 506, n: 16 };
const LEFT = { from: 236, to: 314 }; // coolant, bottom → top
const RIGHT = { from: 124, to: 46 }; // throttle, bottom → top
const LCD = { x: 1002, y: 562, w: 268, h: 172 };

const Defs = memo(() => (
  <defs>
    <pattern id="sp-carbon" width="18" height="18" patternUnits="userSpaceOnUse">
      <rect width="18" height="18" fill="#0b0c0d" />
      <rect width="9" height="9" fill="#161819" />
      <rect x="9" y="9" width="9" height="9" fill="#161819" />
      <rect width="9" height="3" fill="#1d2022" />
      <rect x="9" y="9" width="9" height="3" fill="#1d2022" />
    </pattern>
    <radialGradient id="sp-vig" cx="50%" cy="50%" r="65%">
      <stop offset="0.35" stopColor="#000" stopOpacity="0" />
      <stop offset="1" stopColor="#000" stopOpacity="0.85" />
    </radialGradient>
    <linearGradient id="sp-bezel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#4b4f55" />
      <stop offset="0.5" stopColor="#1b1d20" />
      <stop offset="1" stopColor="#2f3236" />
    </linearGradient>
    <linearGradient id="sp-chrome" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0" stopColor="#ffffff" />
      <stop offset="0.35" stopColor="#8c9096" />
      <stop offset="0.6" stopColor="#e9ebee" />
      <stop offset="1" stopColor="#50545a" />
    </linearGradient>
    <radialGradient id="sp-face" cx="50%" cy="42%" r="60%">
      <stop offset="0" stopColor="#ffffff" />
      <stop offset="0.75" stopColor="#eef0f1" />
      <stop offset="1" stopColor="#d6d9dc" />
    </radialGradient>
    <radialGradient id="sp-cap" cx="40%" cy="35%" r="70%">
      <stop offset="0" stopColor="#3b3e43" />
      <stop offset="1" stopColor="#050506" />
    </radialGradient>
    <linearGradient id="sp-needle" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stopColor="#d42a00" />
      <stop offset="0.5" stopColor="#ff6a2a" />
      <stop offset="1" stopColor="#d42a00" />
    </linearGradient>
    <linearGradient id="sp-lcd" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#1b2026" />
      <stop offset="1" stopColor="#0a0c0f" />
    </linearGradient>
    <linearGradient id="sp-panel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#14171a" stopOpacity="0.92" />
      <stop offset="1" stopColor="#08090a" stopOpacity="0.92" />
    </linearGradient>
    <clipPath id="sp-clip"><circle cx={C.cx} cy={C.cy} r={R} /></clipPath>
    <filter id="sp-blur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="14" /></filter>
    <filter id="sp-nshadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="4" dy="8" stdDeviation="5" floodColor="#000" floodOpacity="0.35" />
    </filter>
  </defs>
));

const wingA = (side, i) => side.from + ((side.to - side.from) * i) / WING.n;
const wingSeg = (side, i) => {
  const a1 = wingA(side, i);
  const a2 = wingA(side, i + 1);
  const g = Math.sign(a2 - a1) * 0.9;
  return a2 > a1 ? band(C.cx, C.cy, WING.r1, WING.r2, a1 + g, a2 - g) : band(C.cx, C.cy, WING.r1, WING.r2, a2 - g, a1 + g);
};

function Panel({ x, flip }) {
  const w = 430;
  const pts = flip
    ? `${x},190 ${x + w - 30},190 ${x + w},226 ${x + w},760 ${x + 30},760 ${x},724`
    : `${x + 30},190 ${x + w},190 ${x + w},724 ${x + w - 30},760 ${x},760 ${x},226`;
  return (
    <g>
      <polygon points={pts} fill="url(#sp-panel)" stroke="#2a2f35" strokeWidth="2" />
      <path d={flip ? `M${x + w - 60} 190H${x + 60}` : `M${x + 60} 190H${x + w - 60}`} stroke="#ff5a00" strokeWidth="5" />
    </g>
  );
}

const ROWS_L = ['TRIP km', 'AVG km/L', 'TIME', 'TOP km/h'];
const ROWS_R = ['WATER °C', 'VOLT', 'MAP kPa', 'IGN °'];

const Back = memo(({ redline }) => {
  const ang = scale(0, CAR.maxRpm, A0, A1);
  const base = { cx: C.cx, cy: C.cy, min: 0, max: CAR.maxRpm, rOuter: RO, ang };
  const notRed = (v) => v < redline;
  const isRed = (v) => v >= redline;
  return (
    <>
      <Defs />
      <rect x="-500" y="-200" width={VB_W + 1000} height={VB_H + 400} fill="url(#sp-carbon)" />
      <rect x="-500" y="-200" width={VB_W + 1000} height={VB_H + 400} fill="url(#sp-vig)" />

      <Panel x={38} />
      <Panel x={1532} flip />
      {ROWS_L.map((l, i) => <text key={l} x={84} y={268 + i * 128} className="sp-plbl">{l}</text>)}
      {ROWS_R.map((l, i) => <text key={l} x={1916} y={268 + i * 128} textAnchor="end" className="sp-plbl">{l}</text>)}

      {/* wings (unlit) */}
      {Array.from({ length: WING.n }, (_, i) => <path key={`l${i}`} d={wingSeg(LEFT, i)} className="sp-seg-off" />)}
      {Array.from({ length: WING.n }, (_, i) => <path key={`r${i}`} d={wingSeg(RIGHT, i)} className="sp-seg-off" />)}
      <text {...(() => { const [x, y] = polar(C.cx, C.cy, 482, LEFT.from - 7); return { x, y }; })()} textAnchor="middle" className="sp-wlbl">C</text>
      <text {...(() => { const [x, y] = polar(C.cx, C.cy, 482, LEFT.to + 7); return { x, y }; })()} textAnchor="middle" className="sp-wlbl">H</text>
      <text {...(() => { const [x, y] = polar(C.cx, C.cy, 482, RIGHT.from + 7); return { x, y }; })()} textAnchor="middle" className="sp-wlbl">0</text>
      <text {...(() => { const [x, y] = polar(C.cx, C.cy, 482, RIGHT.to - 7); return { x, y }; })()} textAnchor="middle" className="sp-wlbl">%</text>
      <text x={612} y={846} textAnchor="middle" className="sp-wname">WATER</text>
      <text x={1388} y={846} textAnchor="middle" className="sp-wname">THROTTLE</text>

      {/* bezel + face */}
      <circle cx={C.cx} cy={C.cy + 14} r={R + 44} fill="#000" opacity="0.9" filter="url(#sp-blur)" />
      <circle cx={C.cx} cy={C.cy} r={R + 42} fill="url(#sp-bezel)" />
      <circle cx={C.cx} cy={C.cy} r={R + 10} fill="none" stroke="url(#sp-chrome)" strokeWidth="8" />
      <circle cx={C.cx} cy={C.cy} r={R + 4} fill="#000" />
      <circle cx={C.cx} cy={C.cy} r={R} fill="url(#sp-face)" />
      {Array.from({ length: LEDS }, (_, i) => {
        const [x, y] = polar(C.cx, C.cy, LED_R, -40 + (80 * i) / (LEDS - 1));
        return <circle key={i} cx={x} cy={y} r="10" className="sp-led-off" />;
      })}

      <g clipPath="url(#sp-clip)">
        <path d={band(C.cx, C.cy, RO - 58, RO + 2, ang(redline), A1 + 1)} fill="#e10600" />
        <path d={tickPath({ ...base, step: 100, len: 16, skip: [500, 1000], filter: notRed })} className="sp-tick minor" />
        <path d={tickPath({ ...base, step: 500, len: 32, skip: [1000], filter: notRed })} className="sp-tick mid" />
        <path d={tickPath({ ...base, step: 1000, len: 54, filter: notRed })} className="sp-tick major" />
        <path d={tickPath({ ...base, step: 100, len: 16, skip: [500, 1000], filter: isRed })} className="sp-tick minor w" />
        <path d={tickPath({ ...base, step: 500, len: 32, skip: [1000], filter: isRed })} className="sp-tick mid w" />
        <path d={tickPath({ ...base, step: 1000, len: 54, filter: isRed })} className="sp-tick major w" />
        {numerals({ cx: C.cx, cy: C.cy, min: 0, max: CAR.maxRpm, step: 1000, r: RO - 112, ang, fmt: (x) => x / 1000, className: 'sp-num', redFrom: redline, redClass: 'sp-num red' })}
        <circle cx={C.cx} cy={C.cy + 8} r={R} fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="40" filter="url(#sp-blur)" />
      </g>
      <text x={C.cx} y={C.cy - 150} textAnchor="middle" className="sp-unit">×1000 r/min</text>

      {/* LCD */}
      <rect x={LCD.x} y={LCD.y} width={LCD.w} height={LCD.h} rx="16" fill="url(#sp-lcd)" stroke="#000" strokeWidth="6" />
      <path d={`M${LCD.x + 92} ${LCD.y + 22}V${LCD.y + LCD.h - 22}`} stroke="#2a3038" strokeWidth="2" />
      <text x={LCD.x + 46} y={LCD.y + 40} textAnchor="middle" className="sp-lcdlbl">GEAR</text>
      <text x={LCD.x + LCD.w - 18} y={LCD.y + LCD.h - 16} textAnchor="end" className="sp-lcdlbl">km/h</text>
    </>
  );
});

function SportNeedle({ frac }) {
  const body = taper(C.cx, C.cy, { tip: RO - 4, wBase: 24, wTip: 6 });
  return (
    <g>
      <g transform="translate(6 11)" opacity="0.25">
        <Needle frac={frac} cx={C.cx} cy={C.cy} a0={A0} a1={A1} stiffness={140} damping={0.76}>
          <polygon points={body} fill="#000" />
        </Needle>
      </g>
      <circle cx={C.cx + 4} cy={C.cy + 8} r="60" fill="#000" opacity="0.3" />
      <Needle frac={frac} cx={C.cx} cy={C.cy} a0={A0} a1={A1} stiffness={140} damping={0.76}>
        <rect x={C.cx - 15} y={C.cy} width="30" height="92" rx="10" fill="#111" />
        <polygon points={body} fill="url(#sp-needle)" />
      </Needle>
      <circle cx={C.cx} cy={C.cy} r="60" fill="url(#sp-cap)" />
      <circle cx={C.cx} cy={C.cy} r="49" fill="none" stroke="#ff5a00" strokeWidth="3" />
    </g>
  );
}

export default function Sport({ d }) {
  const v = d.values;
  const L = lampState(d);
  const rpm = v.rpm ?? 0;
  const { shiftRpm } = d.settings;
  const ledStart = shiftRpm - 2400;
  const lit = Math.max(0, Math.min(LEDS, Math.ceil(((rpm - ledStart) / (shiftRpm - ledStart)) * LEDS)));
  const flash = rpm >= shiftRpm && d.status === 'live';
  const water = v.coolant == null ? 0 : (v.coolant - 50) / 70;
  const thr = (v.throttle ?? 0) / 100;
  const wOn = Math.round(Math.min(1, Math.max(0, water)) * WING.n);
  const tOn = Math.round(Math.min(1, Math.max(0, thr)) * WING.n);
  const valsL = [f1(d.trip.distanceKm), f1(avgKmpl(d.trip)), tripTime(d.trip.movingS), f0(d.trip.maxSpeed)];
  const valsR = [f0(v.coolant), f1(v.voltage), f0(v.map), f1(v.timing)];

  return (
    <ClusterFrame
      className="sport"
      back={<Back redline={d.settings.redline} />}
      live={
        <>
          {Array.from({ length: wOn }, (_, i) => (
            <path key={`l${i}`} d={wingSeg(LEFT, i)} className={`sp-seg ${v.coolant > 105 ? 'hot' : i >= 12 ? 'warm' : 'cool'}`} />
          ))}
          {Array.from({ length: tOn }, (_, i) => <path key={`r${i}`} d={wingSeg(RIGHT, i)} className="sp-seg thr" />)}

          <g className={flash ? 'sp-flash' : ''}>
            {Array.from({ length: LEDS }, (_, i) => {
              if (!flash && i >= lit) return null;
              const [x, y] = polar(C.cx, C.cy, LED_R, -40 + (80 * i) / (LEDS - 1));
              const cls = flash ? 'b' : i < 4 ? 'g' : i < 8 ? 'y' : 'r';
              return <circle key={i} cx={x} cy={y} r="10" className={`sp-led ${cls}`} />;
            })}
          </g>

          {valsL.map((t, i) => <text key={i} x={84} y={334 + i * 128} className="sp-pval">{t}</text>)}
          {valsR.map((t, i) => (
            <text key={i} x={1916} y={334 + i * 128} textAnchor="end"
              className={`sp-pval ${i === 0 && v.coolant > 105 ? 'warn' : ''}`}>{t}</text>
          ))}

          <text x={LCD.x + 46} y={LCD.y + 136} textAnchor="middle" className={`sp-gear ${d.gear === 'N' ? 'n' : ''}`}>{d.gear}</text>
          <text x={LCD.x + LCD.w - 18} y={LCD.y + 118} textAnchor="end" className="sp-speed">{f0(v.speed)}</text>

          <Telltale kind="engine" x={820} y={786} size={40} on={L.engine} color={LAMP.amber} />
          <Telltale kind="battery" x={876} y={786} size={40} on={L.battery} color={LAMP.red} />
          <Telltale kind="temp" x={932} y={786} size={40} on={L.hot || L.cold} color={L.hot ? LAMP.red : LAMP.blue} />
          <Telltale kind="shift" x={C.cx} y={C.cy - 222} size={46} on={L.shift} color={LAMP.green} />
          <Telltale kind="link" x={1916 - 24} y={128} size={36} on={L.link} color={LAMP.blue} />

          <SportNeedle frac={rpm / CAR.maxRpm} />
        </>
      }
    />
  );
}
