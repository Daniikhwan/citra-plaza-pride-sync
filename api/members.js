// Citra Plaza Pride — shared member list sync (Vercel serverless function).
// Storage: Vercel Blob (one small public JSON file, members.json) via the
// official @vercel/blob SDK. The SDK reads BLOB_READ_WRITE_TOKEN from the
// environment (set when the Blob store was connected to the project).
// No phone numbers are ever stored or accepted here — shared fields are
// name, role, vehicle, status.
// Writes need the shared SYNC_KEY (light friction only — the key is visible
// in the public app's source, so it is NOT real security).
const { put, list } = require('@vercel/blob');

const SYNC_KEY = process.env.SYNC_KEY || '';
const MAX_MEMBERS = 100;
const ROLES = ['Admin grup', 'Anggota'];
const STATUSES = ['On Bid', 'Istirahat', 'Off'];

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function blobGet() {
  const { blobs } = await list({ prefix: 'members.json' });
  if (!blobs.length) return null;
  const newest = blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
  // Cache-buster so the CDN never serves a stale list after a write.
  const r = await fetch(`${newest.url}?t=${Date.now()}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`blob get failed: ${r.status}`);
  return r.text();
}

async function blobPut(value) {
  await put('members.json', value, {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  });
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
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ error: 'store_not_configured' });
  }

  try {
    if (req.method === 'GET') {
      const raw = await blobGet();
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
      await blobPut(JSON.stringify(members));
      return res.status(200).json({ ok: true, count: members.length });
    }

    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    console.error('members error:', e);
    return res.status(500).json({ error: 'server_error' });
  }
};
