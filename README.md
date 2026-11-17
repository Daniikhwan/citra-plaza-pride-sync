# Citra Plaza Pride — sync server

Server kecil (Vercel serverless) supaya daftar anggota aplikasi ojol Citra
Plaza Pride dibagikan antar HP: tambah anggota / ganti status di satu HP
langsung kelihatan di HP lain.

## Cara kerja

- `GET /api/members` → `{ members, updatedAt }` (publik, tanpa key).
- `POST /api/members` dengan body `{ key, members }` → ganti seluruh daftar.
  Key = isi `sync-key.txt` (env var `SYNC_KEY` di Vercel). Key ini kelihatan
  di source aplikasi publik, jadi cuma penghalang iseng — BUKAN keamanan.
- Penyimpanan: Vercel KV (Upstash) via REST — env var `KV_REST_API_URL` dan
  `KV_REST_API_TOKEN` (otomatis terisi saat KV store di-link ke project).
- Field bersama HANYA: `name`, `role` (Admin grup / Anggota), `vehicle`,
  `status` (On Bid / Istirahat / Off). Nomor HP TIDAK PERNAH disimpan di
  server — server membuang field phone apa pun yang dikirim.

## Deploy (setelah Vercel terhubung)

1. Buat project Vercel baru dari folder ini, atau `create_deployment` via
   MCP Vercel.
2. Buat KV store di Vercel dashboard dan link ke project (env var KV_*
   terisi otomatis).
3. Set env var `SYNC_KEY` = isi `sync-key.txt`.
4. Deploy, lalu cek `GET https://<host>/api/health` → `{ ok: true }`.
5. Seed daftar awal (3 admin dari screenshot grup WA):
   `POST /api/members` dengan key + isi `seed.json` sebagai `members`.
6. Catat URL `https://<host>/api/members` + key — dipakai saat update
   aplikasi (artifact `citra-plaza-pride`) supaya ambil/tulis daftar ke
   server ini, dengan localStorage sebagai fallback saat offline.

## File

- `api/members.js` — GET/POST daftar bersama.
- `api/health.js` — health check.
- `seed.json` — 3 admin awal.
- `sync-key.txt` — (mode 600) key tulis. Jangan commit ke repo publik.
