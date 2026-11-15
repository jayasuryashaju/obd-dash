// Studio layouts on the shared 2000×900 canvas. Content lives between the
// header (y≈0–90) and the toolbar (y≈812–888). Every slot has a default
// sensor that the user can swap in Edit mode.
//   t: gauge {x,y,r,big?} · bar {x,y,w,h} · hbar {x,y,w,h} · arc {} · readout {x,y,size}

const g = (x, y, r, s, big) => ({ t: 'gauge', x, y, r, s, big });

export const LAYOUTS = {
  /* ---------------- complete layouts ---------------- */
  apex: {
    name: 'Apex', group: 'complete', desc: 'Huge rev counter rising from the edge',
    slots: [
      g(1000, 520, 360, 'rpm', true),
      g(400, 360, 190, 'speed'),
      g(270, 690, 62, 'voltage'), g(400, 712, 62, 'coolant'), g(530, 690, 62, 'iat'),
      { t: 'readout', x: 1560, y: 250, size: 74, s: 'boost' },
      { t: 'bar', x: 1436, y: 330, w: 40, h: 190, s: 'throttle' },
      { t: 'bar', x: 1556, y: 330, w: 40, h: 190, s: 'load' },
      { t: 'bar', x: 1676, y: 330, w: 40, h: 190, s: 'kmpl' },
      g(1470, 690, 62, 'timing'), g(1600, 712, 62, 'map'), g(1730, 690, 62, 'stft'),
    ],
  },
  horizon: {
    name: 'Horizon', group: 'complete', desc: 'Full-width rev arc over a giant speed',
    slots: [
      { t: 'arc', s: 'rpm' },
      { t: 'readout', x: 1000, y: 560, size: 230, s: 'speed' },
      g(300, 610, 110, 'coolant'), g(600, 640, 90, 'gear'),
      g(1400, 640, 90, 'kmpl'), g(1700, 610, 110, 'voltage'),
    ],
  },
  cockpit: {
    name: 'Cockpit', group: 'complete', desc: 'Twin dials, centre data stack',
    slots: [
      g(530, 450, 330, 'rpm', true),
      g(1470, 450, 330, 'speed', true),
      { t: 'readout', x: 1000, y: 330, size: 150, s: 'gear' },
      { t: 'readout', x: 1000, y: 540, size: 64, s: 'coolant' },
      { t: 'readout', x: 1000, y: 710, size: 64, s: 'kmpl' },
    ],
  },
  race: {
    name: 'Race', group: 'complete', desc: 'Shift bar, big gear, side data',
    slots: [
      { t: 'hbar', x: 140, y: 120, w: 1720, h: 78, s: 'rpm' },
      { t: 'readout', x: 1000, y: 620, size: 330, s: 'gear' },
      { t: 'readout', x: 470, y: 470, size: 150, s: 'speed' },
      { t: 'readout', x: 1530, y: 470, size: 120, s: 'rpm' },
      g(330, 690, 82, 'coolant'), g(590, 700, 82, 'throttle'),
      g(1410, 700, 82, 'voltage'), g(1670, 690, 82, 'kmpl'),
    ],
  },
  focus: {
    name: 'Focus', group: 'complete', desc: 'One hero dial, clean sides',
    slots: [
      g(1000, 455, 345, 'speed', true),
      { t: 'readout', x: 380, y: 360, size: 140, s: 'rpm' },
      { t: 'readout', x: 380, y: 650, size: 120, s: 'gear' },
      g(1620, 290, 125, 'coolant'),
      g(1620, 615, 125, 'kmpl'),
    ],
  },

  /* ---------------- build-your-own panels ---------------- */
  five: {
    name: 'Five Dial', group: 'custom', desc: 'Row of five, stepping up to the centre',
    slots: [g(205, 450, 120, 'coolant'), g(545, 450, 180, 'speed'), g(1000, 450, 255, 'rpm', true), g(1455, 450, 180, 'boost'), g(1795, 450, 120, 'voltage')],
  },
  trio: {
    name: 'Trio', group: 'custom', desc: 'Three equal dials',
    slots: [g(400, 450, 265, 'speed', true), g(1000, 450, 265, 'rpm', true), g(1600, 450, 265, 'coolant')],
  },
  duo: {
    name: 'Duo', group: 'custom', desc: 'Two big dials',
    slots: [g(560, 450, 340, 'rpm', true), g(1440, 450, 340, 'speed', true)],
  },
  six: {
    name: 'Six Pack', group: 'custom', desc: '3 × 2 grid',
    slots: [
      g(470, 280, 170, 'rpm'), g(1000, 280, 170, 'speed'), g(1530, 280, 170, 'coolant'),
      g(470, 635, 170, 'throttle'), g(1000, 635, 170, 'voltage'), g(1530, 635, 170, 'kmpl'),
    ],
  },
  eight: {
    name: 'Eight', group: 'custom', desc: '4 × 2 grid',
    slots: [
      g(310, 285, 160, 'rpm'), g(770, 285, 160, 'speed'), g(1230, 285, 160, 'coolant'), g(1690, 285, 160, 'iat'),
      g(310, 635, 160, 'throttle'), g(770, 635, 160, 'load'), g(1230, 635, 160, 'voltage'), g(1690, 635, 160, 'kmpl'),
    ],
  },
  full: {
    name: 'Full House', group: 'custom', desc: 'Two hero dials + twelve small',
    slots: [
      g(150, 220, 100, 'boost'), g(380, 220, 100, 'gear'),
      g(150, 450, 100, 'map'), g(380, 450, 100, 'throttle'),
      g(150, 680, 100, 'timing'), g(380, 680, 100, 'load'),
      g(775, 440, 235, 'rpm', true), g(1225, 440, 235, 'speed', true),
      g(1620, 220, 100, 'coolant'), g(1850, 220, 100, 'iat'),
      g(1620, 450, 100, 'voltage'), g(1850, 450, 100, 'kmpl'),
      g(1620, 680, 100, 'fuelRate'), g(1850, 680, 100, 'stft'),
    ],
  },
};

export const LAYOUT_IDS = Object.keys(LAYOUTS);
