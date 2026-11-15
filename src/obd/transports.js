// Byte pipes to an ELM327 adapter. Each transport exposes the same API:
//   open() · write(string) · onData(cb(string)) · onClose(cb) · close()
//
//   WebBleTransport     – Chrome on Android/desktop, BLE adapters (no install)
//   NativeBleTransport  – Android app (Capacitor), BLE adapters
//   ClassicTransport    – Android app (Capacitor), classic Bluetooth SPP adapters

import { Capacitor, registerPlugin } from '@capacitor/core';
import { BleClient } from '@capacitor-community/bluetooth-le';

export const isNative = () => Capacitor.isNativePlatform();
const ClassicBt = registerPlugin('ClassicBt');

// GATT layouts used by common BLE OBD dongles: [service, notify char, write char]
const KNOWN = [
  ['0000fff0-0000-1000-8000-00805f9b34fb', '0000fff1-0000-1000-8000-00805f9b34fb', '0000fff2-0000-1000-8000-00805f9b34fb'],
  ['0000ffe0-0000-1000-8000-00805f9b34fb', '0000ffe1-0000-1000-8000-00805f9b34fb', '0000ffe1-0000-1000-8000-00805f9b34fb'],
  ['000018f0-0000-1000-8000-00805f9b34fb', '00002af0-0000-1000-8000-00805f9b34fb', '00002af1-0000-1000-8000-00805f9b34fb'],
  ['e7810a71-73ae-499d-8c15-faa9aef0c3f2', 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f', 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f'],
];
const SERVICE_IDS = KNOWN.map((k) => k[0]);

const enc = new TextEncoder();
const dec = new TextDecoder();

class Base {
  dataCb = () => {};
  closeCb = () => {};
  onData(cb) { this.dataCb = cb; }
  onClose(cb) { this.closeCb = cb; }
}

/* ---------------- Web Bluetooth (browser) ---------------- */
export class WebBleTransport extends Base {
  static available() { return typeof navigator !== 'undefined' && !!navigator.bluetooth; }

  async open(log) {
    this.device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: SERVICE_IDS });
    this.label = this.device.name || 'BLE adapter';
    this.device.addEventListener('gattserverdisconnected', () => this.closeCb());
    log(`Connecting to ${this.label}…`);
    const server = await this.device.gatt.connect();
    for (const [svc, n, w] of KNOWN) {
      try {
        const s = await server.getPrimaryService(svc);
        this.rx = await s.getCharacteristic(n);
        this.tx = await s.getCharacteristic(w);
        break;
      } catch { /* try next */ }
    }
    if (!this.rx) {
      for (const s of await server.getPrimaryServices()) {
        const chars = await s.getCharacteristics();
        this.rx = chars.find((c) => c.properties.notify);
        this.tx = chars.find((c) => c.properties.write || c.properties.writeWithoutResponse);
        if (this.rx && this.tx) break;
      }
    }
    if (!this.rx || !this.tx) throw new Error('No ELM327 serial channel found on this device');
    await this.rx.startNotifications();
    this.rx.addEventListener('characteristicvaluechanged', (e) => this.dataCb(dec.decode(e.target.value)));
  }

  async write(str) {
    const data = enc.encode(str);
    for (let i = 0; i < data.length; i += 20) {
      const chunk = data.slice(i, i + 20);
      if (this.tx.properties.writeWithoutResponse) await this.tx.writeValueWithoutResponse(chunk);
      else await this.tx.writeValue(chunk);
    }
  }

  async close() { try { this.device?.gatt?.disconnect(); } catch { /* ignore */ } }
}

/* ---------------- BLE inside the Android app ---------------- */
export class NativeBleTransport extends Base {
  async open(log) {
    await BleClient.initialize({ androidNeverForLocation: true });
    if (!(await BleClient.isEnabled())) throw new Error('Bluetooth is off – turn it on and retry');
    const dev = await BleClient.requestDevice({ optionalServices: SERVICE_IDS });
    this.id = dev.deviceId;
    this.label = dev.name || 'BLE adapter';
    log(`Connecting to ${this.label}…`);
    await BleClient.connect(this.id, () => this.closeCb());

    const services = await BleClient.getServices(this.id);
    const has = (svc, c) => services.find((s) => s.uuid === svc)?.characteristics.some((x) => x.uuid === c);
    let pick = KNOWN.find(([s, n, w]) => has(s, n) && has(s, w));
    if (!pick) {
      for (const s of services) {
        const n = s.characteristics.find((c) => c.properties.notify);
        const w = s.characteristics.find((c) => c.properties.write || c.properties.writeWithoutResponse);
        if (n && w) { pick = [s.uuid, n.uuid, w.uuid]; break; }
      }
    }
    if (!pick) throw new Error('No ELM327 serial channel found on this device');
    [this.svc, this.rxc, this.txc] = pick;
    const txProps = services.find((s) => s.uuid === this.svc).characteristics.find((c) => c.uuid === this.txc).properties;
    this.noResp = !!txProps.writeWithoutResponse;
    await BleClient.startNotifications(this.id, this.svc, this.rxc, (v) => this.dataCb(dec.decode(v)));
  }

  async write(str) {
    const data = enc.encode(str);
    for (let i = 0; i < data.length; i += 20) {
      const chunk = new DataView(data.slice(i, i + 20).buffer);
      if (this.noResp) await BleClient.writeWithoutResponse(this.id, this.svc, this.txc, chunk);
      else await BleClient.write(this.id, this.svc, this.txc, chunk);
    }
  }

  async close() { try { await BleClient.disconnect(this.id); } catch { /* ignore */ } }
}

/* ---------------- Classic Bluetooth (SPP) inside the Android app ---------------- */
export class ClassicTransport extends Base {
  /** Devices already paired in Android Bluetooth settings. */
  static async listPaired() {
    const { devices } = await ClassicBt.listPaired();
    return devices;
  }

  constructor(device) {
    super();
    this.device = device;
    this.label = device.name || device.address;
  }

  async open(log) {
    log(`Connecting to ${this.label} (${this.device.address})…`);
    this.subs = [
      await ClassicBt.addListener('data', ({ value }) => this.dataCb(value)),
      await ClassicBt.addListener('disconnected', () => this.closeCb()),
    ];
    await ClassicBt.connect({ address: this.device.address });
  }

  write(str) { return ClassicBt.write({ value: str }); }

  async close() {
    this.subs?.forEach((s) => s.remove());
    try { await ClassicBt.disconnect(); } catch { /* ignore */ }
  }
}
