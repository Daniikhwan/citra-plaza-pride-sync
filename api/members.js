// Citra Plaza Pride — shared member list sync (Vercel serverless function).
// Storage: Vercel KV (Upstash) via its REST API. No phone numbers are ever
// stored or accepted here — shared fields are name, role, vehicle, status.
// Writes need the shared SYNC_KEY (light friction only — the key is visible
// in the public app's source, so it is NOT real security).
const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const SYNC_KEY = process.env.SYNC_KEY || '';
const KEY = 'cpp:members';
const MAX_MEMBERS = 100;
const ROLES = ['Admin grup', 'Anggota'];
const STATUSES = ['On Bid', 'Istirahat', 'Off'];

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function kvHeaders() {
  return { Authorization: `Bearer ${KV_TOKEN}` };
}

async function kvGet() {
  const r = await fetch(`${KV_URL}/get/${KEY}`, { headers: kvHeaders() });
  if (!r.ok) throw new Error(`kv get failed: ${r.status}`);
  const j = await r.json();
  return j.result || null;
}

async function kvSet(value) {
  const r = await fetch(
    `${KV_URL}/set/${KEY}/${encodeURIComponent(value)}`,
    { headers: kvHeaders() }
  );
  if (!r.ok) throw new Error(`kv set failed: ${r.status}`);
  return r.json();
}

function cleanMember(m) {
  if (!m || typeof m !== 'object') return null;
  const name = String(m.name || '').trim().slice(0, 60);
  if (!name) return null;
  const role = ROLES.includes(m.role) ? m.role : 'Anggota';
  const status = STATUSES.includes(m.status) ? m.status : 'Istirahat';
  const vehicle = String(m.vehicle || '').trim().slice(0, 40);
  // NOTE: any phone field is deliberately dropped — never stored shared.
  return { name, role, vehicle, status };
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!KV_URL || !KV_TOKEN) {
    return res.status(503).json({ error: 'store_not_configured' });
  }

  try {
    if (req.method === 'GET') {
      const raw = await kvGet();
      const members = raw ? JSON.parse(raw) : [];
      return res.status(200).json({ members, updatedAt: Date.now() });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      if (!SYNC_KEY || body.key !== SYNC_KEY) {
        return res.status(401).json({ error: 'bad_key' });
      }
      if (!Array.isArray(body.members) || body.members.length > MAX_MEMBERS) {
        return res.status(400).json({ error: 'bad_members' });
      }
      const members = body.members.map(cleanMember).filter(Boolean);
      await kvSet(JSON.stringify(members));
      return res.status(200).json({ ok: true, count: members.length });
    }

    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
};
