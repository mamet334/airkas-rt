import { describe, it, expect } from 'vitest';
import { detectIntent, parsePeriod, findWarga, answerQuestion } from './chatEngine';

// 20 September 2026 -> siklus berjalan = September 2026 (15 Agt - 14 Sep).
// Seperti di halaman Pembayaran (dan seperti data asli), meteran periode
// September memakai bulan = 9, dan pembayarannya juga bulan = 9.
const HARI_INI = new Date('2026-09-20T10:00:00');

const state = {
  warga: [
    { id: 1, nama: 'Bowo', alamat: 'Blok A', aktif: true, adalah_pengelola: false },
    { id: 2, nama: 'Siti Aminah', alamat: 'Blok B', aktif: true, adalah_pengelola: false },
    { id: 3, nama: 'Pengelola RT', alamat: 'Blok C', aktif: true, adalah_pengelola: true },
    { id: 4, nama: 'Kas Lain', alamat: 'SISTEM', aktif: true, adalah_pengelola: false }
  ],
  meteran: [
    // Periode berjalan (September)
    { id: 11, warga_id: 1, bulan: 9, tahun: 2026, pemakaian: 10, total_tagihan: 80000 },
    { id: 12, warga_id: 2, bulan: 9, tahun: 2026, pemakaian: 5, total_tagihan: 40000 },
    // Periode sebelumnya (Agustus) -> jadi tunggakan Siti
    { id: 13, warga_id: 2, bulan: 8, tahun: 2026, pemakaian: 8, total_tagihan: 64000 }
  ],
  pembayaran: [
    { id: 101, warga_id: 1, meteran_id: 11, bulan: 9, tahun: 2026, jumlah_bayar: 80000, tanggal_bayar: '2026-09-01T00:00:00Z', keterangan: null },
    { id: 102, warga_id: 1, meteran_id: null, bulan: 9, tahun: 2026, jumlah_bayar: 50000, tanggal_bayar: '2026-08-20T00:00:00Z', keterangan: 'Iuran' }
    // Siti belum membayar meteran Agustus (id 13) -> tunggakan 64.000
  ],
  pengeluaran: [
    { id: 201, kategori: 'Listrik', jumlah: 150000, tanggal: '2026-08-20' },
    { id: 202, kategori: 'Perawatan', jumlah: 50000, tanggal: '2026-09-10' },
    { id: 203, kategori: 'Listrik', jumlah: 999000, tanggal: '2026-07-01' } // di luar siklus September
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

  it('mengenali pertanyaan tunggakan dan pengeluaran', () => {
    expect(detectIntent('siapa yang belum bayar')).toBe('belum_bayar');
    expect(detectIntent('siapa saja yang nunggak?')).toBe('belum_bayar');
    expect(detectIntent('pengeluaran bulan agustus')).toBe('total_pengeluaran');
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

describe('answerQuestion', () => {
  it('menjawab saldo kas dari rekap resmi', () => {
    const { intent, text } = answerQuestion('saldo kas berapa', state, HARI_INI);
    expect(intent).toBe('saldo_kas');
    expect(text).toContain('431.000');
  });

  it('menjawab tagihan warga yang sudah lunas', () => {
    const { text } = answerQuestion('tagihan bowo berapa', state, HARI_INI);
    expect(text).toContain('Bowo');
    expect(text).toContain('80.000');
    expect(text).toContain('Lunas');
  });

  it('menyebut tunggakan warga yang belum bayar', () => {
    const { text } = answerQuestion('tagihan siti', state, HARI_INI);
    expect(text).toContain('Tunggakan sebelumnya');
    expect(text).toContain('64.000');
  });

  it('menampilkan daftar penunggak beserta totalnya', () => {
    const { text } = answerQuestion('siapa yang belum bayar', state, HARI_INI);
    expect(text).toContain('Siti Aminah');
    expect(text).not.toContain('Bowo');
    expect(text).toContain('Total tunggakan');
  });

  it('menjumlah pengeluaran sesuai siklus 15-14', () => {
    const { text } = answerQuestion('pengeluaran bulan ini', state, HARI_INI);
    expect(text).toContain('200.000'); // 150.000 (20 Agt) + 50.000 (10 Sep)
    expect(text).not.toContain('999.000');
  });

  it('menampilkan riwayat pembayaran warga', () => {
    const { text } = answerQuestion('riwayat bayar bowo', state, HARI_INI);
    expect(text).toContain('130.000'); // total seluruh pembayaran Bowo
    expect(text).toContain('Iuran');
  });

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
