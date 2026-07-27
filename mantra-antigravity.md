MANTRA ANTIGRAVITY: AIRKAS RT
Update Terakhir: 27 Juli 2026
Status: PRODUCTION READY (CODE FREEZE)
1. Filosofi Inti & Tujuan Proyek (DILARANG DILANGGAR)
AirKas RT adalah aplikasi pencatatan keuangan sederhana untuk bendahara RT.
Secara teknis, aplikasi ini hanyalah: Kalkulator + Memori + Laporan.
Bukan ERP.
Bukan Sistem Akuntansi Enterprise.
Jangan overengineering. (DILARANG membuat abstraction, service, factory, hook kompleks, class layer, atau dependency injection tanpa alasan operasional mutlak).
Prioritas Utama: 1. Data Benar (Uang). 2. Perhitungan Benar. 3. Laporan Benar. 4. UX Sederhana. 5. Maintainability.
2. Info Sistem
Stack: React.js, Vite, Tailwind CSS, Supabase (Database Utama), jsPDF & jspdf-autotable.
Local: d:\SLAMET\other\PDAM\pam z ai\airkas-react
Vercel Deploy: d:\SLAMET\other\PDAM\vercel pam\airkas-vercel\airkas-react
URL Live: https://airkas-rt.vercel.app
3. Status Terbaru (Major Release - 27 Juli 2026)
Pemusatan Bisnis SSoT (billingEngine.js): Seluruh kalkulasi tunggakan, deposit, tagihan, dan sisa pembayaran sekarang dihitung lewat SSoT. Dilarang melakukan iterasi manual (reduce) untuk kalkulasi di dalam UI.
Integritas Transaksi (Abort Barrier): Fungsi executeWrite di DbContext.jsx secara mutlak akan melemparkan (throw err) kegagalan ke komponen agar transaksi asinkron terhenti. Tidak ada lagi kasus "Data hilang tapi modal menutup/mereset otomatis".
Pencegahan Double-Submit: Form Pengeluaran, DataWarga, Pembayaran, dan PencatatanMeteran dilindungi isSaving dan try/catch ketat untuk mencegah duplikasi data saat koneksi lag.
Validasi Anti-Sabotase & Anti-Typo: Menolak pembayaran/pengeluaran negatif/nol, menolak input meteran mundur, menolak lonjakan meter ekstrem (>150m³), menolak Nomor Meter ganda, dan menolak input jika tanggal dikosongkan.
Arsitektur Modular Laporan Keuangan: Refactoring God Component menjadi struktur berbasis fitur (features/laporan-keuangan/components, hooks, services) untuk mendukung fitur ekspor yang kompleks tanpa mengorbankan maintainability.
Fitur Ekspor & Berbagi Laporan (Lengkap):
PDF: Layout profesional, auto page-break yang rapi, nomor halaman dinamis di footer, tanda tangan otomatis, dan perhitungan saldo kumulatif per siklus yang akurat.
CSV: Format ramah Excel (UTF-8 BOM, delimiter titik koma ;), angka mentah (raw numbers) agar mudah di-SUM, terbagi jelas dalam Ringkasan, Detail Warga, dan Jurnal Transaksi.
Share WhatsApp: Format teks terstruktur (bold/italic/monospace) berisi ringkasan saldo, daftar warga lunas/belum lunas (dengan sisa/tagihan), dan pengingat patungan, menggunakan logika billingEngine yang sama persis dengan UI.
Sinkronisasi Logika Saldo (CRITICAL FIX):
Dashboard: Menampilkan Saldo Real-time (akumulasi seluruh transaksi dari awal waktu hingga detik ini).
Laporan PDF: Menampilkan Saldo Akhir Per Periode (Saldo Bawaan Awal Periode + Pemasukan Periode - Pengeluaran Periode).
Kedua angka ini sekarang 100% sinkron, logis, dan dapat dipertanggungjawabkan.
4. SOP Wajib & Aturan Utama (Operasional Harian)
Asimetri Filter Data (Pembayaran vs Pengeluaran):
Terima Bayar (pembayaran): Gunakan filter statis dari dropdown form (p.bulan === b && p.tahun === t).
Pengeluaran (pengeluaran): Harus difilter berdasarkan tanggal aslinya menggunakan siklus 15-14 (filterKlrBySiklus).
Deposit Otomatis: Kelebihan pembayaran otomatis dianggap deposit oleh billingEngine dan dipotong otomatis di tagihan bulan depan. Dilarang membuat fitur manual potong deposit.
Logika Offset (b - 1): Tagihan air merefleksikan tagihan penggunaan air pada bulan sebelumnya. Laporan Keuangan bulan = 6 menampilkan tagihan air untuk periode pemakaian bulan 5.
Siklus Pelaporan (15-14): Laporan bulanan (misal: "Juli") secara ketat mengambil data transaksi dari tanggal 15 bulan sebelumnya hingga 14 bulan berjalan. Saldo yang ditampilkan di PDF adalah posisi kas pada akhir siklus tersebut.
Prosedur Deploy ke Vercel:
Script Salin/Deploy:
Remove-Item -Path "..\..\vercel pam\airkas-vercel\airkas-react\src" -Recurse -Force; Copy-Item -Path "src" -Destination "..\..\vercel pam\airkas-vercel\airkas-react\src" -Recurse -Force; Copy-Item -Path "index.html" -Destination "..\..\vercel pam\airkas-vercel\airkas-react\index.html" -Force
Push rilis produksi:
npx vercel --cwd "..\..\vercel pam\airkas-vercel\airkas-react" --prod --yes
5. Rencana Kerja Selanjutnya (Post-Release)
Aplikasi dalam status CODE FREEZE.
Dilarang melakukan refactoring kosmetik (Clean Code, DRY tidak penting, Re-organize files) kecuali ada dampak operasional langsung.
Lakukan intervensi kode HANYA JIKA ada pelaporan bug yang mengakibatkan: salah hitung uang, saldo korup, atau gagal render laporan keuangan (SLA Kritis).
End of Mantra.