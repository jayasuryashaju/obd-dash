// ELM327 protocol: init sequence, supported-PID discovery and polling loop.
// The actual Bluetooth link is a pluggable transport (see transports.js).

import { PIDS, decodeSupported, extractBytes } from './pids.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export class Elm327 {
  constructor(transport, { onData, onStatus, onLog }) {
    this.t = transport;
    this.onData = onData;
    this.onStatus = onStatus;
    this.onLog = onLog;
    this.buffer = '';
    this.pending = null;
    this.running = false;
    this.supported = null;
    this.dead = new Map(); // pid -> consecutive NO DATA count
  }

  async connect() {
    this.onStatus('connecting');
    this.t.onData((s) => this.#onChunk(s));
    this.t.onClose(() => {
      if (!this.running && this.closing) return;
      this.running = false;
      this.onStatus('disconnected');
      this.onLog('Adapter disconnected');
    });
    await this.t.open(this.onLog);
    this.onLog(`Connected to ${this.t.label}`);

    this.onStatus('initialising');
    await this.#init();
    this.onStatus('live');
    this.#loop();
  }

  #onChunk(str) {
    this.buffer += str;
    const end = this.buffer.indexOf('>');
    if (end !== -1 && this.pending) {
      const reply = this.buffer.slice(0, end).trim();
      this.buffer = this.buffer.slice(end + 1);
      const p = this.pending;
      this.pending = null;
      clearTimeout(p.timer);
      p.resolve(reply);
    }
  }

  send(cmd, timeout = 1500) {
    return new Promise((resolve, reject) => {
      this.buffer = '';
      const timer = setTimeout(() => {
        this.pending = null;
        reject(new Error(`Timeout: ${cmd}`));
      }, timeout);
      this.pending = { resolve, timer };
      this.t.write(cmd + '\r').catch((e) => {
        clearTimeout(timer);
        this.pending = null;
        reject(e);
      });
    });
  }

  async #init() {
    const steps = [
      ['ATZ', 3000], // reset
      ['ATE0'],      // echo off
      ['ATL0'],      // linefeeds off
      ['ATS0'],      // spaces off
      ['ATH0'],      // headers off
      ['ATAT1'],     // adaptive timing
      ['ATSP0'],     // auto protocol (WagonR 2016 → ISO 15765-4 CAN)
    ];
    for (const [cmd, t] of steps) {
      try {
        const r = await this.send(cmd, t);
        this.onLog(`${cmd} → ${r.replace(/\s+/g, ' ').slice(0, 40)}`);
      } catch (e) {
        this.onLog(`${cmd} failed: ${e.message}`);
      }
      await wait(60);
    }

    // First real request makes the ELM search for the protocol – allow time.
    this.supported = new Set();
    for (const base of [0x00, 0x20, 0x40]) {
      const pid = base.toString(16).toUpperCase().padStart(2, '0');
      try {
        const r = await this.send('01' + pid, 8000);
        const bytes = extractBytes(r, pid, 4);
        if (!bytes) {
          if (base === 0) this.onLog(`0100 → ${r.replace(/\s+/g, ' ').slice(0, 40)}`);
          break;
        }
        decodeSupported(base, bytes.map((b) => b.toString(16))).forEach((p) => this.supported.add(p));
      } catch (e) {
        this.onLog(`01${pid}: ${e.message}`);
        break;
      }
    }
    if (this.supported.size === 0) {
      this.onLog('Could not read supported PIDs – polling everything');
      this.supported = null;
    } else {
      this.onLog(`ECU supports ${this.supported.size} PIDs`);
      const has = (p) => this.supported.has(p);
      this.onLog(`Fuel: rate 5E ${has('5E') ? 'YES' : 'no'} · MAF 10 ${has('10') ? 'YES' : 'no'} · MAP 0B ${has('0B') ? 'YES' : 'no'} · level 2F ${has('2F') ? 'YES' : 'no'}`);
      this.onLog(has('5E') ? 'Using ECU fuel rate (exact)' : has('10') ? 'Using MAF for fuel' : 'Fuel is estimated from MAP – calibrate with a fill-up');
    }
    try {
      this.onLog(`Protocol ${await this.send('ATDPN')}`);
    } catch { /* ignore */ }
  }

  async #loop() {
    this.running = true;
    let tick = 0;
    const keys = Object.keys(PIDS).filter((k) => !this.supported || this.supported.has(PIDS[k].pid));
    while (this.running) {
      const t0 = performance.now();
      for (const key of keys) {
        if (!this.running) return;
        const def = PIDS[key];
        if (tick % def.every !== 0) continue;
        if ((this.dead.get(key) || 0) > 5) continue;
        try {
          const r = await this.send('01' + def.pid, 1000);
          const bytes = extractBytes(r, def.pid, def.bytes);
          if (bytes) {
            this.dead.set(key, 0);
            this.onData({ [key]: def.parse(...bytes) });
          } else if (/NO DATA|\?/.test(r)) {
            this.dead.set(key, (this.dead.get(key) || 0) + 1);
          }
        } catch (e) {
          if (!this.running) return;
          this.onLog(e.message);
        }
      }
      if (tick % 20 === 0) {
        try {
          const v = parseFloat((await this.send('ATRV')).replace(/[^\d.]/g, ''));
          if (!Number.isNaN(v)) this.onData({ voltage: v });
        } catch { /* ignore */ }
      }
      tick++;
      const dt = performance.now() - t0;
      if (dt < 40) await wait(40 - dt);
    }
  }

  disconnect() {
    this.running = false;
    this.closing = true;
    this.t.close();
  }
}
