// Standard OBD-II Mode 01 PIDs that a 2016 Maruti WagonR VXi (K10B, CAN) is
// likely to answer. Anything the ECU doesn't support is skipped automatically.
// `every` = poll once every N loops (1 = every loop, fastest).

export const PIDS = {
  rpm:      { pid: '0C', bytes: 2, every: 1,  parse: (a, b) => (a * 256 + b) / 4 },
  speed:    { pid: '0D', bytes: 1, every: 1,  parse: (a) => a },
  throttle: { pid: '11', bytes: 1, every: 1,  parse: (a) => (a * 100) / 255 },
  load:     { pid: '04', bytes: 1, every: 3,  parse: (a) => (a * 100) / 255 },
  map:      { pid: '0B', bytes: 1, every: 3,  parse: (a) => a },
  fuelRate: { pid: '5E', bytes: 2, every: 2,  parse: (a, b) => (a * 256 + b) / 20 }, // L/h straight from ECU
  maf:      { pid: '10', bytes: 2, every: 3,  parse: (a, b) => (a * 256 + b) / 100 },
  timing:   { pid: '0E', bytes: 1, every: 5,  parse: (a) => a / 2 - 64 },
  coolant:  { pid: '05', bytes: 1, every: 15, parse: (a) => a - 40 },
  iat:      { pid: '0F', bytes: 1, every: 15, parse: (a) => a - 40 },
  stft:     { pid: '06', bytes: 1, every: 10, parse: (a) => ((a - 128) * 100) / 128 },
  ltft:     { pid: '07', bytes: 1, every: 30, parse: (a) => ((a - 128) * 100) / 128 },
  status01: { pid: '01', bytes: 1, every: 60, parse: (a) => a }, // bit7 = check-engine lamp
  fuel:     { pid: '2F', bytes: 1, every: 60, parse: (a) => (a * 100) / 255 },
};

/** Turn the bitmask replies of 0100 / 0120 / 0140 into a Set of hex PIDs. */
export function decodeSupported(base, hexBytes) {
  const out = new Set();
  const bits = hexBytes
    .map((b) => parseInt(b, 16).toString(2).padStart(8, '0'))
    .join('');
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === '1') out.add((base + i + 1).toString(16).toUpperCase().padStart(2, '0'));
  }
  return out;
}

/**
 * Pull the data bytes for `41 <pid>` out of a raw ELM327 reply.
 * Handles echo, spaces, multiple ECUs and "SEARCHING..." noise.
 */
export function extractBytes(raw, pid, count) {
  const clean = raw.replace(/SEARCHING\.\.\./g, '').replace(/\s+/g, '').toUpperCase();
  const key = '41' + pid;
  const idx = clean.indexOf(key);
  if (idx === -1) return null;
  const hex = clean.slice(idx + key.length, idx + key.length + count * 2);
  if (hex.length < count * 2) return null;
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.slice(i, i + 2), 16));
  return bytes.some(Number.isNaN) ? null : bytes;
}
