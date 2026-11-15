import { Sparkline, fmt } from '../components/gauges.jsx';
import './data.css';

const TILES = [
  { key: 'rpm', label: 'Engine speed', unit: 'rpm', d: 0, min: 0 },
  { key: 'speed', label: 'Vehicle speed', unit: 'km/h', d: 0, min: 0 },
  { key: 'throttle', label: 'Throttle', unit: '%', d: 0, min: 0, max: 100 },
  { key: 'load', label: 'Engine load', unit: '%', d: 0, min: 0, max: 100 },
  { key: 'map', label: 'Manifold pressure', unit: 'kPa', d: 0 },
  { key: 'timing', label: 'Ignition advance', unit: '°', d: 1 },
  { key: 'coolant', label: 'Coolant temp', unit: '°C', d: 0, warn: (v) => v > 105 },
  { key: 'iat', label: 'Intake air temp', unit: '°C', d: 0 },
  { key: 'stft', label: 'Short fuel trim', unit: '%', d: 1, warn: (v) => Math.abs(v) > 15 },
  { key: 'voltage', label: 'Battery', unit: 'V', d: 2, warn: (v) => v < 11.8 || v > 15 },
  { key: 'kmpl', label: 'Instant economy', unit: 'km/L', d: 1, derived: true },
];

export default function Data({ d }) {
  return (
    <div className="dash data">
      <header className="dt-head">
        <span>Live sensor data</span>
        <span>Gear {d.gear} · LTFT {fmt(d.values.ltft, 1)}% · Fuel {fmt(d.fuelLph, 2)} L/h</span>
      </header>
      <div className="dt-grid">
        {TILES.map((t) => {
          const val = t.derived ? d[t.key] : d.values[t.key];
          const hist = d.history[t.key] || [];
          const bad = val != null && t.warn?.(val);
          return (
            <div key={t.key} className={`dt-tile ${bad ? 'warn' : ''} ${val == null ? 'na' : ''}`}>
              <label>{t.label}</label>
              <div className="dt-val">
                <b>{t.key === 'kmpl' && val > 50 ? '50+' : fmt(val, t.d)}</b>
                <span>{t.unit}</span>
              </div>
              <Sparkline data={hist} min={t.min} max={t.max} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
