// "Ask AI" – chat with Claude about your driving and your car. The question
// goes to your own small server (server/index.js on Render), which holds the
// Anthropic API key; the app sends a compact summary of what it has learned
// (trip stats, health baselines, alerts – no location data).
import { useRef, useState } from 'react';
import { actions } from '../store.js';

const QUICK = [
  'How was my driving this week?',
  'Is my car healthy?',
  'Why was my mileage low recently?',
  'How can I save fuel with my driving style?',
];

export default function Assistant({ L, d }) {
  const [msgs, setMsgs] = useState([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [showCfg, setShowCfg] = useState(!d.settings.aiToken);
  const endRef = useRef(null);
  const { aiUrl, aiToken } = d.settings;

  async function ask(text) {
    const question = text.trim();
    if (!question || busy) return;
    const history = msgs.slice(-8);
    setMsgs((m) => [...m, { role: 'user', content: question }]);
    setQ('');
    setBusy(true);
    try {
      const res = await fetch(`${aiUrl.replace(/\/$/, '')}/api/ask`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-app-token': aiToken },
        body: JSON.stringify({ question, history, context: L.aiContext() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Server error ${res.status}`);
      setMsgs((m) => [...m, { role: 'assistant', content: body.answer }]);
    } catch (e) {
      const hint = /Failed to fetch|NetworkError|Load failed/.test(e.message)
        ? 'Could not reach the AI server. Check your internet connection and the server address. A free Render server can take ~50 s to wake up, so try again.'
        : e.message;
      setMsgs((m) => [...m, { role: 'error', content: hint }]);
    } finally {
      setBusy(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }

  return (
    <div className="ai">
      <section className="card">
        <div className="row between">
          <h3>Ask about your car and driving</h3>
          <button className="btn ghost" onClick={() => setShowCfg(!showCfg)}>{showCfg ? 'Hide' : 'Server settings'}</button>
        </div>
        {showCfg && (
          <div className="form">
            <label>AI server address <input type="url" value={aiUrl} spellCheck={false}
              onChange={(e) => actions.updateSettings({ aiUrl: e.target.value.trim() })} /></label>
            <label>Access token <input type="password" value={aiToken} spellCheck={false} placeholder="the APP_TOKEN you set on the server"
              onChange={(e) => actions.updateSettings({ aiToken: e.target.value.trim() })} /></label>
            <p className="muted small">Sends a summary of your learned data (trip stats, economy, health baselines, alerts; no location) to this server, which asks Claude. Nothing is sent until you ask a question.</p>
          </div>
        )}
      </section>

      <div className="chat">
        {!msgs.length && (
          <div className="quick">
            {QUICK.map((x) => <button key={x} className="btn ghost" disabled={!aiToken || busy} onClick={() => ask(x)}>{x}</button>)}
            {!aiToken && <p className="muted small">Add the server's access token above to start.</p>}
          </div>
        )}
        {msgs.map((m, i) => <div key={i} className={`msg ${m.role}`}>{m.content}</div>)}
        {busy && <div className="msg assistant typing">Thinking…</div>}
        <div ref={endRef} />
      </div>

      <form className="ask" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={aiToken ? 'Ask anything about your WagonR…' : 'Set the access token first'} disabled={!aiToken} />
        <button className="btn primary" disabled={!aiToken || busy || !q.trim()}>Send</button>
      </form>
    </div>
  );
}
