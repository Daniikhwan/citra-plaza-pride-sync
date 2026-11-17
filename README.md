# Citra Plaza Pride — sync server

Server kecil (Vercel serverless) supaya daftar anggota aplikasi ojol Citra
Plaza Pride dibagikan antar HP: tambah anggota / ganti status di satu HP
langsung kelihatan di HP lain.

## Cara kerja

- `GET /api/members` → `{ members, updatedAt }` (publik, tanpa key).
- `POST /api/members` dengan body `{ members }` → ganti seluruh daftar.
  TANPA kunci tulis — halaman statis tidak bisa menyimpan rahasia (apa pun
  di source halaman itu publik), jadi kunci bersama cuma sandiwara, bukan
  keamanan. Daftar ini memang bisa diedit siapa pun yang punya link,
  seperti dokumen bersama. Pengaman: tiap tulis dulu membackup daftar
  lama ke `members-prev.json` (baca via `GET /api/members?prev=1`), jadi
  timpaan yang salah bisa dibalikkan.
- Penyimpanan: Vercel Blob (satu file JSON publik, `members.json`) via SDK
  resmi `@vercel/blob` — env var `BLOB_READ_WRITE_TOKEN` (otomatis terisi
  saat Blob store di-link ke project; koneksi harus mode token, bukan OIDC
  saja). Tulis pakai `put(..., { addRandomSuffix: false })` supaya URL-nya
  stabil; baca lewat `list({ prefix: 'members.json' })` + cache-buster
  supaya CDN tidak menyajikan daftar basi.
- Field bersama HANYA: `name`, `role` (Admin grup / Anggota), `vehicle`,
  `status` (On Bid / Istirahat / Off). Nomor HP TIDAK PERNAH disimpan di
  server — server membuang field phone apa pun yang dikirim.

## Deploy (Vercel CLI — tim jarwo3)

Koneksi Vercel MCP tidak bisa menyentuh tim jarwo3 (403), jadi deploy lewat
Vercel CLI (`/usr/bin/vercel`, login sebagai daniikhwan):

1. `vercel --scope jarwo3 storage create citra-plaza-pride-blob --type blob --access public`
2. Deploy (sekaligus buat project):
   `vercel --scope jarwo3 --prod --yes --project citra-plaza-pride-sync --create-if-missing`
   (dijalankan dari folder ini; `sync-key.txt` TIDAK ikut ter-deploy —
   ada di `.gitignore`.)
3. `vercel --scope jarwo3 storage connect citra-plaza-pride-blob --yes`
   (mengisi `BLOB_READ_WRITE_TOKEN` di project).
4. Upload seed pertama ke Blob (supaya daftar awal langsung ada):
   `curl -X PUT https://blob.vercel-storage.com/members.json -H "Authorization: Bearer $BLOB_READ_WRITE_TOKEN" --data-binary @seed.json`
   (token dari `vercel env pull`; atau pakai SDK `@vercel/blob` dengan
   `addRandomSuffix: false` supaya URL-nya stabil).
5. Set env var `SYNC_KEY` = isi `sync-key.txt` (production + preview).
   [DICABUT 17 Nov 2026 20:47 WIB: kunci tulis tidak bisa disembunyikan di
   halaman statis — audit keamanan artifact menolak kunci di kode klien —
   jadi syarat kunci dihapus dari server dan env var SYNC_KEY dihapus dari
   project. Daftar kini bisa diedit siapa pun yang punya link; backup
   otomatis (members-prev.json) jadi pengaman timpaan salah.]
6. Redeploy supaya env var berlaku, lalu cek `GET https://<host>/api/health`
   → `{ ok: true }` dan `GET /api/members` → 3 admin awal.
7. Catat URL `https://<host>/api/members` + key — dipakai saat update
   aplikasi (artifact `citra-plaza-pride`) supaya ambil/tulis daftar ke
   server ini, dengan localStorage sebagai fallback saat offline.

## File

- `api/members.js` — GET/POST daftar bersama.
- `api/health.js` — health check.
- `seed.json` — 3 admin awal.
- `sync-key.txt` — (mode 600) key tulis. Jangan commit ke repo publik.
