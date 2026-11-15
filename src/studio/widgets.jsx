// Studio widgets: blade gauge, vertical bar, horizontal blade bar, wide arc
// and big readout. Colours come from CSS variables set by the theme; the
// blade artwork comes from the theme's `shape`.
import { memo, useMemo } from 'react';
import { band, useSegments } from '../cluster/kit.jsx';
import { SENSORS, readSensor } from './sensors.js';

const A0 = -135;
const A1 = 135;
const rad = (a) => (a * Math.PI) / 180;
const P = (r, a) => `${(r * Math.sin(rad(a))).toFixed(2)} ${(-r * Math.cos(rad(a))).toFixed(2)}`;
const poly = (pts) => `M${pts.join('L')}Z`;
const segCls = (i, on) => (on ? 'bl on' : 'bl');

/** Path data for every blade of a round gauge, by artwork style. */
export function bladePaths(shape, r, n) {
  const r1 = r * 0.7;
  const r2 = r * 0.9;
  const rm = (r1 + r2) / 2;
  const step = (A1 - A0) / n;
  const w = step * 0.55;
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = A0 + step * (i + 0.5);
    switch (shape) {
      case 'slant': {
        const k = w * 1.3;
        out.push(poly([P(r1, a - w / 2), P(r2, a - w / 2 + k), P(r2, a + w / 2 + k), P(r1, a + w / 2)]));
        break;
      }
      case 'chevron': {
        const t = w * 0.75;
        out.push(poly([P(r1, a - w / 2), P(rm, a + w / 2), P(r2, a - w / 2), P(r2, a - w / 2 + t), P(rm, a + w / 2 + t), P(r1, a - w / 2 + t)]));
        break;
      }
      case 'knife':
        out.push(poly([P(r1 + (r2 - r1) * 0.1, a), P(r2, a - w * 0.22), P(r2, a + w * 0.22)]));
        break;
      case 'double': {
        const g = (r2 - r1) * 0.08;
        const ra = r1 + (r2 - r1) * 0.46;
        out.push(`${band(0, 0, r1, ra - g, a - w / 2, a + w / 2)}${band(0, 0, ra + g, r2, a - w / 2 + w * 0.15, a + w / 2 + w * 0.15)}`);
        break;
      }
      default:
        out.push(band(0, 0, r1, r2, a - w / 2, a + w / 2));
    }
  }
  return out;
}

function Blades({ r, shape, frac, n }) {
  const paths = useMemo(() => bladePaths(shape, r, n), [shape, r, n]);
  const refs = useSegments(frac, n, segCls, { stiffness: 110, damping: 0.82 });
  return paths.map((d, i) => <path key={i} ref={(el) => { refs.current[i] = el; }} d={d} className="bl" />);
}

const GaugeFace = memo(function GaugeFace({ r, sensor, big }) {
  const s = SENSORS[sensor];
  let ticks = '';
  const nt = big ? 36 : 16;
  for (let i = 0; i <= nt; i++) {
    const a = A0 + ((A1 - A0) * i) / nt;
    const major = i % (big ? 4 : 4) === 0;
    ticks += `M${P(r * (major ? 0.56 : 0.59), a)}L${P(r * 0.63, a)}`;
  }
  const nums = [];
  if (big && s.ticks) {
    for (let i = 0; i <= s.ticks; i++) {
      const v = s.min + ((s.max - s.min) * i) / s.ticks;
      const a = A0 + ((A1 - A0) * i) / s.ticks;
      const [x, y] = P(r * 0.47, a).split(' ').map(Number);
      nums.push(<text key={i} x={x} y={y} dy="0.35em" textAnchor="middle" className="g-num" style={{ fontSize: r * 0.075 }}>{Math.round(v / s.tickDiv)}</text>);
    }
  }
  return (
    <g>
      <circle r={r} className="g-glow" style={{ strokeWidth: r * 0.07 }} />
      <circle r={r} className="g-ring" style={{ strokeWidth: Math.max(2.5, r * 0.012) }} />
      <circle r={r * 0.66} className="g-face" />
      <path d={ticks} className="g-tick" style={{ strokeWidth: Math.max(1.5, r * 0.01) }} />
      {nums}
    </g>
  );
});

/** Round blade gauge centred at (x,y). */
export function Gauge({ x, y, r, sensor, d, shape, edit, onEdit, preview, big }) {
  const n = r > 260 ? 40 : r > 150 ? 30 : 22;
  const { s, frac, text } = preview || readSensor(sensor, d);
  const fs = r * (text.length > 4 ? 1.35 / text.length : 0.34);
  const label = s.unit ? `${s.label} ${s.unit}` : s.label;
  return (
    <g transform={`translate(${x} ${y})`}>
      <GaugeFace r={r} sensor={sensor} big={big} />
      <Blades r={r} shape={shape} frac={frac} n={n} />
      <text y={r * (big ? 0.1 : 0.12)} textAnchor="middle" className="g-val" style={{ fontSize: big ? r * 0.3 : fs }}>{text}</text>
      <text y={r * (big ? 0.28 : 0.33)} textAnchor="middle" className="g-lbl" style={{ fontSize: Math.max(13, r * 0.085) }}>{label}</text>
      <path d={`M${-r * 0.05} ${r * 0.44}L${r * 0.05} ${r * 0.44}L0 ${r * 0.5}Z`} className="g-mark" />
      {edit && <circle r={r * 1.03} className="edit-hit" onClick={onEdit} />}
    </g>
  );
}

/** Vertical segmented bar: (x,y) = top-left. */
export function Bar({ x, y, w, h, sensor, d, edit, onEdit }) {
  const { s, frac, text } = readSensor(sensor, d);
  const n = 12;
  const gap = h * 0.012;
  const sh = (h - gap * (n - 1)) / n;
  const refs = useSegments(frac, n, segCls, { stiffness: 90, damping: 0.85 });
  return (
    <g>
      <text x={x + w / 2} y={y - 14} textAnchor="middle" className="r-val" style={{ fontSize: 30 }}>{text}</text>
      {Array.from({ length: n }, (_, i) => (
        <rect key={i} ref={(el) => { refs.current[i] = el; }} x={x} y={y + h - (i + 1) * sh - i * gap} width={w} height={sh} rx="2" className="bl" />
      ))}
      <text x={x + w / 2} y={y + h + 30} textAnchor="middle" className="b-lbl">{s.label.split(' ')[0]}</text>
      {edit && <rect x={x - 14} y={y - 50} width={w + 28} height={h + 96} rx="10" className="edit-hit" onClick={onEdit} />}
    </g>
  );
}

/** Horizontal blade bar with scale: (x,y) = top-left. */
export function HBar({ x, y, w, h, sensor, d, edit, onEdit }) {
  const { s, frac } = readSensor(sensor, d);
  const n = 56;
  const step = w / n;
  const refs = useSegments(frac, n, segCls, { stiffness: 150, damping: 0.85 });
  const nums = [];
  if (s.ticks) {
    for (let i = 0; i <= s.ticks; i++) {
      nums.push(<text key={i} x={x + (w * i) / s.ticks} y={y + h + 40} textAnchor="middle" className="g-num bgn" style={{ fontSize: 28 }}>
        {Math.round((s.min + ((s.max - s.min) * i) / s.ticks) / s.tickDiv)}</text>);
    }
  }
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const x0 = x + i * step;
        const k = h * 0.25;
        return <path key={i} ref={(el) => { refs.current[i] = el; }} className="bl"
          d={`M${x0 + k} ${y}L${x0 + step * 0.7 + k} ${y}L${x0 + step * 0.7} ${y + h}L${x0} ${y + h}Z`} />;
      })}
      {nums}
      {edit && <rect x={x - 10} y={y - 10} width={w + 20} height={h + 60} rx="10" className="edit-hit" onClick={onEdit} />}
    </g>
  );
}

/** Wide arc sweeping across the screen (Horizon layout). */
export function Arc({ sensor, d, edit, onEdit }) {
  const { s, frac } = readSensor(sensor, d);
  const C = { x: 1000, y: 1480 };
  const R1 = 1312;
  const R2 = 1372;
  const a0 = -37;
  const a1 = 37;
  const n = 64;
  const st = (a1 - a0) / n;
  const refs = useSegments(frac, n, segCls, { stiffness: 140, damping: 0.82 });
  const nums = [];
  if (s.ticks) {
    for (let i = 0; i <= s.ticks; i++) {
      const a = a0 + ((a1 - a0) * i) / s.ticks;
      nums.push(<text key={i} x={C.x + (R1 - 44) * Math.sin(rad(a))} y={C.y - (R1 - 44) * Math.cos(rad(a))} dy="0.35em"
        textAnchor="middle" className="g-num bgn" style={{ fontSize: 30 }}>{Math.round((s.min + ((s.max - s.min) * i) / s.ticks) / s.tickDiv)}</text>);
    }
  }
  return (
    <g>
      <path d={band(C.x, C.y, R2 + 14, R2 + 18, a0, a1)} className="g-ringfill" />
      {Array.from({ length: n }, (_, i) => (
        <path key={i} ref={(el) => { refs.current[i] = el; }} className="bl"
          d={band(C.x, C.y, R1, R2, a0 + st * i + st * 0.14, a0 + st * (i + 1) - st * 0.14)} />
      ))}
      {nums}
      {edit && <path d={band(C.x, C.y, R1 - 70, R2 + 30, a0 - 1, a1 + 1)} className="edit-hit" onClick={onEdit} />}
    </g>
  );
}

/** Big number with label – (x,y) is the value baseline centre. */
export function Readout({ x, y, size, sensor, d, edit, onEdit }) {
  const { s, text } = readSensor(sensor, d);
  return (
    <g>
      <text x={x} y={y - size * 0.82} textAnchor="middle" className="r-lbl" style={{ fontSize: Math.max(16, size * 0.16) }}>{s.label}</text>
      <text x={x} y={y} textAnchor="middle" className="r-val" style={{ fontSize: size }}>{text}</text>
      {s.unit && <text x={x} y={y + size * 0.3} textAnchor="middle" className="r-unit" style={{ fontSize: Math.max(15, size * 0.15) }}>{s.unit}</text>}
      {edit && <rect x={x - size * 0.9} y={y - size * 1.05} width={size * 1.8} height={size * 1.45} rx="12" className="edit-hit" onClick={onEdit} />}
    </g>
  );
}
