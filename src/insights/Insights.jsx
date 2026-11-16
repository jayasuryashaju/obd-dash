// Insights – what the app has learned: trips, driving style, car health,
// fuel calibration & tank, gear learning, and the AI assistant.
import { useEffect, useState } from 'react';
import { actions, learners } from '../store.js';
import { CAR, defaultGearKmh } from '../car.js';
import { HEALTH, BAND_LABELS } from '../learn/learner.js';
import Assistant from './Assistant.jsx';
import './insights.css';

const TABS = [
  ['overview', 'Overview'], ['trips', 'Trips'], ['style', 'Driving style'], ['health', 'Car health'],
  ['fuel', 'Fuel & tank'], ['gears', 'Gears'], ['ai', 'Ask AI'],
];
const n1 = (v) => (v == null || Number.isNaN(v) ? '–' : v.toFixed(1));
const n0 = (v) => (v == null || Number.isNaN(v) ? '–' : Math.round(v).toString());
const when = (t) => new Date(t).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const mins = (s) => `${Math.floor(s / 60)} min`;

function useLearnerVersion(L) {
  const [, force] = useState(0);
  useEffect(() => L.subscribe(() => force((x) => x + 1)), [L]);
}

function Score({ v, size = 'md' }) {
  if (v == null) return <span className={`score ${size} none`}>–</span>;
  const tone = v >= 80 ? 'good' : v >= 60 ? 'ok' : 'bad';
  return <span className={`score ${size} ${tone}`}>{v}</span>;
}

function Stat({ label, value, unit, hint }) {
  return (
    <div className="stat">
      <span className="stat-l">{label}</span>
      <span className="stat-v">{value}{unit && <small> {unit}</small>}</span>
      {hint && <span className="stat-h">{hint}</span>}
    </div>
  );
}

/* --------------------------------------------------------------- Overview */
function Overview({ L, d, go }) {
  const tank = L.tankInfo();
  const live = L.liveTrip;
  const liveScore = live && live.dist > 0.2 ? L.scoreOf(live) : null;
  const m = L.model;
  const alerts = m.health.alerts.slice(-3).reverse();
  const learnedGears = m.gears.counts.filter((c) => c >= 25).length;
  return (
    <div className="grid">
      <section className="card">
        <h3>Current drive</h3>
        {live ? (
          <div className="row">
            <Score v={liveScore?.total} size="lg" />
            <div className="stats">
              <Stat label="Distance" value={n1(live.dist)} unit="km" />
              <Stat label="Economy" value={live.fuel > 0.01 ? n1(live.dist / live.fuel) : '–'} unit="km/L" />
              <Stat label="Idle" value={n0((100 * live.idle) / Math.max(1, live.dur))} unit="%" />
            </div>
          </div>
        ) : <p className="muted">Starts automatically when the engine is running.</p>}
      </section>

      <section className="card">
        <h3>Fuel tank</h3>
        {tank.level == null ? (
          <><p className="muted">Fill the tank to full and log it to start tracking level, range and calibration.</p>
            <button className="btn primary" onClick={() => go('fuel')}>Log a fill-up</button></>
        ) : (
          <>
            <div className="tank"><i style={{ width: `${tank.pct}%` }} /></div>
            <div className="stats">
              <Stat label="Level" value={n1(tank.level)} unit={`/ ${tank.capacity} L`} />
              <Stat label="Range" value={n0(tank.rangeKm)} unit="km" hint={m.style.kmplBase ? `at your ${n1(m.style.kmplBase)} km/L` : 'needs a few trips'} />
            </div>
          </>
        )}
      </section>

      <section className="card">
        <h3>Your driving</h3>
        {m.style.n ? (
          <div className="stats">
            <Stat label="Style" value={L.styleLabel()} />
            <Stat label="Usual economy" value={n1(m.style.kmplBase)} unit="km/L" />
            <Stat label="Trips learned" value={m.style.n} />
          </div>
        ) : <p className="muted">Learning after your first drive over 1 km.</p>}
      </section>

      <section className="card">
        <h3>Car health</h3>
        {alerts.length ? alerts.map((a) => (
          <div key={a.t} className={`alert ${a.level}`}><b>{a.title}</b><span>{a.detail}</span></div>
        )) : <p className="ok-line">No issues spotted. {Object.values(m.health.base).filter((b) => b.n >= 5).length} of {Object.keys(HEALTH).length} baselines learned.</p>}
      </section>

      <section className="card">
        <h3>Learning progress</h3>
        <div className="stats">
          <Stat label="Gears learned" value={`${learnedGears}/5`} />
          <Stat label="Fuel calibrations" value={m.fuel.rows.length} hint={m.fuel.rows.length ? `last tank ${m.fuel.lastCheck ? `${m.fuel.lastCheck.errPct > 0 ? '+' : ''}${n1(m.fuel.lastCheck.errPct)}% off` : ''}` : 'needs 2 full fill-ups'} />
          <Stat label="Trips stored" value={L.trips().length} />
        </div>
        <div className="row gap">
          <label className="toggle">
            <input type="checkbox" checked={d.settings.learning} onChange={(e) => actions.updateSettings({ learning: e.target.checked })} />
            Learning on
          </label>
          <button className="btn danger ghost" onClick={() => { if (confirm('Delete everything learned (trips, calibration, baselines) for this data source?')) { L.reset(); actions.refreshLearn(); } }}>
            Reset learned data
          </button>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ Trips */
function Trips({ L }) {
  const list = L.trips();
  const [open, setOpen] = useState(null);
  const week = Date.now() - 7 * 864e5;
  const cur = list.filter((t) => t.start >= week);
  const prev = list.filter((t) => t.start < week && t.start >= week - 7 * 864e5);
  const agg = (a) => {
    const km = a.reduce((s, t) => s + t.km, 0);
    const fuel = a.reduce((s, t) => s + t.fuelL, 0);
    return { km, fuel, kmpl: fuel > 0.05 ? km / fuel : null };
  };
  const A = agg(cur);
  const B = agg(prev);
  const trend = A.kmpl && B.kmpl ? ((A.kmpl / B.kmpl - 1) * 100) : null;
  if (!list.length) return <p className="muted pad">No trips yet. Trips are saved automatically when you switch the engine off or disconnect.</p>;
  return (
    <div>
      <section className="card">
        <h3>Last 7 days</h3>
        <div className="stats">
          <Stat label="Distance" value={n0(A.km)} unit="km" />
          <Stat label="Fuel" value={n1(A.fuel)} unit="L" />
          <Stat label="Economy" value={n1(A.kmpl)} unit="km/L" hint={trend == null ? null : `${trend >= 0 ? '▲' : '▼'} ${Math.abs(trend).toFixed(0)}% vs previous week`} />
          <Stat label="Trips" value={cur.length} />
        </div>
      </section>
      <div className="trips">
        {list.map((t) => (
          <div key={t.id} className={`trip ${open === t.id ? 'open' : ''}`}>
            <button className="trip-h" onClick={() => setOpen(open === t.id ? null : t.id)}>
              <Score v={t.score?.total} />
              <span className="trip-when">{when(t.start)}</span>
              <span className="trip-n">{n1(t.km)} km</span>
              <span className="trip-n">{n1(t.kmpl)} km/L</span>
              <span className="chips">
                {t.coldStart && <i>cold start</i>}
                {t.short && <i>short</i>}
                {t.harshAcc + t.harshBrk > 0 && <i className="warn">{t.harshAcc + t.harshBrk} harsh</i>}
                {t.alerts?.length > 0 && <i className="bad">alert</i>}
              </span>
            </button>
            {open === t.id && (
              <div className="trip-b">
                <div className="stats">
                  <Stat label="Duration" value={mins(t.durS)} />
                  <Stat label="Avg speed" value={n0(t.avgSpeed)} unit="km/h" />
                  <Stat label="Top speed" value={t.maxSpeed} unit="km/h" />
                  <Stat label="Fuel used" value={n1(t.fuelL)} unit="L" />
                  <Stat label="Idling" value={n0((100 * t.idleS) / Math.max(1, t.durS))} unit="%" hint={`${t.idleFuelL.toFixed(2)} L burnt idling`} />
                  <Stat label="Shift (light)" value={n0(t.shiftLight)} unit="rpm" />
                  <Stat label="Harsh accel / brake" value={`${t.harshAcc} / ${t.harshBrk}`} />
                  <Stat label="Score" value={`${t.score.eco} · ${t.score.smooth} · ${t.score.idle}`} hint="economy · smoothness · idle" />
                </div>
                <button className="btn ghost danger" onClick={() => L.deleteTrip(t.id)}>Delete trip</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Style */
function Style({ L, d }) {
  const s = L.model.style;
  if (!s.n) return <p className="muted pad">Drive a little – your profile appears after the first trip over 1 km.</p>;
  const eco = Math.round(L.shiftThreshold(20, d.settings.shiftRpm));
  const tips = [];
  if (s.shiftLight > 3000) tips.push(`In light driving you usually shift around ${n0(s.shiftLight)} rpm. Shifting nearer ${eco} rpm typically saves 5–10 % fuel in town.`);
  if (s.idlePct > 20) tips.push(`About ${n0(s.idlePct)} % of your engine time is idling. Switching off for stops longer than a minute saves fuel.`);
  if (s.harshPer100 > 4) tips.push(`${n1(s.harshPer100)} harsh accelerations/brakes per 100 km. Smoother inputs improve economy and save brakes and clutch.`);
  if (s.p90Thr > 70) tips.push('You often use more than 70 % throttle. The K10B makes most of its pull by 60 %; beyond that it mostly burns extra fuel.');
  if (!tips.length) tips.push('Nice, smooth driving. Keep it up.');
  return (
    <div>
      <section className="card hero">
        <span className={`style-tag ${L.styleLabel()?.toLowerCase()}`}>{L.styleLabel()}</span>
        <p className="muted">Learned from {s.n} trip{s.n === 1 ? '' : 's'}. The shift hint adapts: at light throttle it prompts you at <b>{eco} rpm</b>; when you accelerate hard it moves up toward your shift-light setting ({d.settings.shiftRpm} rpm).</p>
      </section>
      <section className="card">
        <div className="stats">
          <Stat label="Shift point (light throttle)" value={n0(s.shiftLight)} unit="rpm" />
          <Stat label="Shift point (hard)" value={n0(s.shiftHeavy)} unit="rpm" />
          <Stat label="Throttle (90th percentile)" value={n0(s.p90Thr)} unit="%" />
          <Stat label="Harsh events" value={n1(s.harshPer100)} unit="/100 km" />
          <Stat label="Idle time" value={n0(s.idlePct)} unit="%" />
          <Stat label="Your usual economy" value={n1(s.kmplBase)} unit="km/L" />
        </div>
      </section>
      <section className="card">
        <h3>Coaching</h3>
        <ul className="tips">{tips.map((t) => <li key={t}>{t}</li>)}</ul>
      </section>
    </div>
  );
}

/* ----------------------------------------------------------------- Health */
function Health({ L }) {
  const { base, alerts } = L.model.health;
  return (
    <div>
      <section className="card">
        <h3>What's normal for your car</h3>
        <p className="muted">Each value is learned from your own drives (after warm-up). You'll get an alert when a drive is well outside your car's normal, often before a warning light comes on.</p>
        <table className="tbl">
          <thead><tr><th>Check</th><th>Your normal</th><th>Last</th><th>Status</th></tr></thead>
          <tbody>
            {Object.entries(HEALTH).map(([k, r]) => {
              const b = base[k];
              const st = !b ? 'waiting for data' : b.n < 5 ? `learning (${b.n}/5)` : 'normal';
              return (
                <tr key={k}>
                  <td>{r.label}</td>
                  <td>{b ? `${b.mean.toFixed(r.dec)} ${r.unit}${b.n >= 3 ? ` ± ${Math.max(b.dev, 0).toFixed(r.dec)}` : ''}` : '–'}</td>
                  <td>{b?.last != null ? `${b.last.toFixed(r.dec)} ${r.unit}` : '–'}</td>
                  <td><span className={`pill-s ${b?.n >= 5 ? 'good' : ''}`}>{st}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <section className="card">
        <h3>Alerts</h3>
        {alerts.length ? [...alerts].reverse().map((a) => (
          <div key={a.t} className={`alert ${a.level}`}>
            <b>{a.title}</b><span>{a.detail}</span>
            <small>{when(a.t)} · <button className="link" onClick={() => L.dismissAlert(a.t)}>dismiss</button></small>
          </div>
        )) : <p className="ok-line">No alerts.</p>}
        <p className="muted small">These are early hints from data patterns, not a diagnosis. Have a mechanic confirm anything serious.</p>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------- Fuel */
function Fuel({ L }) {
  const f = L.model.fuel;
  const tank = L.tankInfo();
  const [litres, setLitres] = useState('');
  const [full, setFull] = useState(true);
  const [price, setPrice] = useState('');
  const [msg, setMsg] = useState(null);
  const submit = () => {
    const r = L.logFill({ litres, full, price: price || null });
    actions.refreshLearn();
    setLitres('');
    if (r) setMsg(`Calibrated: the app estimated ${n1(r.appL)} L, the pump says ${n1(r.pumpL)} L (${r.errPct > 0 ? '+' : ''}${n1(r.errPct)}%). The correction is applied from now on.`);
    else if (full && !f.rows.length && f.fills.length <= 1) setMsg('Logged. Tank set to full. Calibration starts at your next full fill-up.');
    else setMsg('Logged.');
  };
  return (
    <div>
      <section className="card">
        <h3>Log a fill-up</h3>
        <div className="form">
          <label>Litres <input type="number" inputMode="decimal" step="0.01" value={litres} onChange={(e) => setLitres(e.target.value)} placeholder="e.g. 28.4" /></label>
          <label>Price per litre (₹, optional) <input type="number" inputMode="decimal" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 102.5" /></label>
          <label className="toggle"><input type="checkbox" checked={full} onChange={(e) => setFull(e.target.checked)} /> Filled to full (until the pump clicked off)</label>
          <button className="btn primary" disabled={!(Number(litres) > 0)} onClick={submit}>Save fill-up</button>
        </div>
        {msg && <p className="note-ok">{msg}</p>}
        <p className="muted small">For calibration, always fill until the pump clicks off, at the same pump if you can. Each full-to-full tank teaches the app how much fuel your engine really uses.</p>
      </section>

      <section className="card">
        <h3>Tank</h3>
        <div className="stats">
          <Stat label="Level" value={tank.level == null ? '–' : n1(tank.level)} unit="L" />
          <Stat label="Range" value={n0(tank.rangeKm)} unit="km" />
        </div>
        <div className="form inline">
          <label>Tank size (L) <input type="number" defaultValue={tank.capacity} onBlur={(e) => { L.setCapacity(e.target.value); actions.refreshLearn(); }} /></label>
          <label>Set level now (L) <input type="number" placeholder="optional" onBlur={(e) => { if (e.target.value) { L.setTankLevel(e.target.value); actions.refreshLearn(); e.target.value = ''; } }} /></label>
        </div>
      </section>

      <section className="card">
        <h3>Calibration</h3>
        <p className="muted">Your ECU doesn't report fuel used, so it's estimated from manifold pressure and then corrected per rpm range using your fill-ups.</p>
        <table className="tbl">
          <thead><tr><th>Engine speed</th>{BAND_LABELS.map((b) => <th key={b}>{b}</th>)}</tr></thead>
          <tbody><tr><td>Correction</td>{f.factors.map((x, i) => <td key={i}>× {x.toFixed(3)}</td>)}</tr></tbody>
        </table>
        <div className="stats">
          <Stat label="Full tanks used" value={f.rows.length} />
          <Stat label="Last tank accuracy" value={f.lastCheck ? `${f.lastCheck.errPct > 0 ? '+' : ''}${n1(f.lastCheck.errPct)}%` : '–'} hint="before that tank's correction" />
        </div>
      </section>

      {f.fills.length > 0 && (
        <section className="card">
          <h3>Fill-up history</h3>
          <table className="tbl">
            <thead><tr><th>Date</th><th>Litres</th><th>Since last full</th><th>Real km/L</th><th>Cost</th></tr></thead>
            <tbody>
              {[...f.fills].reverse().map((x) => (
                <tr key={x.t}>
                  <td>{when(x.t)}{x.full ? '' : ' (partial)'}</td>
                  <td>{n1(x.litres)}</td>
                  <td>{x.kmSince != null ? `${n0(x.kmSince)} km` : '–'}</td>
                  <td>{x.full && x.kmSince > 20 ? n1(x.kmSince / x.litres) : '–'}</td>
                  <td>{x.price ? `₹${n0(x.price * x.litres)}` : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Gears */
function Gears({ L, d }) {
  const g = L.model.gears;
  const book = defaultGearKmh(d.settings.tyre);
  return (
    <section className="card">
      <h3>Gear learning</h3>
      <p className="muted">While you hold a steady speed, the app measures the real speed-to-rpm ratio of each gear. After 25 steady seconds in a gear it switches to the learned value, and once all five are learned, gear detection gets stricter and more accurate.</p>
      <table className="tbl">
        <thead><tr><th>Gear</th><th>Book value</th><th>Learned</th><th>Progress</th></tr></thead>
        <tbody>
          {book.map((b, i) => {
            const c = g.counts[i] || 0;
            return (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{b.toFixed(1)} km/h per 1000 rpm</td>
                <td>{g.centers && c > 0 ? g.centers[i].toFixed(2) : '–'}</td>
                <td><div className="prog"><i style={{ width: `${Math.min(100, (c / 25) * 100)}%` }} /></div>{c >= 25 ? ' ✓' : ` ${c}/25`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted small">At 1000 rpm in 5th, {CAR.name} does {(g.centers && g.counts[4] >= 25 ? g.centers[4] : book[4]).toFixed(1)} km/h on your {d.settings.tyre} tyres.</p>
    </section>
  );
}

export default function Insights({ d, close }) {
  const [kind, setKind] = useState(d.source === 'demo' || (!d.source && d.lastSource === 'demo') ? 'demo' : 'obd');
  const L = learners[kind];
  useLearnerVersion(L);
  const [tab, setTab] = useState('overview');
  return (
    <div className="ins" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
      <header className="ins-h">
        <h2>Insights</h2>
        <div className="src-seg">
          <button className={kind === 'obd' ? 'on' : ''} onClick={() => setKind('obd')}>My car</button>
          <button className={kind === 'demo' ? 'on' : ''} onClick={() => setKind('demo')}>Demo data</button>
        </div>
        {kind === 'demo' && <span className="demo-tag">kept separate from your car</span>}
        <button className="x" onClick={close}>✕</button>
      </header>
      <nav className="ins-nav">
        {TABS.map(([k, label]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>
        ))}
      </nav>
      <main className="ins-body">
        {tab === 'overview' && <Overview L={L} d={d} go={setTab} />}
        {tab === 'trips' && <Trips L={L} />}
        {tab === 'style' && <Style L={L} d={d} />}
        {tab === 'health' && <Health L={L} />}
        {tab === 'fuel' && <Fuel L={L} />}
        {tab === 'gears' && <Gears L={L} d={d} />}
        {tab === 'ai' && <Assistant L={L} d={d} />}
      </main>
    </div>
  );
}
