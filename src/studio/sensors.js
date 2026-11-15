// Everything a Studio gauge can display. `get(d)` reads from the store
// snapshot; min/max define the gauge sweep.
import { CAR } from '../car.js';
import { avgKmpl } from '../cluster/kit.jsx';

const GEARS = { N: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 };

export const SENSORS = {
  rpm:      { label: 'RPM', unit: '', min: 0, max: CAR.maxRpm, dec: 0, ticks: 7, tickDiv: 1000, get: (d) => d.values.rpm },
  speed:    { label: 'SPEED', unit: 'km/h', min: 0, max: CAR.maxSpeed, dec: 0, ticks: 8, tickDiv: 1, get: (d) => d.values.speed },
  gear:     { label: 'GEAR', unit: '', min: 0, max: 5, dec: 0, get: (d) => GEARS[d.gear] ?? 0, text: (d) => d.gear },
  coolant:  { label: 'COOLANT', unit: '°C', min: 40, max: 120, dec: 0, get: (d) => d.values.coolant },
  iat:      { label: 'INTAKE', unit: '°C', min: 0, max: 80, dec: 0, get: (d) => d.values.iat },
  throttle: { label: 'THROTTLE', unit: '%', min: 0, max: 100, dec: 0, get: (d) => d.values.throttle },
  load:     { label: 'ENGINE LOAD', unit: '%', min: 0, max: 100, dec: 0, get: (d) => d.values.load },
  map:      { label: 'MANIFOLD', unit: 'kPa', min: 0, max: 110, dec: 0, get: (d) => d.values.map },
  boost:    { label: 'BOOST', unit: 'bar', min: -1, max: 0.2, dec: 2, get: (d) => (d.values.map == null ? null : (d.values.map - 101.3) / 100) },
  voltage:  { label: 'BATTERY', unit: 'V', min: 10, max: 16, dec: 1, get: (d) => d.values.voltage },
  timing:   { label: 'IGNITION', unit: '°', min: -10, max: 50, dec: 1, get: (d) => d.values.timing },
  stft:     { label: 'SHORT TRIM', unit: '%', min: -25, max: 25, dec: 1, get: (d) => d.values.stft },
  ltft:     { label: 'LONG TRIM', unit: '%', min: -25, max: 25, dec: 1, get: (d) => d.values.ltft },
  kmpl:     { label: 'ECONOMY', unit: 'km/L', min: 0, max: 30, dec: 1, get: (d) => (d.kmpl == null ? null : Math.min(d.kmpl, 50)) },
  fuelRate: { label: 'FUEL RATE', unit: 'L/h', min: 0, max: 8, dec: 1, get: (d) => d.fuelLph },
  avg:      { label: 'TRIP AVG', unit: 'km/L', min: 0, max: 30, dec: 1, get: (d) => avgKmpl(d.trip) },
  trip:     { label: 'TRIP', unit: 'km', min: 0, max: 100, dec: 1, get: (d) => d.trip.distanceKm },
  top:      { label: 'TOP SPEED', unit: 'km/h', min: 0, max: CAR.maxSpeed, dec: 0, get: (d) => d.trip.maxSpeed },
};

export const SENSOR_IDS = Object.keys(SENSORS);

export function readSensor(id, d) {
  const s = SENSORS[id];
  const v = s.get(d);
  const frac = v == null || Number.isNaN(v) ? 0 : (v - s.min) / (s.max - s.min);
  const text = s.text ? s.text(d) : v == null || Number.isNaN(v) ? '--' : v.toFixed(s.dec);
  return { s, v, frac: Math.max(0, Math.min(1, frac)), text };
}
