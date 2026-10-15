import { describe, it, expect } from 'vitest';
import { calculateMonthlySummary } from './reportCalculations.js';
import { filterByrBySiklus, filterKlrBySiklus } from './billingEngine.js';

const warga = [
  { id: 1, nama: 'Warga Uji', alamat: 'Blok A', aktif: true, adalah_pengelola: false },
  { id: 9, nama: 'Kas RT (Umum)', alamat: 'SISTEM', aktif: true, adalah_pengelola: false }
];

const state = {
  warga,
  meteran: [
    { id: 10, warga_id: 1, bulan: 10, tahun: 2026, total_tagihan: 72000 },
    { id: 11, warga_id: 1, bulan: 11, tahun: 2026, total_tagihan: 64000 }
  ],
  pembayaran: [
    // Dibayar 20 Oktober -> uangnya berpindah di siklus November (15 Okt - 14 Nov)
    { warga_id: 1, meteran_id: 10, bulan: 10, tahun: 2026, jumlah_bayar: 72000, tanggal_bayar: '2026-10-20' },
    // Dibayar 10 Oktober -> masih siklus Oktober (15 Sep - 14 Okt)
    { warga_id: 1, meteran_id: 10, bulan: 9, tahun: 2026, jumlah_bayar: 50000, tanggal_bayar: '2026-10-10' }
  ],
  pengeluaran: [
    // 20 Oktober: bulan kalender Oktober, tetapi siklus November
    { kategori: 'Listrik', keterangan: 'Token pompa', jumlah: 150000, tanggal: '2026-10-20' },
    // 10 Oktober: masih siklus Oktober
    { kategori: 'Perawatan', keterangan: 'Pipa', jumlah: 50000, tanggal: '2026-10-10' }
  ]
};

describe('calculateMonthlySummary — memakai siklus 15-14, bukan bulan kalender', () => {
  it('pengeluaran 20 Oktober masuk siklus November, bukan Oktober', () => {
    expect(calculateMonthlySummary(10, 2026, state).totalPengeluaran).toBe(50000);
    expect(calculateMonthlySummary(11, 2026, state).totalPengeluaran).toBe(150000);
  });

  it('pembayaran 20 Oktober masuk siklus November, bukan Oktober', () => {
    expect(calculateMonthlySummary(10, 2026, state).totalPemasukan).toBe(50000);
    expect(calculateMonthlySummary(11, 2026, state).totalPemasukan).toBe(72000);
  });

  it('arus kasnya identik dengan cara laporan bulanan menghitung', () => {
    for (const bulan of [10, 11]) {
      const rekap = calculateMonthlySummary(bulan, 2026, state);
      const masukBulanan = filterByrBySiklus(state.pembayaran, bulan, 2026)
        .reduce((s, p) => s + p.jumlah_bayar, 0);
      const keluarBulanan = filterKlrBySiklus(state.pengeluaran, bulan, 2026)
        .reduce((s, k) => s + k.jumlah, 0);

      expect(rekap.totalPemasukan).toBe(masukBulanan);
      expect(rekap.totalPengeluaran).toBe(keluarBulanan);
    }
  });

  it('tagihan tetap memakai periode terbitnya, bukan tanggal uang masuk', () => {
    // Tagihan Oktober terbit di siklus Oktober walau dibayar 20 Okt
    expect(calculateMonthlySummary(10, 2026, state).totalTagihan).toBe(72000);
    expect(calculateMonthlySummary(11, 2026, state).totalTagihan).toBe(64000);
  });

  it('saldo bersih mengikuti arus kas siklus', () => {
    expect(calculateMonthlySummary(11, 2026, state).saldoBersih).toBe(72000 - 150000);
  });

  it('bulan tanpa transaksi menghasilkan nol, bukan error', () => {
    const r = calculateMonthlySummary(3, 2026, state);
    expect(r.totalPemasukan).toBe(0);
    expect(r.totalPengeluaran).toBe(0);
    expect(r.totalTagihan).toBe(0);
  });
});
