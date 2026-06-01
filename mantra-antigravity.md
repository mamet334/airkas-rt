# MANTRA ANTIGRAVITY: AIRKAS RT
**Update Terakhir:** 1 Juni 2026

## 1. Info Sistem
- **Stack:** React.js, Vite, Tailwind CSS, Supabase (Database Utama)
- **Local:** `d:\SLAMET\other\PDAM\pam z ai\airkas-react`
- **Vercel Deploy:** `d:\SLAMET\other\PDAM\vercel pam\airkas-vercel\airkas-react`
- **URL Live:** https://airkas-rt.vercel.app

## 2. Status Terbaru (Selesai)
1. **Sync Database `telepon`:** Kolom `telepon` sudah tersinkronisasi murni dengan Supabase, filter pembuangan nomor otomatis sudah dicabut.
2. **Perbaikan Transaksi Kas Lain:** 
   - Konversi ID `warga` menjadi Integer sebelum masuk Supabase.
   - Sinkronisasi pengambilan `id` meteran dummy secara real-time untuk mencegah *UUID error* pada tabel pembayaran Supabase.
3. **Bug Audit Log Menghilang:**
   - Menghapus kolom `username` pada *payload* Audit Log karena Supabase menolak data kolom tidak dikenal, yang sebelumnya merusak proses save cloud. 
4. **Desain Ulang Dashboard:** 
   - Memisahkan **Pendapatan Air (A)** dan **Pemasukan Lain (B)**.
   - Menambahkan catatan rumus transparan di tiap kartu Total Pemasukan & Saldo Kas RT.
5. **Dashboard Interaktif & Optimasi Performa Jangka Panjang:**
   - Seluruh kartu statistik dapat diklik untuk memunculkan Modal Detail transaksi beserta penjumlahan otomatis per-kategori.
   - Mengalihkan perhitungan Saldo Total (Seluruh Waktu) ke Supabase RPC (`get_rekap_kas_total`) untuk akurasi mutlak.
   - Membatasi penarikan riwayat transaksi di aplikasi HP (maksimal 2.000 data) agar aplikasi selamanya ringan tanpa harus merusak/menghapus data masa lalu.
6. **Optimasi Laporan Keuangan (Cetak & Share):**
   - Mengatasi *bug* Firefox memotong PDF dengan menyuntikkan `print:overflow-visible` secara global.
   - Memperbaiki kotak tanda tangan (Ketua RT & Pengelola) yang hilang di halaman terakhir cetak PDF karena masalah *page-break*.
   - Mengoptimalkan fitur **Bagi Gambar**: Gambar yang dihasilkan sekarang HANYA berisi ringkasan/infografis (tanpa log rincian panjang), sehingga hasil *capture* lebih rapi, pendek, dan siap kirim ke WhatsApp.

25: ## 3. SOP Wajib & Aturan Utama (Jangan Dilanggar!)
26: 1. **Aturan Penentuan Periode (Siklus 15-15):** 
27:    - Inisialisasi awal (*default buka aplikasi*) menggunakan rumus 15-15 (`getCycleMonthYear` di `billing.js`).
28:    - **Transaksi (Terima Bayar, Patungan, Kas Lain) WAJIB PATUH pada UI Dropdown (`selectedMonth`/`b`).** DILARANG KERAS menggunakan tanggal transaksi (*real-time*) untuk menebak periode. Tanggal transaksi *hanya* untuk watermark/resi.
29: 2. **Prosedur Deploy ke Vercel (PENTING untuk Andre Anastasya - andreanastasya798@gmail.com):**
30:    - Dilarang keras *build* tanpa menyalin pembaruan *source code*!
31:    - Wajib jalankan: `Copy-Item -Path "src\*" -Destination "..\vercel pam\airkas-vercel\airkas-react\src\" -Recurse -Force`
32:    - Wajib jalankan: `Copy-Item -Path "public\*" -Destination "..\vercel pam\airkas-vercel\airkas-react\public\" -Recurse -Force`
33:    - Baru lakukan `npm run build` dan `npx vercel --prod`.
34: 
35: ## 4. Fitur Tertunda (Bisa Dilanjutkan Kapan Saja)
36: - **Saldo Awal / Modal Awal:** Menunggu kesiapan *Admin* untuk menambah kolom `saldo_awal` di tabel `settings` Supabase.
37: 
38: ## 5. Rencana Kerja Selanjutnya
- Melanjutkan fitur operasional atau pelaporan tambahan jika diperlukan.
- Memantau penggunaan fitur ekspor CSV jika perlu ada pengembangan lebih lanjut di kemudian hari.
40: 
41: *End of Mantra.*
