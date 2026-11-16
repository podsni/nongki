# ☕ Nongki — Rekomendasi tempat ngopi & nongkrong + cek WiFi

Nongki adalah web app untuk mencari tempat ngopi/nongkrong (fokus Malang) lengkap dengan **galeri foto dari Google Maps**, **harga Americano**, **daftar WiFi + password**, dan **tes kecepatan internet langsung dari browser** yang hasilnya tersimpan per tempat dan diringkas menjadi panel **WiFi details** (rentang kecepatan, jitter, packet loss, variabilitas, sesi tes).

- 🌐 Produksi: **https://nongki-malang.vercel.app**
- 🔐 Admin: **https://nongki-malang.vercel.app/admin**
- 🎨 Desain Figma: https://www.figma.com/design/yb6hbJMBb4KYaQDQLsAGiD
- 📦 Repo (publik): https://github.com/podsni/nongki

> _English summary: Nongki is a Next.js app for discovering coffee shops. Admins add a place by pasting a Google Maps link (name, address, rating, hours, photos are scraped automatically), manage multiple WiFi networks per place, and run in-browser speed tests whose results drive a Fast/Medium/Slow badge. Data is stored as a JSON document in a private Vercel Blob store._

---

## Daftar isi

1. [Fitur](#fitur)
2. [Screenshot](#screenshot)
3. [Tech stack](#tech-stack)
4. [Arsitektur & penyimpanan data](#arsitektur--penyimpanan-data)
5. [Environment variables](#environment-variables)
6. [Menjalankan di lokal](#menjalankan-di-lokal)
7. [Deploy ke Vercel](#deploy-ke-vercel)
8. [Panduan admin](#panduan-admin)
9. [Cara kerja tes kecepatan](#cara-kerja-tes-kecepatan)
10. [API routes](#api-routes)
11. [Struktur folder](#struktur-folder)
12. [Keterbatasan](#keterbatasan)

---

## Fitur

### Untuk pengunjung
| Halaman | Isi |
|---|---|
| **Beranda** (`/`) | Pencarian, tombol **Cari terdekat dari lokasiku**, bagian **Terdekat dari kamu** (4 tempat terdekat + jarak), kategori (Kopi, WFC, Nongkrong, 24 Jam, Murah), rekomendasi, "WiFi paling kencang", "Buka 24 jam". |
| **Jelajah** (`/jelajah`) | Cari, filter kategori / WiFi ≥ 30 Mbps / ada colokan / Americano ≤ Rp20rb, urutkan (rating, kecepatan internet, buka 24 jam, **Americano termurah**, harga termurah, **Terdekat**), panel **Cari terdekat** dengan filter **radius ≤ 1/3/5/10 km**, jarak di tiap kartu, tampilan **List** atau **Peta** (Leaflet + OpenStreetMap, titik lokasimu + lingkar akurasi & radius). State filter tersimpan di URL. |
| **Detail tempat** (`/tempat/[slug]`) | Galeri foto (carousel geser di HP, grid 1+4 di desktop, lightbox dengan swipe & keyboard), status **buka/tutup sekarang**, alamat, jam buka (hari ini disorot), harga, **harga Americano** (+ ukuran & tanggal terakhir dicek) dan harga menu lain, telepon, jarak dari lokasimu, tombol **Rute** (Google Maps) & **Bagikan** (lembar bagikan: **Bagikan ke Story** WA/IG, WhatsApp, Telegram, X, Facebook, salin link, menu bagikan bawaan), fasilitas, ringkasan internet, panel **WiFi details** per tempat, **semua WiFi** (salin SSID, tampil/sembunyi & salin password, **WiFi details per jaringan**), riwayat speed test. |
| **Cek Speed** (`/cek-speed`) | Tes ping, jitter, packet loss, download, upload dengan gauge; hasil bisa disimpan ke tempat + WiFi yang dipakai. |

Badge kecepatan (rata-rata 5 tes terakhir): **Cepat ≥ 30 Mbps**, **Sedang 10–30 Mbps**, **Lambat < 10 Mbps**.

### Panel WiFi details
Dihitung otomatis dari hasil tes yang tersimpan — per jaringan WiFi dan gabungan per tempat (`lib/wifistats.ts`). Contoh tampilan:

```
WIFI DETAILS
Rentang download   29,8–91,8 Mbps      Rentang upload  30,7–54,9 Mbps
Rentang ping       30,9–37,5 ms        Jitter · loss   4,5 ms · 1,7%
Variabilitas       sedang              Jumlah tes      5 dalam 1 sesi
Tes terakhir       2026-10-20 13:53–13:55 WIB
```
_(angka di atas hanya contoh format)_

| Baris | Cara hitung |
|---|---|
| Rentang download / upload / ping | nilai minimum–maksimum dari semua tes |
| Jitter · loss | rata-rata jitter (ms) · rata-rata packet loss (%) |
| Variabilitas | koefisien variasi (simpangan baku ÷ rata-rata) download: **rendah** < 0,15 ≤ **sedang** < 0,35 ≤ **tinggi**; butuh ≥ 2 tes |
| Jumlah tes | `N dalam M sesi`; tes yang berjarak ≤ 30 menit dari tes sebelumnya = satu sesi |
| Tes terakhir | rentang waktu sesi terakhir dalam WIB (Asia/Jakarta) |

### Bagikan, preview link & Story

- **Preview link** (WhatsApp, IG DM, Telegram, X, Facebook, LinkedIn): setiap halaman punya `og:title`, `og:description`, `og:url` absolut, `og:locale=id_ID`, `og:image` **1200×630 JPEG** (± 40–120 KB, `og:image:width/height/type/alt`) + Twitter `summary_large_image`. Gambar dibuat dinamis dengan `next/og` lalu dikompres `sharp`:
  - `/og/home.jpg`, `/og/jelajah.jpg` — branding + kolase foto tempat.
  - `/tempat/[slug]/og.jpg` — foto sampul, nama, area, rating, **harga Americano**, **badge kecepatan WiFi**, buka 24 jam. URL diberi `?v=` (hash `updatedAt` + jumlah tes) agar cache WhatsApp/FB ikut berganti saat data berubah.
- **Gambar Story** `/tempat/[slug]/story.png` — **1080×1920 PNG** berisi foto, nama, rating, status buka, Americano, rentang download, upload/ping, tes terakhir (WIB), dan **QR code** + link pendek. Konten penting di area aman story (tidak tertutup UI IG/WA). Tambahkan `?download=1` untuk mengunduh.
- **Tombol "Bagikan ke Story"** memakai **Web Share API Level 2** (`navigator.canShare({ files })`) sehingga di HP muncul menu bagikan → pilih **Instagram (Story)** atau **WhatsApp (Status)**. Link ikut disalin untuk ditempel sebagai **stiker Link**. Jika browser tidak bisa membagikan file (mis. desktop), gambar **diunduh** otomatis + link disalin.
- **Link share mengikuti domain yang dibuka**: dibuka di `nongki.bangundwir.my.id` → `og:url`, `canonical`, `og:image`, teks WhatsApp/Telegram/X/FB, salin link, serta QR & link di gambar story/OG memakai `nongki.bangundwir.my.id`; dibuka di `nongki-malang.vercel.app` → memakai domain itu. Domain diambil dari header `x-forwarded-host`/`host` dan **dicek ke allowlist** (`nongki-malang.vercel.app`, `nongki.bangundwir.my.id`, + env `ALLOWED_HOSTS="a.com,b.com"`); host lain (mis. preview Vercel atau header palsu) jatuh ke `NEXT_PUBLIC_SITE_URL`. Di browser, lembar bagikan memakai `window.location.origin`.
- **Teks share WhatsApp** rapi: nama (tebal), rating & area, harga Americano, WiFi ± Mbps & ping, buka 24 jam, lalu link.

### Cari terdekat (lokasi langsung)

- Memakai **Geolocation API** browser (muncul prompt izin). Jarak dihitung **haversine** di browser, urut dari yang terdekat.
- **Lokasi tidak pernah dikirim/disimpan di server** — hanya di memori + `sessionStorage` tab itu (maks. 30 menit), bisa dihapus dengan **Lupakan**.
- Jika izin sudah pernah diberikan, lokasi diambil otomatis tanpa prompt. Pesan jelas untuk izin ditolak, GPS mati, timeout, browser tidak mendukung, atau bukan https.

### Ikon & PWA

- Favicon **SVG** (`app/icon.svg`) + `favicon.ico` (16/32/48), `apple-icon.png` 180×180, ikon PWA 192/512 (biasa & **maskable**) di `public/icons/`, `manifest.webmanifest` (nama, warna tema espresso `#2b1a12`, shortcut _Cari terdekat_ & _Cek speed_). Semua dibuat dari satu sumber: `node scripts/icons.mjs`.

### Untuk admin (`/admin`)
- Login dengan password (`ADMIN_PASSWORD`), sesi berupa cookie **httpOnly** bertanda tangan HMAC (7 hari), percobaan login dibatasi 8×/10 menit per IP.
- **Tambah tempat cukup dengan link Google Maps** (link pendek `maps.app.goo.gl/…` atau link penuh) → data terisi otomatis → admin bisa melengkapi sebelum simpan.
- **Galeri**: semua foto yang bisa diambil dari Maps (biasanya 20–40+), duplikat dibuang otomatis. Admin bisa menghapus foto, memilih sampul, menambah URL foto sendiri, atau **"Ambil ulang dari Maps"**.
- **Banyak WiFi per tempat** (SSID, password, catatan/lokasi mis. "lantai 2").
- **Harga Americano** (Rp, ukuran/catatan, tanggal terakhir dicek) + **harga menu lain** opsional.
- Kategori, fasilitas, jam buka, harga, koordinat, dll.
- **Tes kecepatan langsung dari halaman admin** per tempat, bisa **sesi multi-tes (1×/3×/5×)**; semua hasil sesi disimpan sekaligus dengan label _"Diukur admin di lokasi"_, langsung masuk riwayat, panel WiFi details & badge.
- Hapus tempat dan hapus hasil tes yang keliru.

---

## Screenshot

| HP (375 px) | Desktop (1440 px) |
|---|---|
| ![Beranda HP](docs/screenshots/beranda-375.png) | ![Beranda desktop](docs/screenshots/beranda-1440.png) |
| ![Detail HP](docs/screenshots/detail-375.png) | ![Detail desktop](docs/screenshots/detail-1440.png) |
| ![Galeri HP](docs/screenshots/lightbox-375.png) | ![Peta desktop](docs/screenshots/peta-1440.png) |
| ![Cek speed HP](docs/screenshots/cek-speed-375.png) | ![Admin speedtest](docs/screenshots/admin-speedtest-1440.png) |

---

## Tech stack

- **Next.js 16 (App Router)** + **React 19**, TypeScript, server components + route handlers
- **Tailwind CSS v4** (token warna dari desain Figma: espresso, caramel, cream, mint)
- Font **Plus Jakarta Sans** (teks) & **Fraunces** (logo/angka display) via `next/font`
- **Leaflet** + **react-leaflet** + tile **OpenStreetMap** (tanpa API key)
- **@vercel/blob** (private store) sebagai penyimpanan data
- Tes kecepatan: endpoint publik **Cloudflare speed** (`speed.cloudflare.com/__down` & `__up`) dengan fallback ke API sendiri
- Hosting: **Vercel** (auto-deploy dari branch `main`)

---

## Arsitektur & penyimpanan data

```
Browser ──► Next.js (Vercel Functions)
              ├─ halaman (server components, dynamic)
              ├─ /api/admin/*  (dicek cookie admin)
              ├─ /api/speed/*  (ping/down/up/results)
              └─ lib/db.ts ──► Vercel Blob (private): nongki/db.json
                               └─ fallback lokal: .data/db.json
```

- Seluruh data ada di **satu dokumen JSON** (`nongki/db.json`) di **Vercel Blob privat**:
  ```ts
  { version: 2, places: Place[], speeds: SpeedResult[] }
  ```
  - `Place`: nama, slug, alamat, area, lat/lng, rating, ulasan, harga, jam buka, kategori, fasilitas, `photos[]` (galeri; `photoUrl` = sampul), `wifi[]` ({ id, ssid, password, note }), `menu[]` ({ id, item, price, note, checkedAt } — Americano = item yang namanya mengandung "americano"), link Maps.
  - `SpeedResult`: placeId, wifiId (opsional), down/up (Mbps), ping/jitter (ms), `loss` (%), server, `by` (`admin` | `pengunjung`), waktu tes.
- Tulis data memakai pola read-modify-write yang diserialkan per instance (`mutateDB`). Cukup untuk trafik kecil; lihat [Keterbatasan](#keterbatasan).
- Tanpa `BLOB_READ_WRITE_TOKEN`, data disimpan ke `.data/db.json` (otomatis dibuat, di-ignore git).
- **Tidak ada data contoh/seed**: database baru selalu kosong, isi lewat admin.
- Kenapa bukan Postgres? Saat proyek dibuat, provisioning Neon/Upstash lewat Marketplace butuh persetujuan manual di dashboard; Blob bisa dibuat & disambungkan langsung. Mengganti `lib/db.ts` ke Postgres/Redis cukup mengubah `loadDB`/`saveDB`.

### Import dari Google Maps (`lib/maps.ts`)
1. Ikuti redirect link pendek (maks. 8 hop) → URL `google.com/maps/...`.
2. Baca nama/koordinat dari URL (`/place/…`, `!3d!4d`, `@lat,lng`, `q=`), ambil `ftid`.
3. Buka halaman Maps, cari URL internal `maps/preview/place?...pb=...`, ambil JSON-nya (prefix `)]}'` dibuang).
4. Ekstrak: nama, alamat, koordinat, rating, jumlah ulasan, kategori Google, jam buka per hari, telepon, website, kisaran harga.
5. **Foto**: kumpulkan semua URL `lh*.googleusercontent.com` dari bagian sampul, galeri kategori, dan foto ulasan tempat itu saja; tiap foto diunduh sebagai thumbnail 24×24 lalu di-hash (SHA-1) untuk membuang duplikat; maks. 48 foto.
6. Kategori Nongki ditebak dari kategori Google, jam 24 jam, dan level harga.

---

## Environment variables

| Nama | Wajib | Keterangan |
|---|---|---|
| `ADMIN_PASSWORD` | ✅ | Password login `/admin`. Gunakan string acak panjang. |
| `SESSION_SECRET` | disarankan | Kunci HMAC cookie sesi. Jika kosong memakai `ADMIN_PASSWORD`. Mengganti nilainya = semua sesi admin logout. |
| `BLOB_READ_WRITE_TOKEN` | produksi | Dibuat otomatis oleh Vercel saat Blob store disambungkan ke project. Tanpa ini → file lokal. |

Contoh ada di [`.env.example`](.env.example). **Jangan pernah commit nilai aslinya.**

---

## Menjalankan di lokal

Butuh Node.js 20+ (disarankan 22).

```bash
git clone https://github.com/podsni/nongki.git
cd nongki
npm install
cp .env.example .env.local      # isi ADMIN_PASSWORD (dan SESSION_SECRET)
npm run dev                     # http://localhost:3000
```

- Tanpa `BLOB_READ_WRITE_TOKEN` data tersimpan di `.data/db.json`.
- Untuk memakai Blob produksi dari lokal: `vercel env pull .env.local` (hati-hati, ini data asli).
- Build produksi: `npm run build && npm start`. Lint: `npm run lint`.

---

## Deploy ke Vercel

1. Push repo ke GitHub, lalu **Import Project** di Vercel (framework: Next.js, tanpa setting tambahan).
2. **Storage → Create → Blob**, pilih akses **Private**, region dekat pengguna (mis. `sin1`), lalu **Connect** ke project → `BLOB_READ_WRITE_TOKEN` terisi otomatis.
3. **Settings → Environment Variables**: tambahkan `ADMIN_PASSWORD` dan `SESSION_SECRET` (tipe _Sensitive_, Production + Preview).
4. Deploy. Setiap push ke `main` otomatis deploy ke produksi.
5. (Opsional) **Settings → Domains** untuk domain publik. Domain `*-<team>.vercel.app` bawaan bisa terkena _Deployment Protection_; domain produksi tambahan (mis. `nongki-malang.vercel.app`) bisa diakses publik.
6. (Opsional) **Settings → Functions → Region** ke `sin1` agar lebih cepat dari Indonesia.

---

## Panduan admin

### Masuk
Buka `/admin`, masukkan password. Tombol **Keluar** ada di kanan atas.

### Menambah tempat dari Google Maps
1. Di aplikasi Google Maps: buka tempatnya → **Bagikan** → **Salin link** (`https://maps.app.goo.gl/...`).
2. Admin → **Tambah dari Google Maps** → tempel link → **Ambil data**.
3. Kotak hijau menampilkan data apa saja yang berhasil diambil (mis. `nama · alamat · koordinat · rating · jam buka · 35 foto · harga`) dan peringatan jika ada.
4. Lengkapi: **WiFi**, **fasilitas**, kategori, deskripsi. Cek galeri, pilih sampul, hapus foto yang tidak relevan.
5. **Simpan tempat** → diarahkan ke halaman edit.

> Tip: kalau link tidak terbaca, pakai link dari tombol **Bagikan** di app Maps (link pendek berisi `ftid`). Bisa juga **Isi manual tanpa link**.

### Mengelola galeri
- **Ambil ulang dari Maps** — mengambil foto terbaru dari link Maps tempat itu (foto manual tetap disimpan). Klik **Simpan perubahan** setelahnya.
- **Sampul** — jadikan foto sebagai sampul (foto pertama).
- **×** — hapus foto. **Tambah** — tempel URL foto `https://` sendiri.

### Banyak WiFi dalam satu tempat
Di kartu **WiFi di tempat ini** klik **Tambah WiFi** sebanyak yang perlu. Isi:
- **Nama WiFi (SSID)** — wajib,
- **Password** — kosongkan jika WiFi terbuka,
- **Catatan / lokasi** — mis. "lantai 2", "area outdoor", "khusus pelanggan".

Baris tanpa SSID diabaikan saat simpan. Maksimal 30 WiFi per tempat.

### Harga Americano & menu
Di kartu **Harga menu**: isi harga Americano (angka saja, otomatis berformat Rp), ukuran/catatan (mis. "12 oz, panas"), dan **Terakhir dicek** (tombol _Hari ini_). Tambah menu lain dengan **Tambah harga menu lain**. Kosongkan harga untuk menghapus. Harga Americano tampil di kartu tempat, halaman detail, dan bisa dipakai untuk urutan **Americano termurah** / filter **Americano ≤ Rp20rb** di Jelajah.

### Tes kecepatan dari admin
1. Datang ke lokasi dan sambungkan HP/laptop ke WiFi tempat itu.
2. Admin → tombol **Tes speed** pada kartu tempat (atau **Tes kecepatan** di halaman edit).
3. Pilih **Jumlah tes per sesi** (1×, 3×, atau 5×), lalu **Jalankan N tes** (±15–20 detik per tes). Pilih WiFi yang dipakai pada "Diukur di WiFi mana?".
4. Lihat pratinjau **WiFi details — sesi ini** dan tabel tiap tes, lalu **Simpan N hasil ke tempat ini** → semua hasil masuk riwayat (label _Admin_), panel WiFi details jaringan itu, dan badge tempat.
5. Hasil yang salah bisa dihapus dari **Riwayat tes kecepatan** (ikon tempat sampah).

> Penting: ukur hanya saat benar-benar tersambung ke WiFi tempat tersebut. Tes dari rumah/kantor/data seluler akan membuat badge menyesatkan.

---

## Cara kerja tes kecepatan

Semua berjalan di browser pengunjung (`components/SpeedTest.tsx`):

| Tahap | Metode |
|---|---|
| Ping, jitter & loss | 20 request kecil berurutan (+1 pemanasan), timeout 1,5 dtk. Ping = median, jitter = rata-rata selisih antar ping, **loss** = % request yang gagal/timeout. |
| Download | 4 koneksi paralel selama ±8 detik (6 detik di sesi multi-tes), 1,2 detik pertama dibuang (slow-start). |
| Upload | 3 koneksi paralel `XMLHttpRequest` (progress upload) selama ±7 detik (5 detik di sesi multi-tes). |
| Server | Cloudflare (server terdekat, CORS terbuka); jika gagal otomatis pindah ke `/api/speed/*` milik Nongki. |

Satu tes memakai sekitar 50–150 MB kuota (tergantung kecepatan).

---

## API routes

| Method & path | Auth | Fungsi |
|---|---|---|
| `GET /og/home.jpg`, `/og/jelajah.jpg` | publik | Gambar Open Graph 1200×630 (JPEG). |
| `GET /tempat/:slug/og.jpg` | publik | Gambar Open Graph tempat 1200×630 (JPEG). |
| `GET /tempat/:slug/story.png` | publik | Gambar story 1080×1920 (PNG), `?download=1` untuk unduh. |
| `GET /api/places` | publik | Daftar tempat + rata-rata kecepatan (tanpa detail password WiFi, hanya jumlah). |
| `GET /api/speed/ping` | publik | Respons kecil untuk ukur ping. |
| `GET /api/speed/down?bytes=N` | publik | Stream data acak (maks. 25 MB). |
| `POST /api/speed/up` | publik | Menerima & menghitung byte upload, balas `{ bytes, ms }`. |
| `POST /api/speed/results` | publik (6×/10 mnt/IP) | Simpan 1 hasil tes pengunjung `{ placeId, wifiId?, server, results: [{ down, up, ping, jitter, loss, at }] }`. |
| `POST /api/admin/login` | — | `{ password }` → set cookie sesi. |
| `POST /api/admin/logout` | admin | Hapus cookie. |
| `POST /api/admin/import` | admin | `{ url }` → draft data dari Google Maps (termasuk `photos[]`, `extracted[]`, `warnings[]`). |
| `POST /api/admin/places` | admin | Buat tempat. |
| `PUT /api/admin/places/:id` | admin | Ubah tempat (termasuk `wifi[]`, `photos[]`). |
| `DELETE /api/admin/places/:id` | admin | Hapus tempat + riwayat tesnya. |
| `GET /api/admin/places/:id` | admin | Data lengkap satu tempat + semua hasil tes. |
| `POST /api/admin/speeds` | admin | Simpan 1–10 hasil tes satu sesi (format sama dengan di atas; label "Diukur admin"). |
| `DELETE /api/admin/speeds/:id` | admin | Hapus satu hasil tes. |

Contoh:
```bash
curl -c jar -X POST https://nongki-malang.vercel.app/api/admin/login \
  -H 'content-type: application/json' -d '{"password":"…"}'
curl -b jar -X POST https://nongki-malang.vercel.app/api/admin/import \
  -H 'content-type: application/json' -d '{"url":"https://maps.app.goo.gl/…"}'
```

---

## Struktur folder

```
app/
  page.tsx                 Beranda
  jelajah/                 List + peta
  tempat/[slug]/           Detail tempat (+ og.jpg & story.png route)
  og/                      Gambar Open Graph beranda & jelajah
  icon.svg, favicon.ico, apple-icon.png, manifest.ts   Ikon & PWA
  cek-speed/               Tes kecepatan publik
  admin/                   Login, daftar, tambah (import), edit + speedtest
  api/                     Route handlers (lihat tabel API)
components/
  Gallery.tsx              Hero galeri, grid, lightbox (swipe/keyboard)
  SpeedTest.tsx            Tes kecepatan (mode publik & admin, sesi multi-tes)
  WifiDetails.tsx          Panel statistik WiFi details
  Explorer.tsx, MapView.tsx  Jelajah + peta Leaflet
  PlaceClient.tsx          Daftar WiFi (salin/tampil password)
  ShareSheet.tsx           Lembar bagikan (Story WA/IG, WhatsApp, Telegram, X, FB)
  geo.ts, Nearby.tsx, Distance.tsx  Lokasi (client-only), Terdekat dari kamu, jarak
  admin/                   LoginForm, ImportFlow, PlaceForm (WiFi & foto editor)
lib/
  db.ts                    Baca/tulis JSON (Blob / file lokal) + migrasi ringan
  places.ts                CRUD tempat & hasil tes, validasi input
  maps.ts                  Import Google Maps (data + galeri foto)
  auth.ts, guard.ts        Sesi admin (HMAC cookie)
  util.ts                  Format (Mbps, Rp, tanggal), level kecepatan, status buka, ukuran foto
  wifistats.ts             Statistik WiFi details: rentang, sesi, variabilitas
  types.ts, form.ts        Tipe data & konversi form
  site.ts                  URL situs, metadata OG/Twitter, teks share
  og.tsx                   Render gambar OG & story (next/og + sharp + QR)
assets/fonts/              Plus Jakarta Sans & Fraunces (TTF) untuk gambar OG
scripts/icons.mjs          Generator favicon/ikon PWA
```

---

## Keterbatasan

- **Import Google Maps memakai scraping** data internal halaman Maps (tidak resmi). Bisa berhenti bekerja jika Google mengubah format atau memblokir IP server; data yang gagal diambil tetap bisa diisi manual.
- **Foto di-hotlink** dari `googleusercontent.com` (tidak disalin ke storage sendiri). Jika Google menghapus/mengganti foto, gambar bisa hilang → gunakan **Ambil ulang dari Maps**.
- **Password WiFi tampil publik** di halaman detail (memang tujuan fitur salin password). Jangan simpan password yang tidak boleh diketahui umum.
- **Penyimpanan satu file JSON** di Blob: dua penulisan yang benar-benar bersamaan dari instance berbeda bisa saling menimpa. Cukup untuk skala kecil; pindah ke Postgres untuk skala besar.
- **Packet loss adalah estimasi** di level HTTP (request ping yang gagal/timeout), bukan ICMP; browser tidak bisa mengukur loss paket mentah.
- **Harga menu diisi manual** oleh admin (Google Maps tidak menyediakan harga per menu); tanggal _terakhir dicek_ membantu menilai kebaruannya.
- **Preview link di-cache** oleh WhatsApp/Facebook/Telegram; perubahan data baru terlihat saat link dibagikan ulang (URL gambar ber-versi membantu, tapi cache halaman bisa bertahan beberapa hari). Debug: [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/).
- **Bagikan ke Story** bergantung pada dukungan Web Share file di browser HP (Chrome Android & Safari iOS 15+); Instagram/WhatsApp harus terpasang. Di desktop gambar diunduh.
- **Lokasi** butuh izin & https; akurasi tergantung perangkat (Wi-Fi/GPS). Tempat tanpa koordinat tidak ikut dihitung jaraknya.
- **Hasil tes pengunjung tidak diverifikasi** (hanya dibatasi per IP). Admin dapat menghapus hasil yang janggal; hasil admin diberi label.
- Akurasi tes bergantung pada browser & perangkat; fallback server Nongki (Vercel) kurang akurat dibanding Cloudflare.
- Tile peta OpenStreetMap tunduk pada kebijakan fair-use OSM.
