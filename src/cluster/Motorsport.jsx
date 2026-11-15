// "Motorsport" – race-car data display: housed LCD with shift-light strip,
// full-width block rev bar, giant gear, speed/rpm/trip panes and six
// channel boxes that flip to red when a value goes out of range.
import { memo } from 'react';
import { CAR } from '../car.js';
import { VB_W, VB_H, useSegments, Telltale, LAMP, lampState, f0, f1, tripTime, avgKmpl, ClusterFrame } from './kit.jsx';
import './motorsport.css';

const BAR = { x: 92, y: 158, w: 1816, h: 84, n: 56 };
const LED_N = 15;
const segW = BAR.w / BAR.n;

const CH = [
  { key: 'coolant', label: 'WATER', unit: '°C', d: 0, alarm: (v) => v > 105 },
  { key: 'iat', label: 'INTAKE', unit: '°C', d: 0, alarm: (v) => v > 60 },
  { key: 'voltage', label: 'BATTERY', unit: 'V', d: 1, alarm: (v) => v < 12 || v > 15.3 },
  { key: 'map', label: 'MAP', unit: 'kPa', d: 0 },
  { key: 'throttle', label: 'THROTTLE', unit: '%', d: 0 },
  { key: 'timing', label: 'IGNITION', unit: '°', d: 1 },
];
const CW = 290;
const CG = 15.2;

function Pane({ x, y, w, h, label }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} className="ms-box" />
      <text x={x + 18} y={y + 36} className="ms-lbl">{label}</text>
    </g>
  );
}

const Back = memo(({ redline }) => (
  <>
    <defs>
      <linearGradient id="ms-housing" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#26282b" />
        <stop offset="1" stopColor="#0c0d0e" />
      </linearGradient>
      <pattern id="ms-grid" width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill="#030303" />
        <rect width="1" height="8" fill="#0a0a0a" />
      </pattern>
    </defs>
    <rect x="-500" y="-200" width={VB_W + 1000} height={VB_H + 400} fill="#000" />
    <rect x="14" y="14" width="1972" height="872" rx="46" fill="url(#ms-housing)" stroke="#000" strokeWidth="4" />
    <rect x="52" y="52" width="1896" height="796" rx="18" fill="url(#ms-grid)" stroke="#000" strokeWidth="6" />
    {/* LED housings */}
    {Array.from({ length: LED_N }, (_, i) => (
      <circle key={i} cx={460 + i * 77} cy={98} r="22" className="ms-led-off" />
    ))}
    {/* rev bar frame + scale */}
    <rect x={BAR.x - 6} y={BAR.y - 6} width={BAR.w + 12} height={BAR.h + 12} fill="none" stroke="#2a2a2a" strokeWidth="2" />
    {Array.from({ length: CAR.maxRpm / 1000 + 1 }, (_, i) => {
      const x = BAR.x + (i * 1000 / CAR.maxRpm) * BAR.w;
      return (
        <g key={i}>
          <line x1={x} y1={BAR.y + BAR.h + 8} x2={x} y2={BAR.y + BAR.h + 22} className={`ms-scale ${i * 1000 >= redline ? 'red' : ''}`} />
          <text x={Math.min(Math.max(x, BAR.x + 14), BAR.x + BAR.w - 14)} y={BAR.y + BAR.h + 52} textAnchor="middle"
            className={`ms-scalet ${i * 1000 >= redline ? 'red' : ''}`}>{i}</text>
        </g>
      );
    })}
    <Pane x={92} y={318} w={668} h={178} label="SPEED  km/h" />
    <Pane x={92} y={512} w={668} h={178} label="ENGINE  rpm" />
    <rect x={782} y={318} width={436} height={372} className="ms-box gear" />
    <text x={800} y={354} className="ms-lbl">GEAR</text>
    <Pane x={1240} y={318} w={668} h={178} label="DRIVE TIME" />
    <Pane x={1240} y={512} w={668} h={178} label="ECONOMY  km/L" />
  </>
));

function RevBar({ rpm, redline, shiftRpm }) {
  const redIdx = Math.floor((redline / CAR.maxRpm) * BAR.n);
  const shiftIdx = Math.floor((shiftRpm / CAR.maxRpm) * BAR.n);
  const cls = (i, on) => `ms-seg ${on ? 'on' : ''} ${i >= redIdx ? 'r' : i >= shiftIdx - 6 ? 'y' : 'g'}`;
  const refs = useSegments(rpm / CAR.maxRpm, BAR.n, cls, { stiffness: 160, damping: 0.85, sweep: true });
  return (
    <g>
      {Array.from({ length: BAR.n }, (_, i) => (
        <rect key={i} ref={(el) => { refs.current[i] = el; }} x={BAR.x + i * segW + 2} y={BAR.y}
          width={segW - 4} height={BAR.h} className={cls(i, false)} />
      ))}
    </g>
  );
}

export default function Motorsport({ d }) {
  const v = d.values;
  const L = lampState(d);
  const rpm = v.rpm ?? 0;
  const { shiftRpm, redline } = d.settings;
  const ledStart = shiftRpm - 2600;
  const lit = Math.max(0, Math.min(LED_N, Math.ceil(((rpm - ledStart) / (shiftRpm - ledStart)) * LED_N)));
  const flash = rpm >= shiftRpm && d.status === 'live';
  const avg = avgKmpl(d.trip);

  return (
    <ClusterFrame
      className="motorsport"
      back={<Back redline={redline} />}
      live={
        <>
          <g className={flash ? 'ms-flash' : ''}>
            {Array.from({ length: LED_N }, (_, i) => {
              if (!flash && i >= lit) return null;
              const cls = flash ? 'b' : i < 5 ? 'g' : i < 10 ? 'y' : 'r';
              return <circle key={i} cx={460 + i * 77} cy={98} r="18" className={`ms-led ${cls}`} />;
            })}
          </g>
          <RevBar rpm={rpm} redline={redline} shiftRpm={shiftRpm} />

          <text x={740} y={476} textAnchor="end" className="ms-big">{f0(v.speed)}</text>
          <text x={740} y={670} textAnchor="end" className="ms-big">{f0(rpm)}</text>
          <text x={1000} y={652} textAnchor="middle" className={`ms-gear ${flash ? 'shift' : ''} ${d.gear === 'N' ? 'n' : ''}`}>{d.gear}</text>
          <text x={1888} y={476} textAnchor="end" className="ms-big">{tripTime(d.trip.movingS)}</text>
          <text x={1260} y={470} className="ms-small">{f1(d.trip.distanceKm)} km</text>
          <text x={1888} y={670} textAnchor="end" className="ms-big">{d.kmpl == null ? '--' : d.kmpl > 50 ? '50+' : f1(d.kmpl)}</text>
          <text x={1260} y={664} className="ms-small">avg {f1(avg)}</text>

          {CH.map((c, i) => {
            const x = 92 + i * (CW + CG);
            const val = v[c.key];
            const alarm = val != null && c.alarm?.(val);
            return (
              <g key={c.key}>
                <rect x={x} y={710} width={CW} height={118} className={`ms-box ch ${alarm ? 'alarm' : ''}`} />
                <text x={x + 16} y={746} className={`ms-lbl ${alarm ? 'alarm' : ''}`}>{c.label}</text>
                <text x={x + CW - 16} y={746} textAnchor="end" className="ms-unit">{c.unit}</text>
                <text x={x + CW - 16} y={812} textAnchor="end" className={`ms-val ${alarm ? 'alarm' : ''}`}>
                  {val == null ? '--' : val.toFixed(c.d)}
                </text>
              </g>
            );
          })}

          <Telltale kind="engine" x={120} y={98} size={42} on={L.engine} color={LAMP.amber} />
          <Telltale kind="battery" x={184} y={98} size={42} on={L.battery} color={LAMP.red} />
          <Telltale kind="temp" x={248} y={98} size={42} on={L.hot || L.cold} color={L.hot ? LAMP.red : LAMP.blue} />
          <Telltale kind="link" x={1880} y={98} size={40} on={L.link} color={LAMP.blue} />
          <Telltale kind="shift" x={1180} y={384} size={46} on={L.shift} color={LAMP.green} />
        </>
      }
    />
  );
}
