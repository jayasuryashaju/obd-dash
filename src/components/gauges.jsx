// Shared drawing primitives used by the dashboards.

export const fmt = (v, d = 0) => (v == null || Number.isNaN(v) ? '--' : Number(v).toFixed(d));
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const pt = (r, deg, c = 100) => {
  const a = (deg * Math.PI) / 180;
  return [c + r * Math.sin(a), c - r * Math.cos(a)];
};

export function arcPath(r, a1, a2, c = 100) {
  const [x1, y1] = pt(r, a1, c);
  const [x2, y2] = pt(r, a2, c);
  const large = Math.abs(a2 - a1) > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

/**
 * Generic analog dial. Styling comes from CSS using the className prefix.
 * Angles: 0° = 12 o'clock, clockwise positive.
 */
export function AnalogGauge({
  value = 0, min = 0, max = 100, major = 10, minor = 5,
  labelDiv = 1, redFrom = null, start = -135, sweep = 270,
  className = '', children, needleLen = 78,
}) {
  const ang = (v) => start + ((clamp(v, min, max) - min) / (max - min)) * sweep;
  const ticks = [];
  const steps = Math.round((max - min) / (major / minor));
  for (let i = 0; i <= steps; i++) {
    const v = min + (i * major) / minor;
    const isMajor = i % minor === 0;
    const a = ang(v);
    const [x1, y1] = pt(isMajor ? 80 : 85, a);
    const [x2, y2] = pt(92, a);
    const red = redFrom != null && v >= redFrom;
    ticks.push(
      <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
        className={`g-tick ${isMajor ? 'major' : 'minor'} ${red ? 'red' : ''}`} />,
    );
    if (isMajor) {
      const [lx, ly] = pt(66, a);
      ticks.push(
        <text key={`l${i}`} x={lx} y={ly} className={`g-label ${red ? 'red' : ''}`}
          textAnchor="middle" dominantBaseline="central">{Math.round(v / labelDiv)}</text>,
      );
    }
  }
  return (
    <svg viewBox="0 0 200 200" className={`gauge ${className}`}>
      <circle cx="100" cy="100" r="98" className="g-face" />
      <path d={arcPath(92, start, start + sweep)} className="g-track" />
      {redFrom != null && <path d={arcPath(89, ang(redFrom), start + sweep)} className="g-red" />}
      <path d={arcPath(95, start, ang(value))} className="g-progress" />
      {ticks}
      <foreignObject x="40" y="105" width="120" height="70">
        <div className="g-center">{children}</div>
      </foreignObject>
      <g className="g-needle" style={{ transform: `rotate(${ang(value)}deg)` }}>
        <polygon points={`98,${100 + 14} 102,${100 + 14} 100.6,${100 - needleLen} 99.4,${100 - needleLen}`} />
      </g>
      <circle cx="100" cy="100" r="7" className="g-hub" />
    </svg>
  );
}

export function Sparkline({ data = [], min, max, className = '' }) {
  if (data.length < 2) return <svg className={`spark ${className}`} viewBox="0 0 100 30" preserveAspectRatio="none" />;
  const lo = min ?? Math.min(...data);
  const hi = max ?? Math.max(...data);
  const span = hi - lo || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${28 - ((v - lo) / span) * 26}`).join(' ');
  return (
    <svg className={`spark ${className}`} viewBox="0 0 100 30" preserveAspectRatio="none">
      <polyline points={`0,30 ${pts} 100,30`} className="spark-fill" />
      <polyline points={pts} className="spark-line" />
    </svg>
  );
}

/** Horizontal or vertical bar, 0..1 */
export function Bar({ frac, vertical = false, className = '' }) {
  const f = clamp(frac || 0, 0, 1) * 100;
  return (
    <div className={`bar ${vertical ? 'v' : 'h'} ${className}`}>
      <div className="bar-fill" style={vertical ? { height: `${f}%` } : { width: `${f}%` }} />
    </div>
  );
}

export const tripTime = (ms) => {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${String(m).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`;
};
