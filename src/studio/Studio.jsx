// Studio – fully customisable gauge screen: pick a style (6 artworks,
// dark/light), a layout (complete or build-your-own) and, in Edit mode, tap
// any gauge to choose what it shows. Choices persist in settings.
import { memo, useState } from 'react';
import { actions } from '../store.js';
import { clock } from '../cluster/kit.jsx';
import { SENSORS, SENSOR_IDS } from './sensors.js';
import { THEMES, THEME_IDS, themeVars } from './themes.js';
import { LAYOUTS, LAYOUT_IDS } from './layouts.js';
import { Gauge, Bar, HBar, Arc, Readout } from './widgets.jsx';
import { band } from '../cluster/kit.jsx';
import './studio.css';

const DEFAULT = { theme: 'toxic', light: false, layout: 'full', slots: {}, badge: true };
const stop = (e) => e.stopPropagation();

function Widget({ slot, sensor, d, shape, edit, onEdit }) {
  const p = { sensor, d, edit, onEdit };
  switch (slot.t) {
    case 'gauge': return <Gauge {...p} x={slot.x} y={slot.y} r={slot.r} big={slot.big} shape={shape} />;
    case 'bar': return <Bar {...p} x={slot.x} y={slot.y} w={slot.w} h={slot.h} />;
    case 'hbar': return <HBar {...p} x={slot.x} y={slot.y} w={slot.w} h={slot.h} />;
    case 'arc': return <Arc {...p} />;
    case 'readout': return <Readout {...p} x={slot.x} y={slot.y} size={slot.size} />;
    default: return null;
  }
}

const Defs = memo(() => (
  <defs>
    <pattern id="st-carbon" width="14" height="14" patternUnits="userSpaceOnUse">
      <rect width="14" height="14" fill="#0b0c0d" />
      <rect width="7" height="7" fill="#15171a" />
      <rect x="7" y="7" width="7" height="7" fill="#15171a" />
    </pattern>
    <radialGradient id="st-vig" cx="50%" cy="45%" r="70%">
      <stop offset="0.5" stopColor="#000" stopOpacity="0" />
      <stop offset="1" stopColor="#000" stopOpacity="0.35" />
    </radialGradient>
  </defs>
));

const ICON = {
  style: 'M0 -16a16 16 0 1 0 0.1 0M0 0L9 -9',
  layout: 'M-15 -13h12v12h-12zM3 -13h12v12h-12zM-15 3h12v12h-12zM3 3h12v12h-12z',
  edit: 'M-12 12l3 -10 16 -16 7 7 -16 16zM5 -10l7 7',
  done: 'M-13 0l9 9 17 -18',
  menu: 'M-15 -10h30M-15 0h30M-15 10h30',
};

function Toolbar({ edit, setPanel, setEdit, panel }) {
  const items = [
    ['style', 'STYLE', () => setPanel(panel === 'style' ? null : 'style')],
    ['layout', 'LAYOUT', () => setPanel(panel === 'layout' ? null : 'layout')],
    [edit ? 'done' : 'edit', edit ? 'DONE' : 'EDIT', () => { setEdit(!edit); setPanel(null); }],
    ['menu', 'MENU', () => setPanel(panel === 'menu' ? null : 'menu')],
  ];
  const w = 108;
  const x0 = 1000 - (w * items.length) / 2;
  return (
    <g className="st-toolbar" onPointerDown={stop} onPointerUp={stop}>
      <rect x={x0 - 10} y="808" width={w * items.length + 20} height="84" rx="22" className="tb-bg" />
      {items.map(([ic, label, fn], i) => (
        <g key={label} transform={`translate(${x0 + w * i + w / 2} 836)`} className={`tb-btn ${(panel === ic || (ic === 'done')) ? 'on' : ''}`} onClick={fn}>
          <rect x={-w / 2 + 6} y="-26" width={w - 12} height="78" rx="14" className="tb-hit" />
          <path d={ICON[ic]} className="tb-ic" transform="scale(0.85)" />
          <text y="40" textAnchor="middle" className="tb-lbl">{label}</text>
        </g>
      ))}
    </g>
  );
}

/** Schematic thumbnail generated from the layout definition itself. */
const Thumb = memo(function Thumb({ id }) {
  const L = LAYOUTS[id];
  return (
    <svg viewBox="0 0 2000 900" className="thumb">
      {L.slots.map((s, i) => {
        switch (s.t) {
          case 'gauge': return <circle key={i} cx={s.x} cy={s.y} r={s.r} className="th-g" />;
          case 'bar': return <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} className="th-f" />;
          case 'hbar': return <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} className="th-f" />;
          case 'arc': return <path key={i} d={band(1000, 1480, 1312, 1372, -37, 37)} className="th-f" />;
          case 'readout': return <rect key={i} x={s.x - s.size * 0.6} y={s.y - s.size * 0.75} width={s.size * 1.2} height={s.size * 0.8} rx="10" className="th-r" />;
          default: return null;
        }
      })}
    </svg>
  );
});

function Panel({ title, onClose, children, wide }) {
  return (
    <div className={`st-panel ${wide ? 'wide' : ''}`} onPointerDown={stop} onPointerUp={stop}>
      <div className="st-ph"><span>{title}</span><button onClick={onClose}>✕</button></div>
      {children}
    </div>
  );
}

function StylePanel({ cfg, save, close }) {
  return (
    <Panel title="STYLE" onClose={close} wide>
      <div className="seg">
        <button className={!cfg.light ? 'on' : ''} onClick={() => save({ light: false })}>Dark</button>
        <button className={cfg.light ? 'on' : ''} onClick={() => save({ light: true })}>Light</button>
      </div>
      <div className="cards">
        {THEME_IDS.map((id) => (
          <button key={id} className={`card ${cfg.theme === id ? 'sel' : ''}`} style={themeVars(id, cfg.light)}
            onClick={() => save({ theme: id })}>
            <svg viewBox="-118 -118 236 236" className="card-g">
              <Gauge x={0} y={0} r={104} sensor="speed" shape={THEMES[id].shape}
                preview={{ s: SENSORS.speed, frac: 0.7, text: '124' }} />
            </svg>
            <b>{THEMES[id].name}</b>
            <small>{THEMES[id].desc}</small>
          </button>
        ))}
      </div>
    </Panel>
  );
}

function LayoutPanel({ cfg, save, close }) {
  const row = (group) => LAYOUT_IDS.filter((id) => LAYOUTS[id].group === group).map((id) => (
    <button key={id} className={`card lay ${cfg.layout === id ? 'sel' : ''}`} onClick={() => save({ layout: id })}>
      <Thumb id={id} />
      <b>{LAYOUTS[id].name}</b>
      <small>{LAYOUTS[id].desc}</small>
    </button>
  ));
  return (
    <Panel title="LAYOUT" onClose={close} wide>
      <h4>COMPLETE LAYOUTS</h4>
      <div className="cards">{row('complete')}</div>
      <h4>BUILD-YOUR-OWN PANELS</h4>
      <div className="cards">{row('custom')}</div>
    </Panel>
  );
}

function MenuPanel({ cfg, save, close }) {
  return (
    <Panel title="MENU" onClose={close}>
      <div className="menu">
        <button onClick={() => { const slots = { ...cfg.slots }; delete slots[cfg.layout]; save({ slots }); close(); }}>
          Reset “{LAYOUTS[cfg.layout].name}” gauges to default
        </button>
        <button onClick={() => save({ badge: !cfg.badge })}>
          Safety badge: <b>{cfg.badge ? 'On' : 'Off'}</b>
        </button>
        <button onClick={() => { save({ ...DEFAULT }); close(); }}>Reset all Studio settings</button>
        <p>Swipe left/right to switch to the other cluster designs. Tap empty space to show the app controls.</p>
      </div>
    </Panel>
  );
}

function SensorPicker({ current, slotLabel, onPick, close }) {
  return (
    <Panel title={`SHOW ON THIS ${slotLabel}`} onClose={close}>
      <div className="picker">
        {SENSOR_IDS.map((id) => (
          <button key={id} className={id === current ? 'sel' : ''} onClick={() => onPick(id)}>
            {SENSORS[id].label}{SENSORS[id].unit && <small> {SENSORS[id].unit}</small>}
          </button>
        ))}
      </div>
    </Panel>
  );
}

export default function Studio({ d }) {
  const cfg = { ...DEFAULT, ...(d.settings.studio || {}) };
  const [panel, setPanel] = useState(null);
  const [edit, setEdit] = useState(false);
  const [pick, setPick] = useState(null);
  const layout = LAYOUTS[cfg.layout] || LAYOUTS.full;
  const saved = cfg.slots[cfg.layout];
  const sensors = layout.slots.map((s, i) => (saved && SENSORS[saved[i]] ? saved[i] : s.s));
  const shape = THEMES[cfg.theme]?.shape || 'block';
  const save = (patch) => actions.updateSettings({ studio: { ...cfg, ...patch } });
  const setSensor = (i, id) => {
    const arr = [...sensors];
    arr[i] = id;
    save({ slots: { ...cfg.slots, [cfg.layout]: arr } });
    setPick(null);
  };
  const live = d.status === 'live';

  return (
    <div className={`studio ${cfg.light ? 'light' : ''} ${edit ? 'editing' : ''}`} style={themeVars(cfg.theme, cfg.light)}>
      <svg viewBox="0 0 2000 900" preserveAspectRatio="xMidYMid meet" className="st-svg">
        <Defs />
        <rect x="-600" y="-300" width="3200" height="1500" className="st-bg" />
        <rect x="-600" y="-300" width="3200" height="1500" fill="url(#st-vig)" className="st-vigr" />

        {/* header */}
        <circle cx="44" cy="46" r="7" className="hd-dot" />
        <text x="62" y="55" className="hd-brand">WAGONR DASH</text>
        {cfg.badge && (
          <g>
            <rect x="352" y="26" width="330" height="40" rx="8" className="hd-badge" />
            <text x="517" y="53" textAnchor="middle" className="hd-badge-t">PASSENGER / PARKED USE ONLY</text>
          </g>
        )}
        <rect x={cfg.badge ? 698 : 352} y="26" width="96" height="40" rx="8" className={`hd-live ${live ? 'on' : ''}`} />
        <text x={(cfg.badge ? 698 : 352) + 48} y="53" textAnchor="middle" className={`hd-live-t ${live ? 'on' : ''}`}>
          {d.source === 'demo' ? 'DEMO' : live ? 'LIVE' : 'OFFLINE'}
        </text>
        {edit && <text x="1330" y="55" textAnchor="middle" className="hd-edit">TAP ANY GAUGE TO CHANGE WHAT IT SHOWS</text>}
        <text x="1960" y="56" textAnchor="end" className="hd-clock">{clock()}</text>

        <g onPointerDown={edit ? stop : undefined} onPointerUp={edit ? stop : undefined}>
          {layout.slots.map((slot, i) => (
            <Widget key={`${cfg.layout}-${i}`} slot={slot} sensor={sensors[i]} d={d} shape={shape}
              edit={edit} onEdit={() => setPick(i)} />
          ))}
        </g>

        <Toolbar edit={edit} setEdit={setEdit} panel={panel} setPanel={setPanel} />
      </svg>

      {panel === 'style' && <StylePanel cfg={cfg} save={save} close={() => setPanel(null)} />}
      {panel === 'layout' && <LayoutPanel cfg={cfg} save={save} close={() => setPanel(null)} />}
      {panel === 'menu' && <MenuPanel cfg={cfg} save={save} close={() => setPanel(null)} />}
      {pick != null && (
        <SensorPicker current={sensors[pick]} slotLabel={layout.slots[pick].t === 'gauge' ? 'GAUGE' : 'PANEL'}
          onPick={(id) => setSensor(pick, id)} close={() => setPick(null)} />
      )}
    </div>
  );
}
