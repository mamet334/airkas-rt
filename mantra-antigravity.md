# MANTRA ANTIGRAVITY: AIRKAS RT
**Update Terakhir:** 26 Juni 2026
**Status:** PRODUCTION READY (CODE FREEZE)

## 1. Filosofi Inti & Tujuan Proyek (DILARANG DILANGGAR)
AirKas RT adalah aplikasi pencatatan keuangan sederhana untuk bendahara RT.
Secara teknis, aplikasi ini hanyalah: **Kalkulator + Memori + Laporan.**
- **Bukan ERP.**
- **Bukan Sistem Akuntansi Enterprise.**
- **Jangan overengineering.** (DILARANG membuat abstraction, service, factory, hook kompleks, class layer, atau dependency injection tanpa alasan operasional mutlak).
- **Prioritas Utama:** 1. Data Benar (Uang). 2. Perhitungan Benar. 3. Laporan Benar. 4. UX Sederhana. 5. Maintainability.

## 2. Info Sistem
- **Stack:** React.js, Vite, Tailwind CSS, Supabase (Database Utama)
- **Local:** `d:\SLAMET\other\PDAM\pam z ai\airkas-react`
- **Vercel Deploy:** `d:\SLAMET\other\PDAM\vercel pam\airkas-vercel\airkas-react`
- **URL Live:** https://airkas-rt.vercel.app

## 3. Status Terbaru (Production Release - 26 Juni 2026)
1. **Pemusatan Bisnis SSoT (`billingEngine.js`):** Seluruh kalkulasi tunggakan, deposit, tagihan, dan sisa pembayaran sekarang dihitung lewat SSoT. Dilarang melakukan iterasi manual (`reduce`) untuk kalkulasi di dalam UI (`Dashboard`, `Pembayaran`, `LaporanKeuangan`).
2. **Integritas Transaksi (Abort Barrier):** Fungsi `executeWrite` di `DbContext.jsx` secara mutlak akan melemparkan (`throw err`) kegagalan ke komponen agar transaksi asinkron terhenti. Tidak ada lagi kasus "Data hilang tapi modal menutup/mereset otomatis".
3. **Pencegahan Double-Submit:** Form `Pengeluaran`, `DataWarga`, `Pembayaran`, dan `PencatatanMeteran` dilindungi `isSaving` dan *try/catch* ketat untuk mencegah duplikasi data saat koneksi *lag*.
4. **Validasi Anti-Sabotase & Anti-Typo:**
   - Menolak pembayaran/pengeluaran berjumlah negatif atau nol (Mencegah pencurian kas matematis).
   - Menolak *input* meteran mundur. Memperingatkan lonjakan meter ekstrem (>150m3).
   - Menolak Nomor Meter ganda (`M-XXX`).
   - Menolak *input* jika tanggal dikosongkan (mencegah eksploitasi `.toISOString()` *crash*).

## 4. SOP Wajib & Aturan Utama (Operasional Harian)
1. **Asimetri Filter Data (Pembayaran vs Pengeluaran):** 
   - **Terima Bayar (`pembayaran`):** Gunakan filter statis dari dropdown form (`p.bulan === b && p.tahun === t`).
   - **Pengeluaran (`pengeluaran`):** Harus difilter berdasarkan tanggal aslinya menggunakan siklus 15-14 (`filterKlrBySiklus`).
2. **Deposit Otomatis:** Kelebihan pembayaran otomatis dianggap deposit oleh `billingEngine` dan dipotong otomatis di tagihan bulan depan. *Dilarang membuat fitur manual potong deposit.*
3. **Logika Offset (b - 1):** Tagihan air merefleksikan tagihan penggunaan air pada bulan *sebelumnya*. Laporan Keuangan `bulan = 6` menampilkan tagihan air untuk periode pemakaian bulan 5.
4. **Prosedur Deploy ke Vercel:**
   - Script Salin/Deploy:
     `Remove-Item -Path "..\..\vercel pam\airkas-vercel\airkas-react\src" -Recurse -Force; Copy-Item -Path "src" -Destination "..\..\vercel pam\airkas-vercel\airkas-react\src" -Recurse -Force; Copy-Item -Path "index.html" -Destination "..\..\vercel pam\airkas-vercel\airkas-react\index.html" -Force`
   - Push rilis produksi: `npx vercel --cwd "..\..\vercel pam\airkas-vercel\airkas-react" --prod --yes`

## 5. Rencana Kerja Selanjutnya (Post-Release)
- Aplikasi dalam status CODE FREEZE. **Dilarang melakukan refactoring kosmetik (Clean Code, DRY tidak penting, Re-organize files).**
- Lakukan intervensi kode **HANYA JIKA** ada pelaporan *bug* yang mengakibatkan salah hitung uang, saldo korup, atau gagal *render* laporan keuangan (SLA Kritis).

*End of Mantra.*
