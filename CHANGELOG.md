# Changelog

Semua perubahan penting pada Nongki dicatat di sini.
Format mengikuti [Keep a Changelog](https://keepachangelog.com/id/1.1.0/), dikelompokkan per tanggal rilis (WIB).

## [2026-11-26]

### Ditambahkan
- **Menu dari foto** di halaman edit tempat (admin): pilih foto menu dari galeri Google Maps atau unggah foto (dikecilkan di browser), lalu nama + harga dibaca otomatis.
  - Mesin utama: model vision lewat **Vercel AI Gateway** (default `google/gemini-3-flash`, bisa diganti env `MENU_MODEL`), output terstruktur (kategori, nama, harga Rupiah, varian).
  - Cadangan: **OCR di browser** (tesseract.js) + parser harga Indonesia (`25K`, `25rb`, `25.000`) bila AI tidak tersedia.
  - Tabel hasil bisa diedit/dihapus/ditambah sebelum disimpan, mode **Gabungkan** atau **Ganti semua** (ketik `GANTI`). Harga Americano yang sudah ada tidak ditimpa kecuali dicentang.
  - Endpoint khusus admin, dibatasi 20×/10 menit, maks. 6 foto / 4 MB.
- **Bagian "Menu & harga"** di halaman tempat: dikelompokkan per kategori, cari menu, filter kategori & harga (≤ Rp15rb / ≤ Rp25rb), keterangan sumber & tanggal harga.
- Menu hasil pembacaan foto galeri Maps untuk KOPI TRiC (47 item), Semat Space (5 item) dan NOGO KELING 4.0 SUZURAN (4 item dari struk) — data di `docs/menu-maps/`, skrip `scripts/apply-menus.mjs`.
- API `POST /api/admin/places/:id/menu` (tambah/ganti menu tanpa menyentuh WiFi & data lain).

### Diubah
- Item menu punya field opsional `category` dan `source`; skema backup naik ke **v3** (file v2 tetap bisa diimpor).
- Pratinjau impor backup membandingkan data tanpa terpengaruh urutan field (sebelumnya bisa salah menghitung "berubah").

## [2026-11-25]

### Ditambahkan
- **Backup & pemulihan di admin** (`/admin/backup`):
  - Ekspor seluruh data ke `.json` (tempat, WiFi + password, harga, hasil speedtest) dan daftar tempat ke `.csv`.
  - Impor `.json` dengan pratinjau perubahan, mode **Gabungkan** atau **Ganti semua** (wajib ketik `GANTI`).
  - Snapshot otomatis sebelum setiap impor/pemulihan, riwayat backup (unduh, pulihkan dengan `PULIHKAN`, hapus) dan tombol **Buat backup sekarang**.
  - Rotasi: 30 snapshot otomatis dan 50 manual terakhir disimpan. Semua rute backup hanya untuk admin.
- **Gambar kotak 1:1** (`/tempat/[slug]/square.png`) untuk status WA, feed IG/FB dan X.
- Pilihan format **Story 9:16 / Kotak 1:1** dan tombol **Simpan gambar** di lembar bagikan.

### Diubah
- **Gambar story & preview link (OG)** didesain ulang agar tidak kepotong: isi penting di zona aman IG/WA, posisi blok tetap, nama panjang mengecil otomatis, harga dipersingkat (mis. `Rp1–25rb`), kotak statistik sama tinggi, data kosong tampil rapi.
- Share story hanya mengirim gambar dan menyalin link untuk stiker link.

## [2026-11-18]

### Diubah
- **Beranda lebih ringkas di HP:** bar atas sticky yang tipis, judul satu baris, tombol lokasi di dalam kolom cari, kategori jadi chip yang bisa digeser, tambahan chip **Americano murah**.
- Area sentuh minimal 44px dan konten aman dari bar bawah serta area home indicator iPhone.

## [2026-11-16]

### Ditambahkan
- Rilis awal: rekomendasi tempat ngopi & nongkrong, daftar tempat, peta, cek kecepatan internet, simpan banyak WiFi per tempat.
- Admin menambah tempat cukup dengan menempelkan link Google Maps (nama, alamat, koordinat, rating, jam buka, harga, foto).
- Galeri foto lebih banyak dari Google Maps.
- Speedtest dari admin dan sesi multi-tes (1/3/5 tes) yang hasilnya disimpan.
- Harga Americano & menu, urutan **Americano termurah** dan filter **≤ Rp20rb**.
- Panel **WiFi details**: rentang download/upload/ping, jitter, packet loss, variabilitas, jumlah tes per sesi, tes terakhir (WIB).
- Favicon & ikon PWA, preview link OG/Twitter dinamis, gambar Story WA/IG dengan QR.
- **Cari terdekat** dari lokasi pengguna.
- Link share, preview dan QR mengikuti domain yang sedang dibuka (`nongki-malang.vercel.app` / `nongki.bangundwir.my.id`).
- README lengkap.

### Diperbaiki
- Upload speed test memakai `Content-Type: application/octet-stream`.
- Cache gambar OG/story dipisah per domain lewat parameter `h`, sehingga cache CDN aktif lagi.
- Teks share untuk Telegram dan aplikasi lain tidak lagi berisi tanda `*`.
- Halaman edit admin tidak lagi error 500.

### Dihapus
- Data contoh, diganti data asli saja.
