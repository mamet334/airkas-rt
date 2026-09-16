import { describe, it, expect } from 'vitest';
import { detectIntent, parsePeriod, findWarga, answerQuestion } from './chatEngine';

// 20 September 2026 -> siklus berjalan = September 2026 (15 Agt - 14 Sep).
// Seperti di halaman Pembayaran (dan seperti data asli), meteran periode
// September memakai bulan = 9, dan pembayarannya juga bulan = 9.
const HARI_INI = new Date('2026-09-20T10:00:00');

const state = {
  settings: { tarif_per_m3: 8000, biaya_admin: 0 },
  warga: [
    { id: 1, nama: 'Bowo', alamat: 'Blok A', aktif: true, adalah_pengelola: false },
    { id: 2, nama: 'Siti Aminah', alamat: 'Blok B', aktif: true, adalah_pengelola: false },
    { id: 3, nama: 'Pengelola RT', alamat: 'Blok C', aktif: true, adalah_pengelola: true },
    { id: 4, nama: 'Kas Lain', alamat: 'SISTEM', aktif: true, adalah_pengelola: false }
  ],
  meteran: [
    // Periode berjalan (September)
    { id: 11, warga_id: 1, bulan: 9, tahun: 2026, meter_lalu: 100, meter_sekarang: 110, pemakaian: 10, tarif_per_m3: 8000, total_tagihan: 80000 },
    { id: 12, warga_id: 2, bulan: 9, tahun: 2026, meter_lalu: 50, meter_sekarang: 55, pemakaian: 5, tarif_per_m3: 8000, total_tagihan: 40000 },
    // Periode sebelumnya (Agustus) -> jadi tunggakan Siti
    { id: 13, warga_id: 2, bulan: 8, tahun: 2026, meter_lalu: 42, meter_sekarang: 50, pemakaian: 8, tarif_per_m3: 8000, total_tagihan: 64000 }
  ],
  pembayaran: [
    { id: 101, warga_id: 1, meteran_id: 11, bulan: 9, tahun: 2026, jumlah_bayar: 80000, metode: 'Tunai', tanggal_bayar: '2026-09-01T00:00:00Z', keterangan: null },
    { id: 102, warga_id: 1, meteran_id: null, bulan: 9, tahun: 2026, jumlah_bayar: 50000, metode: 'Transfer', tanggal_bayar: '2026-08-20T00:00:00Z', keterangan: 'Iuran' }
    // Siti belum membayar meteran Agustus (id 13) -> tunggakan 64.000
  ],
  pengeluaran: [
    { id: 201, kategori: 'Listrik', keterangan: 'Token listrik pompa', jumlah: 150000, tanggal: '2026-08-20' },
    { id: 202, kategori: 'Perawatan', keterangan: 'Ganti pipa bocor', jumlah: 50000, tanggal: '2026-09-10' },
    { id: 203, kategori: 'Listrik', keterangan: 'Di luar siklus', jumlah: 999000, tanggal: '2026-07-01' }
  ],
  rekap: {
    total_bayar: 130000,
    total_keluar: 1199000,
    kas_rt_bersih: 431000,
    saldo_awal: 1500000,
    kas_patungan_bersih: 0
  }
};

describe('detectIntent', () => {
  it('mengenali pertanyaan saldo', () => {
    expect(detectIntent('saldo kas berapa')).toBe('saldo_kas');
    expect(detectIntent('UANG KAS RT sisa berapa?')).toBe('saldo_kas');
  });

  it('mengenali pertanyaan tagihan dan riwayat', () => {
    expect(detectIntent('tagihan bowo berapa')).toBe('cek_tagihan');
    expect(detectIntent('riwayat bayar bowo')).toBe('riwayat_bayar');
  });

  it('membedakan daftar penunggak dan rinciannya', () => {
    expect(detectIntent('siapa yang belum bayar')).toBe('belum_bayar');
    expect(detectIntent('siapa saja yang nunggak?')).toBe('belum_bayar');
    expect(detectIntent('rincian belum bayar')).toBe('rincian_belum_bayar');
  });

  it('membedakan pertanyaan sudah bayar dari belum bayar', () => {
    expect(detectIntent('siapa yang sudah bayar')).toBe('sudah_bayar');
    expect(detectIntent('siapa saja yang sudah lunas?')).toBe('sudah_bayar');
  });

  it('mengenali intent tambahan', () => {
    expect(detectIntent('pengeluaran bulan agustus')).toBe('total_pengeluaran');
    expect(detectIntent('pemakaian air bowo')).toBe('pemakaian_air');
    expect(detectIntent('tarif berapa')).toBe('tarif');
    expect(detectIntent('laporan bulan ini')).toBe('laporan_periode');
    expect(detectIntent('kapan bowo terakhir bayar')).toBe('terakhir_bayar');
    expect(detectIntent('berapa jumlah warga')).toBe('jumlah_warga');
  });

  it('mengembalikan tidak_paham untuk pertanyaan di luar topik', () => {
    expect(detectIntent('besok hujan tidak')).toBe('tidak_paham');
  });
});

describe('parsePeriod', () => {
  it('memakai siklus berjalan jika bulan tidak disebut', () => {
    expect(parsePeriod('saldo kas', HARI_INI)).toEqual({ month: 9, year: 2026 });
  });

  it('membaca nama bulan dan tahun dari teks', () => {
    expect(parsePeriod('pengeluaran bulan agustus', HARI_INI)).toEqual({ month: 8, year: 2026 });
    expect(parsePeriod('pengeluaran juli 2025', HARI_INI)).toEqual({ month: 7, year: 2025 });
  });

  it('memahami "bulan lalu"', () => {
    expect(parsePeriod('pengeluaran bulan lalu', HARI_INI)).toEqual({ month: 8, year: 2026 });
  });
});

describe('findWarga', () => {
  it('cocok tanpa peduli huruf besar/kecil', () => {
    expect(findWarga('tagihan BOWO berapa', state.warga).match.id).toBe(1);
    expect(findWarga('tagihan bowo berapa', state.warga).match.id).toBe(1);
  });

  it('mengabaikan sapaan seperti "pak"', () => {
    expect(findWarga('tagihan pak bowo', state.warga).match.id).toBe(1);
  });

  it('cocok dengan sebagian nama', () => {
    expect(findWarga('riwayat bayar siti', state.warga).match.id).toBe(2);
  });

  it('tidak mencocokkan warga SISTEM', () => {
    expect(findWarga('kas lain berapa', state.warga).match).toBeNull();
  });

  it('mengembalikan null jika nama tidak dikenal', () => {
    expect(findWarga('tagihan joko berapa', state.warga).match).toBeNull();
  });
});

describe('answerQuestion — saldo & ringkasan', () => {
  it('menjawab saldo kas lengkap dengan kondisi periode berjalan', () => {
    const { intent, text } = answerQuestion('saldo kas berapa', state, HARI_INI);
    expect(intent).toBe('saldo_kas');
    expect(text).toContain('431.000');
    expect(text).toContain('Periode berjalan');
    expect(text).toContain('Warga aktif: 2 orang');
    expect(text).toContain('Belum lunas: 1 orang');
  });

  it('menjawab jumlah warga', () => {
    const { text } = answerQuestion('berapa jumlah warga', state, HARI_INI);
    expect(text).toContain('Jumlah warga terdaftar: 3');
    expect(text).toContain('Aktif (kena tagihan): 2');
    expect(text).toContain('Pengelola (bebas tagihan): 1');
  });

  it('menjawab tarif beserta contoh hitungan', () => {
    const { text } = answerQuestion('tarif berapa', state, HARI_INI);
    expect(text).toContain('8.000');
    expect(text).toContain('80.000'); // contoh 10 m3
  });

  it('membuat laporan periode', () => {
    const { text } = answerQuestion('laporan bulan ini', state, HARI_INI);
    expect(text).toContain('Tagihan air terbit: Rp120.000'); // 80.000 + 40.000
    expect(text).toContain('Uang keluar: Rp200.000');
    expect(text).toContain('Sudah lunas: 1 dari 2 warga');
  });
});

describe('answerQuestion — tagihan warga (detail penuh)', () => {
  it('menampilkan angka meteran dan tarif', () => {
    const { text } = answerQuestion('tagihan bowo berapa', state, HARI_INI);
    expect(text).toContain('100 → 110');
    expect(text).toContain('pakai 10 m³');
    expect(text).toContain('Tarif: Rp8.000/m³');
    expect(text).toContain('Lunas');
  });

  it('merinci bulan-bulan yang tertunggak', () => {
    const { text } = answerQuestion('tagihan siti', state, HARI_INI);
    expect(text).toContain('Tunggakan sebelumnya');
    expect(text).toContain('Agustus 2026: Rp64.000');
    expect(text).toContain('Sisa yang harus dibayar: Rp104.000');
  });

  it('menyebut pembayaran terakhir', () => {
    const { text } = answerQuestion('tagihan bowo', state, HARI_INI);
    expect(text).toContain('Pembayaran terakhir');
    expect(text).toContain('Tunai');
  });
});

describe('answerQuestion — tunggakan', () => {
  it('daftar belum bayar ringkas dan menawarkan rincian', () => {
    const { text } = answerQuestion('siapa yang belum bayar', state, HARI_INI);
    expect(text).toContain('Siti Aminah');
    expect(text).not.toContain('Bowo');
    expect(text).toContain('rincian belum bayar');
  });

  it('daftar sudah bayar hanya memuat yang lunas', () => {
    const { intent, text } = answerQuestion('siapa yang sudah bayar', state, HARI_INI);
    expect(intent).toBe('sudah_bayar');
    expect(text).toContain('Sudah lunas periode');
    expect(text).toContain('1 dari 2 warga');
    expect(text).toContain('Bowo — Rp80.000');
    expect(text).not.toContain('Siti Aminah');
    expect(text).toContain('Total dibayar periode ini: Rp80.000');
  });

  it('rincian belum bayar menyebut bulan tertunggak', () => {
    const { intent, text } = answerQuestion('rincian belum bayar', state, HARI_INI);
    expect(intent).toBe('rincian_belum_bayar');
    expect(text).toContain('Bulan tertunggak: Agustus 2026');
    expect(text).toContain('Tagihan periode ini: Rp40.000');
  });
});

describe('answerQuestion — kas keluar/masuk', () => {
  it('merinci transaksi pengeluaran sesuai siklus 15-14', () => {
    const { text } = answerQuestion('pengeluaran bulan ini', state, HARI_INI);
    expect(text).toContain('Rp200.000'); // 150.000 (20 Agt) + 50.000 (10 Sep)
    expect(text).toContain('Rincian transaksi');
    expect(text).toContain('Token listrik pompa');
    expect(text).not.toContain('999.000');
  });

  it('menjawab pemasukan periode', () => {
    const { text } = answerQuestion('pemasukan bulan ini', state, HARI_INI);
    expect(text).toContain('Pemasukan periode');
  });
});

describe('answerQuestion — data per warga', () => {
  it('menampilkan riwayat pembayaran beserta periode dan metode', () => {
    const { text } = answerQuestion('riwayat bayar bowo', state, HARI_INI);
    expect(text).toContain('130.000');
    expect(text).toContain('Iuran');
    expect(text).toContain('Transfer');
  });

  it('menjawab kapan terakhir bayar', () => {
    const { intent, text } = answerQuestion('kapan bowo terakhir bayar', state, HARI_INI);
    expect(intent).toBe('terakhir_bayar');
    expect(text).toContain('Bowo terakhir membayar');
    expect(text).toContain('80.000');
  });

  it('menampilkan riwayat pemakaian air dan rata-ratanya', () => {
    const { text } = answerQuestion('pemakaian air siti', state, HARI_INI);
    expect(text).toContain('September 2026: 5 m³');
    expect(text).toContain('Agustus 2026: 8 m³');
    expect(text).toContain('Rata-rata: 6.5 m³');
  });
});

describe('answerQuestion — penanganan lain', () => {
  it('memberi panduan saat pertanyaan tidak dipahami', () => {
    const { intent, text } = answerQuestion('besok hujan tidak', state, HARI_INI);
    expect(intent).toBe('tidak_paham');
    expect(text).toContain('saldo kas berapa');
  });

  it('menganggap pertanyaan berisi nama saja sebagai cek tagihan', () => {
    const { intent } = answerQuestion('bowo', state, HARI_INI);
    expect(intent).toBe('cek_tagihan');
  });

  it('tidak error saat data belum dimuat', () => {
    const { text } = answerQuestion('saldo kas', {}, HARI_INI);
    expect(text).toContain('belum selesai dimuat');
  });
});
