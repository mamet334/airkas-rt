# MANTRA ANTIGRAVITY: AIRKAS RT
**Update Terakhir:** 15 Juni 2026

## 1. Info Sistem
- **Stack:** React.js, Vite, Tailwind CSS, Supabase (Database Utama)
- **Local:** `d:\SLAMET\other\PDAM\pam z ai\airkas-react`
- **Vercel Deploy:** `d:\SLAMET\other\PDAM\vercel pam\airkas-vercel\airkas-react`
- **URL Live:** https://airkas-rt.vercel.app

## 2. Status Terbaru (Selesai)
1. **Penghapusan PWA & Mode Offline (100% Online System):**
   - Service Worker (`sw.js`), `manifest.json`, serta seluruh mekanisme *Sync Queue* offline telah dicabut total. Aplikasi langsung mengambil dan menyimpan data segar dari Supabase secara *real-time*.
2. **Sinkronisasi Siklus Keuangan 15-14:**
   - Semua elemen *Dashboard* dan *Laporan Keuangan* telah disesuaikan agar membaca periode/siklus "Tanggal 15 (Bulan Sebelumnya) s/d Tanggal 14 (Bulan Berjalan)".
3. **Pembersihan Logika Tagihan Air vs Kas Lain:**
   - Memastikan bahwa *record* dummy (`warga.alamat === 'SISTEM'`) yang diciptakan untuk menerima Pemasukan Lain/Patungan secara permanen dieksklusi dari total **Tagihan Air**.
4. **Perbaikan *Runtime Error* List Warga:**
   - (Penting!) Logika iterasi daftar riwayat dan tagihan pada *Dashboard*, *Laporan Keuangan*, dan *Pembayaran* sekarang memindai **seluruh warga aktif** (`state.warga`), bukan lagi data bulanan meteran (`mtrBln`). Ini penting agar warga yang menunggak dari bulan lalu (dan belum ada data meteran bulan berjalan) tetap muncul.

## 3. SOP Wajib & Aturan Utama (Jangan Dilanggar!)
1. **Asimetri Filter Data (Pembayaran vs Pengeluaran):** 
   - **Terima Bayar (`pembayaran`):** Harus difilter secara statis lewat variabel pilihan form/dropdown (`p.bulan === b && p.tahun === t`). Jangan gunakan filter *range* tanggal murni (seperti `filterByrBySiklus`), karena akan menghilangkan pembayaran yang dilakukan tepat di batas akhir (tanggal 15) namun ditujukan untuk tagihan bulan yang dipilih.
   - **Pengeluaran (`pengeluaran`):** Karena tidak memiliki kolom spesifik `.bulan`, data pengeluaran **HARUS** difilter secara ketat berdasarkan tanggal aslinya menggunakan siklus 15-14 (`filterKlrBySiklus` atau `getCycleMonthYear(k.tanggal)`).
2. **Kehati-hatian Pada Data Asinkron di React:**
   - Saat memetakan data dengan operator relasional, SELALU gunakan *optional chaining* atau ternary check untuk `m` (seperti `m ? m.total_tagihan : 0`) guna mencegah *blank screen error*.
3. **Audit Saldo jika Terjadi Kejanggalan Angka:**
   - Jika pengguna melaporkan selisih "tombok" (kas minus), selalu periksa terlebih dahulu selisih dari dana Patungan Mesin (jika biaya lebih besar dari hasil pungutan) atau adanya suntikan "Kas Lain" yang bukan merupakan uang fisik. Gunakan *script* `cek_saldo.cjs` dan `dump_kas_lain.cjs` untuk audit mendalam.
4. **Prosedur Deploy ke Vercel (PENTING untuk Andre Anastasya):**
   - Hapus & Salin ulang *source code*: `Remove-Item -Path "..\vercel pam\airkas-vercel\airkas-react\src" -Recurse -Force; Copy-Item -Path "src" -Destination "..\vercel pam\airkas-vercel\airkas-react\src" -Recurse -Force`
   - Salin file publik: `Copy-Item -Path "index.html" -Destination "..\vercel pam\airkas-vercel\airkas-react\index.html" -Force`
   - Buka direktori Vercel: `Set-Location "..\vercel pam\airkas-vercel\airkas-react"`
   - Jalankan rilis produksi: `npx vercel --prod --yes`

## 4. Rencana Kerja Selanjutnya
- Evaluasi rutin konsistensi pembukuan kas melalui cek berkala di *Audit Log* dan alat `cek_saldo.cjs`.
- Pantau konektivitas di lapangan saat Ketua RT menarik/mengisi tagihan secara langsung menggunakan *browser*.

*End of Mantra.*
