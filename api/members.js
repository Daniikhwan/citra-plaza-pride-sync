// Citra Plaza Pride — shared member list sync (Vercel serverless function).
// Storage: Vercel Blob (one small public JSON file, members.json) via the
// official @vercel/blob SDK. The SDK reads BLOB_READ_WRITE_TOKEN from the
// environment (set when the Blob store was connected to the project).
// No phone numbers are ever stored or accepted here — shared fields are
// name, role, vehicle, status.
//
// NOTE on writes: this endpoint deliberately has NO write key. A static
// page cannot keep a secret — anything shipped in the page source is
// public — so a shared key would be theatre, not security. The list is
// community-editable by design (like a shared doc). Safety net instead:
// every write first backs up the current list to members-prev.json, so a
// bad overwrite can be restored (GET /api/members?prev=1).
const { put, list } = require('@vercel/blob');

const MAX_MEMBERS = 100;
const ROLES = ['Admin grup', 'Anggota'];
const STATUSES = ['On Bid', 'Istirahat', 'Off'];

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function blobGet(prefix) {
  const { blobs } = await list({ prefix });
  if (!blobs.length) return null;
  const newest = blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
  // Cache-buster so the CDN never serves a stale list after a write.
  const r = await fetch(`${newest.url}?t=${Date.now()}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`blob get failed: ${r.status}`);
  return r.text();
}

async function blobPut(pathname, value) {
  await put(pathname, value, {
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
      const raw = await blobGet(req.query && req.query.prev ? 'members-prev.json' : 'members.json');
      const members = raw ? JSON.parse(raw) : [];
      return res.status(200).json({ members, updatedAt: Date.now() });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      if (!Array.isArray(body.members) || body.members.length > MAX_MEMBERS) {
        return res.status(400).json({ error: 'bad_members' });
      }
      const members = body.members.map(cleanMember).filter(Boolean);
      // Back up the current list before overwriting it.
      const current = await blobGet('members.json');
      if (current) {
        await blobPut('members-prev.json', current);
      }
      await blobPut('members.json', JSON.stringify(members));
      return res.status(200).json({ ok: true, count: members.length });
    }

    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    console.error('members error:', e);
    return res.status(500).json({ error: 'server_error' });
  }
};
