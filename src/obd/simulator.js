// Fake WagonR drive cycle so every dashboard can be designed & tested
// without sitting in the car.
import { CAR, KMH_PER_1000 } from '../car.js';

export class Simulator {
  constructor({ onData, onStatus, onLog }) {
    Object.assign(this, { onData, onStatus, onLog });
    this.t = 0;
    this.speed = 0;
    this.gear = 0; // 0 = neutral
    this.coolant = 32;
    this.phase = 'idle';
    this.phaseLeft = 3;
    this.throttle = 0;
  }

  connect() {
    this.onStatus('live');
    this.onLog('Demo mode – simulated WagonR drive');
    let last = performance.now();
    this.timer = setInterval(() => {
      const now = performance.now();
      this.#step(Math.min(0.2, (now - last) / 1000));
      last = now;
    }, 50);
  }

  #nextPhase() {
    const r = Math.random();
    if (this.speed < 5) this.phase = r < 0.75 ? 'accel' : 'idle';
    else if (r < 0.35) this.phase = 'accel';
    else if (r < 0.7) this.phase = 'cruise';
    else if (r < 0.88) this.phase = 'coast';
    else this.phase = 'brake';
    this.phaseLeft = 3 + Math.random() * 7;
    this.target = this.phase === 'accel' ? 55 + Math.random() * 45 : 25 + Math.random() * 15;
  }

  #step(dt) {
    this.t += dt;
    if (this.t < 3) {
      // ignition on, engine not yet cranked: resting battery voltage
      this.onData({ rpm: 0, speed: 0, throttle: 0, voltage: 12.55, coolant: this.coolant, status01: 0 });
      return;
    }
    this.phaseLeft -= dt;
    if (this.phaseLeft <= 0) this.#nextPhase();

    let accel = 0;
    let thr = 0;
    switch (this.phase) {
      case 'accel': thr = this.target; accel = (thr / 100) * (3.2 - this.gear * 0.45); break;
      case 'cruise': thr = 18; accel = (Math.random() - 0.5) * 0.3; break;
      case 'coast': thr = 0; accel = -0.6; break;
      case 'brake': thr = 0; accel = -3.2; break;
      default: thr = 0; accel = -2;
    }
    if (this.speed > 115) accel = Math.min(accel, 0);
    this.throttle += (thr - this.throttle) * Math.min(1, dt * 6);
    this.speed = Math.max(0, this.speed + accel * dt * 3.6);

    // Gearbox logic
    const shiftUp = this.phase === 'accel' ? 3800 + this.throttle * 18 : 2400;
    if (this.speed < 4) this.gear = 0;
    else if (this.gear === 0) this.gear = 1;
    const rpmIn = (g) => (this.speed / KMH_PER_1000[g - 1]) * 1000;
    if (this.gear > 0 && this.gear < 5 && rpmIn(this.gear) > shiftUp) this.gear++;
    if (this.gear > 1 && rpmIn(this.gear) < 1300) this.gear--;

    let rpm = this.gear ? rpmIn(this.gear) : CAR.idleRpm + this.throttle * 40;
    rpm = Math.max(CAR.idleRpm - 20, rpm) + Math.sin(this.t * 13) * 12;

    this.coolant = Math.min(89 + Math.sin(this.t / 20) * 2, this.coolant + dt * 1.1);
    const map = 28 + this.throttle * 0.72 + (rpm < 1000 ? 6 : 0);

    this.onData({
      rpm,
      speed: Math.round(this.speed),
      throttle: this.throttle,
      load: Math.min(100, 18 + this.throttle * 0.8),
      map,
      timing: 8 + (rpm / 1000) * 4 - this.throttle * 0.1,
      coolant: this.coolant,
      iat: 34 + Math.sin(this.t / 30) * 3,
      stft: Math.sin(this.t * 0.7) * 3,
      ltft: 1.6,
      status01: 0,
      voltage: rpm > 600 ? 14.1 + Math.sin(this.t) * 0.08 : 12.4,
    });
  }

  disconnect() {
    clearInterval(this.timer);
    this.onStatus('disconnected');
  }
}
