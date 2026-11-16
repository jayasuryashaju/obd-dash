// WagonR Dash – AI assistant server (Render web service).
// Holds the Anthropic API key so it never ships inside the app.
//
// Environment:
//   ANTHROPIC_API_KEY  required – your Anthropic API key
//   APP_TOKEN          required – any long random string; enter the same in the app
//   ALLOWED_ORIGINS    optional – comma list; defaults to the web app + Android app origins
//   PORT               set by Render
import http from 'node:http';
import Anthropic from '@anthropic-ai/sdk';

const PORT = process.env.PORT || 8787;
const MODEL = 'claude-opus-5-5';
const ORIGINS = (process.env.ALLOWED_ORIGINS ||
  'https://wagonr-dash.onrender.com,https://localhost,http://localhost,capacitor://localhost,http://localhost:5173,http://localhost:5180')
  .split(',').map((s) => s.trim());

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

const SYSTEM = `You are the in-app assistant of "WagonR Dash", an OBD-II dashboard app on the driver's phone.
The driver owns a 2016 Maruti Suzuki WagonR VXi (K10B 998 cc petrol, 5-speed manual) in India.
Each question comes with a JSON summary of what the app has learned on-device: recent trips, driving-style profile, fuel calibration, tank estimate, gear learning and "normal for this car" health baselines with alerts.

How to answer:
- Base every claim on the data provided; quote the actual numbers. If the data is thin (few trips, baselines still learning), say so plainly instead of guessing.
- Fuel economy is an estimate from the MAP sensor corrected with fill-ups; mention uncertainty when calibration has fewer than 2 full tanks.
- Be practical and specific to this car: shift points, idling, short cold trips, tyre size (185/45R15 vs stock 155/65R14), Indian city/highway driving. Use km, km/L, °C, ₹.
- Health: treat alerts as early hints, not diagnoses. For anything that could be safety-related or damaging (overheating, charging fault, check-engine light) advise seeing a mechanic soon.
- Never suggest ECU tuning, disabling safety systems, or unsafe driving.
- Keep it short for a phone screen: a direct answer first, then up to 4 bullet points. No tables.`;

// tiny in-memory rate limit: 40 questions / hour / IP
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 3600e3);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 40;
}

function send(res, status, body, origin) {
  const headers = { 'content-type': 'application/json' };
  if (origin && ORIGINS.includes(origin)) {
    headers['access-control-allow-origin'] = origin;
    headers.vary = 'origin';
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

async function readBody(req, max = 96 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > max) throw Object.assign(new Error('Request too large'), { status: 413 });
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

async function ask({ question, history = [], context = {} }) {
  const messages = [];
  for (const m of history.slice(-8)) {
    if ((m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content) {
      messages.push({ role: m.role, content: m.content.slice(0, 4000) });
    }
  }
  while (messages.length && messages[0].role !== 'user') messages.shift();
  messages.push({
    role: 'user',
    content: `<car_data>\n${JSON.stringify(context).slice(0, 60000)}\n</car_data>\n\n${String(question).slice(0, 1000)}`,
  });

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { effort: 'low' },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    messages,
  });

  if (response.stop_reason === 'refusal') {
    return "Sorry – I can't help with that one. Try asking about your trips, fuel economy or the car's health.";
  }
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  return text || 'No answer was returned – please try again.';
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (req.method === 'OPTIONS') {
    const h = { vary: 'origin' };
    if (ORIGINS.includes(origin)) {
      Object.assign(h, {
        'access-control-allow-origin': origin,
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type, x-app-token',
        'access-control-max-age': '86400',
      });
    }
    res.writeHead(204, h);
    return res.end();
  }
  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    return send(res, 200, { ok: true, configured: Boolean(client && process.env.APP_TOKEN) }, origin);
  }
  if (req.method !== 'POST' || req.url !== '/api/ask') return send(res, 404, { error: 'Not found' }, origin);

  if (!client || !process.env.APP_TOKEN) return send(res, 503, { error: 'AI server is not configured yet (ANTHROPIC_API_KEY / APP_TOKEN missing).' }, origin);
  if (req.headers['x-app-token'] !== process.env.APP_TOKEN) return send(res, 401, { error: 'Wrong access token – check it in the app settings.' }, origin);
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (limited(ip)) return send(res, 429, { error: 'Too many questions this hour – try again later.' }, origin);

  try {
    const body = await readBody(req);
    if (!body.question || typeof body.question !== 'string') return send(res, 400, { error: 'Missing question' }, origin);
    const answer = await ask(body);
    return send(res, 200, { answer }, origin);
  } catch (e) {
    if (e.status === 413) return send(res, 413, { error: e.message }, origin);
    if (e instanceof Anthropic.AuthenticationError) return send(res, 502, { error: 'The server’s Anthropic API key was rejected.' }, origin);
    if (e instanceof Anthropic.RateLimitError) return send(res, 429, { error: 'The AI service is busy – try again in a minute.' }, origin);
    if (e instanceof Anthropic.APIError) return send(res, 502, { error: `AI service error (${e.status}).` }, origin);
    if (e instanceof SyntaxError) return send(res, 400, { error: 'Bad request body' }, origin);
    console.error(e);
    return send(res, 500, { error: 'Server error' }, origin);
  }
});

server.listen(PORT, () => console.log(`WagonR Dash AI server on :${PORT}`));
