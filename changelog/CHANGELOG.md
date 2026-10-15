# Riwayat Perubahan — AirKas RT

Catatan perubahan aplikasi, ditulis dari sudut pandang **bendahara dan warga**:
apa yang berubah di layar, di angka, atau di laporan — bukan apa yang berubah
di dalam kode.

Urutan terbaru di atas. Cara menambah entri ada di [README.md](README.md).

---

## 16 Oktober 2026

### Perawatan
- Memperbarui `actions/checkout` dan `actions/setup-node` ke v7. Peringatan
  GitHub soal Node.js 20 yang sudah usang hilang.
- Aturan "uang patungan tidak melunasi tagihan air" dulu ditulis di tiga
  tempat, sekarang satu. Tidak ada angka yang berubah — dibuktikan dengan
  membandingkan 1.080 baris hasil perhitungan sebelum dan sesudah.

---

## 15 Oktober 2026

### Penggantian meteran
- **Meteran yang rusak sekarang bisa diganti.** Sebelumnya pencatatan ditolak
  karena meteran baru mulai dari 0 dan dianggap "mundur" dari meteran lama.
- Angka meteran lama tersimpan sebagai arsip dan **tidak mengganggu**
  perhitungan meteran baru. Tagihan periode lampau tidak berubah sama sekali.
- Berlaku untuk warga mana pun, berapa kali pun berganti, tanpa perlu
  mengubah aplikasi lagi.
- Siklus berlakunya dihitung otomatis: kalau pembacaan siklus itu sudah
  diambil, penggantian mulai berlaku pada siklus berikutnya.
- Sisa pemakaian meteran lama bisa ikut ditagih (isi angka akhirnya) atau
  diabaikan (kosongkan).
- Halaman Data Warga punya **Riwayat Meteran** per warga.

### Laporan
- **Status "Belum Lunas" yang keliru di PDF dan CSV diperbaiki.** Keduanya
  dulu hanya menghitung uang tunai bulan itu dan mengabaikan sisa saldo
  warga. Dari lima laporan Juli–November 2026, **17 dari 145 baris** salah —
  semuanya warga yang sudah lunas tertulis belum.
- Kolom **Dari Saldo** ditambahkan, supaya warga melihat berapa yang ditutup
  dari sisa saldonya, bukan hanya kata "Lunas".
- Judul laporan dipisah jadi **Periode Kas** dan **Tagihan Air**. Satu laporan
  memang memuat dua periode: arus kas siklus ini, tagihan siklus sebelumnya.
- Teks WhatsApp menyebut **jumlah bulan** bagi warga yang menunggak 2 bulan
  atau lebih. Tunggakan 1 bulan tidak dilabeli, karena itu kondisi normal
  sesaat setelah tagihan terbit.
- **Rekap tahunan sekarang memakai siklus 15–14**, sama seperti laporan
  bulanan. Sebelumnya pengeluaran disaring per bulan kalender, sehingga satu
  baris "Oktober" berarti dua hal berbeda di dua laporan.
- Tahun buku berjalan 15 Desember sampai 14 Januari tahun berikutnya, jadi
  rekapnya **13 baris** — pembayaran tagihan Desember baru masuk pada siklus
  Januari.

### Tampilan angka
- Kolom nominal menampilkan **titik ribuan sambil diketik** (`150.000`),
  supaya Rp 1.000 dan Rp 10.000 tidak tertukar.
- Semua tampilan uang memakai spasi: `Rp 1.000`, bukan `Rp1.000`.
- Angka di tabel PDF ikut berformat. Angka di CSV sengaja dibiarkan polos
  agar masih bisa dijumlahkan di Excel.

### Perbaikan
- Kolom "Pakai (m³)" di CSV **selalu menampilkan 0** karena membaca nama kolom
  yang tidak ada di database. Berlaku juga di PDF dan tabel detail.
- Peringatan muncul bila periode pencatatan yang dipilih sudah berisi data —
  menutup jebakan mencatat pada tanggal 14, yang membuat periode jatuh ke
  bulan sebelumnya.
- Rumus siklus dan tagihan dulu punya salinan di tiga berkas. Salah satunya
  sudah melenceng (kehilangan satu pengaman) tanpa ada yang tahu. Sekarang
  hanya ada satu sumber.

---

## 16 September 2026

- **Chatbot warga** (hanya baca) untuk menjawab pertanyaan seputar tagihan,
  tunggakan, saldo, dan pengeluaran.
- Panel chatbot diperbesar dan teksnya dinaikkan agar terbaca warga lanjut
  usia.
- PIN kunci layar disimpan **per akun admin**, tidak lagi dipatok di dalam
  kode.
- Pemulihan data (restore) berjalan atomik lewat fungsi database; tombol
  Reset dihapus.
- Log audit dibuat permanen — tombol "Kosongkan Log" dihapus.

---

## 15 September 2026

- **Login admin** memakai Supabase Auth.
- Penulisan data dikunci hanya untuk admin lewat RLS di database, dan
  penolakan dari server kini terdeteksi (sebelumnya gagal diam-diam).
- Pengelolaan admin di dalam aplikasi dengan verifikasi OTP lewat email.

---

## 6 Agustus 2026

- Pengujian otomatis untuk perhitungan tagihan dan siklus.
- Perbaikan logika saldo patungan.
- Dokumentasi struktur proyek (`graphify-out`).

---

## 26–27 Juli 2026

- Export PDF dilengkapi: footer, nomor halaman, dan pemenggalan halaman.
- Export CSV dirapikan, berbagi lewat WhatsApp diaktifkan.
- Perhitungan saldo kumulatif per periode billing (15–14) disesuaikan dengan
  tampilan.
- Halaman Laporan Keuangan dipecah menjadi beberapa komponen.

---

## 26 Juni 2026

- Pengerasan untuk produksi: pemusatan perhitungan di `billingEngine.js` dan
  `cycleEngine.js`, pencegahan simpan ganda, dan validasi anti–salah ketik
  (menolak nominal negatif, meteran mundur, lonjakan >150 m³, nomor meter
  ganda).

---

## 15 Juni 2026

- Siklus **15–14** diselaraskan di Dashboard, Laporan Keuangan, dan
  Pembayaran.
- Tata letak cetak dioptimalkan; template WhatsApp memuat rincian patungan.

---

## 1 Juni 2026

- Rilis awal: pencatatan meteran, pembayaran, pengeluaran, laporan dengan
  siklus 15–15, dan export PDF.
