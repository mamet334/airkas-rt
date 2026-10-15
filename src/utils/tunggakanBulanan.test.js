import { describe, it, expect } from 'vitest';
import { getTunggakanBulanan, getWargaBillingSummary } from './billingEngine.js';

// Tagihan Rp 8.000/m³. Angka meteran tidak relevan di sini, hanya total_tagihan.
const mtr = (id, warga_id, bulan, tahun, total_tagihan) => ({
  id, warga_id, bulan, tahun, total_tagihan
});
const byr = (warga_id, meteran_id, bulan, tahun, jumlah_bayar, keterangan = '') => ({
  warga_id, meteran_id, bulan, tahun, jumlah_bayar, keterangan
});

const buatState = (meteran, pembayaran, warga) => ({
  warga: warga || [{ id: 1, nama: 'Warga Uji', alamat: 'Blok A', adalah_pengelola: false }],
  meteran,
  pembayaran
});

describe('getTunggakanBulanan — dasar', () => {
  it('lunas semua -> 0 bulan', () => {
    const meteran = [mtr(10, 1, 8, 2026, 80000), mtr(11, 1, 9, 2026, 64000)];
    const pembayaran = [byr(1, 10, 8, 2026, 80000), byr(1, 11, 9, 2026, 64000)];
    const r = getTunggakanBulanan(1, 9, 2026, buatState(meteran, pembayaran));
    expect(r.jumlahBulan).toBe(0);
    expect(r.totalSisa).toBe(0);
  });

  it('hanya bulan berjalan yang belum dibayar -> 1 bulan', () => {
    const meteran = [mtr(10, 1, 8, 2026, 80000), mtr(11, 1, 9, 2026, 64000)];
    const pembayaran = [byr(1, 10, 8, 2026, 80000)];
    const r = getTunggakanBulanan(1, 9, 2026, buatState(meteran, pembayaran));
    expect(r.jumlahBulan).toBe(1);
    expect(r.totalSisa).toBe(64000);
    expect(r.periode).toEqual([{ bulan: 9, tahun: 2026, sisa: 64000 }]);
  });

  it('dua bulan menunggak -> 2 bulan dengan total gabungan', () => {
    const meteran = [mtr(10, 1, 8, 2026, 100000), mtr(11, 1, 9, 2026, 100000)];
    const r = getTunggakanBulanan(1, 9, 2026, buatState(meteran, []));
    expect(r.jumlahBulan).toBe(2);
    expect(r.totalSisa).toBe(200000);
  });

  it('pembayaran dialokasikan FIFO — bulan tertua lunas lebih dulu', () => {
    const meteran = [mtr(10, 1, 7, 2026, 50000), mtr(11, 1, 8, 2026, 50000), mtr(12, 1, 9, 2026, 50000)];
    // Bayar 60.000 total: Juli lunas, Agustus kurang 40.000, September penuh
    const pembayaran = [byr(1, 12, 9, 2026, 60000)];
    const r = getTunggakanBulanan(1, 9, 2026, buatState(meteran, pembayaran));
    expect(r.jumlahBulan).toBe(2);
    expect(r.periode).toEqual([
      { bulan: 8, tahun: 2026, sisa: 40000 },
      { bulan: 9, tahun: 2026, sisa: 50000 }
    ]);
    expect(r.totalSisa).toBe(90000);
  });

  it('periode setelah bulan yang diminta tidak ikut dihitung', () => {
    const meteran = [mtr(10, 1, 9, 2026, 50000), mtr(11, 1, 10, 2026, 50000)];
    const r = getTunggakanBulanan(1, 9, 2026, buatState(meteran, []));
    expect(r.jumlahBulan).toBe(1);
  });

  it('bulan bertagihan 0 tidak dianggap menunggak', () => {
    const meteran = [mtr(10, 1, 8, 2026, 0), mtr(11, 1, 9, 2026, 40000)];
    const r = getTunggakanBulanan(1, 9, 2026, buatState(meteran, []));
    expect(r.jumlahBulan).toBe(1);
  });

  it('pengelola RT tidak pernah menunggak', () => {
    const warga = [{ id: 1, nama: 'Pengelola', alamat: 'Blok A', adalah_pengelola: true }];
    const meteran = [mtr(10, 1, 9, 2026, 50000)];
    const r = getTunggakanBulanan(1, 9, 2026, buatState(meteran, [], warga));
    expect(r.jumlahBulan).toBe(0);
  });

  it('kelebihan bayar tidak membuat jumlah bulan negatif', () => {
    const meteran = [mtr(10, 1, 9, 2026, 50000)];
    const pembayaran = [byr(1, 10, 9, 2026, 80000)];
    const r = getTunggakanBulanan(1, 9, 2026, buatState(meteran, pembayaran));
    expect(r.jumlahBulan).toBe(0);
    expect(r.totalSisa).toBe(0);
  });
});

describe('getTunggakanBulanan — pembayaran patungan tidak ikut', () => {
  it('patungan yang terhubung ke meteran warga SISTEM diabaikan', () => {
    const warga = [
      { id: 1, nama: 'Warga Uji', alamat: 'Blok A', adalah_pengelola: false },
      { id: 386, nama: 'Kas RT (Umum)', alamat: 'SISTEM', adalah_pengelola: false }
    ];
    const meteran = [
      mtr(10, 1, 9, 2026, 100000),
      mtr(900, 386, 9, 2026, 100000) // meteran virtual milik Kas RT
    ];
    const pembayaran = [byr(1, 900, 9, 2026, 100000, '[PATUNGAN] Perbaikan Pompa')];

    const r = getTunggakanBulanan(1, 9, 2026, buatState(meteran, pembayaran, warga));
    // Patungan tidak boleh melunasi tagihan air
    expect(r.jumlahBulan).toBe(1);
    expect(r.totalSisa).toBe(100000);
  });

  it('pembayaran tanpa meteran_id diabaikan', () => {
    const meteran = [mtr(10, 1, 9, 2026, 50000)];
    const pembayaran = [byr(1, null, 9, 2026, 50000)];
    const r = getTunggakanBulanan(1, 9, 2026, buatState(meteran, pembayaran));
    expect(r.jumlahBulan).toBe(1);
  });
});

describe('getTunggakanBulanan — kasus Sukiono (data asli)', () => {
  // Riwayat nyata: Okt 2025 - Sep 2026 tagihan total Rp 912.000 dan sudah
  // terbayar penuh; Oktober 2026 Rp 72.000 belum dibayar.
  const tagihanRiwayat = [
    [10, 2025, 100000], [11, 2025, 68000], [12, 2025, 64000],
    [1, 2026, 64000], [2, 2026, 96000], [3, 2026, 80000], [4, 2026, 48000],
    [5, 2026, 48000], [6, 2026, 56000], [7, 2026, 56000], [8, 2026, 128000],
    [9, 2026, 104000], [10, 2026, 72000]
  ];
  const meteran = tagihanRiwayat.map(([bln, thn, tag], i) => mtr(100 + i, 398, bln, thn, tag));

  const warga = [{ id: 398, nama: 'Sukiono', alamat: 'Blok Utama RT 01', adalah_pengelola: false }];

  // Total dibayar Rp 912.000 (persis menutup Okt 2025 - Sep 2026)
  const pembayaran = [
    byr(398, 100, 10, 2025, 100000), byr(398, 101, 11, 2025, 68000), byr(398, 102, 12, 2025, 64000),
    byr(398, 103, 1, 2026, 64000), byr(398, 104, 2, 2026, 96000), byr(398, 105, 3, 2026, 80000),
    byr(398, 106, 4, 2026, 48000), byr(398, 107, 5, 2026, 72000), byr(398, 108, 6, 2026, 100000),
    byr(398, 110, 8, 2026, 116000), byr(398, 111, 9, 2026, 104000)
  ];

  it('menunggak tepat 1 bulan — tidak diberi label di teks WhatsApp', () => {
    const r = getTunggakanBulanan(398, 10, 2026, buatState(meteran, pembayaran, warga));
    expect(r.jumlahBulan).toBe(1);
    expect(r.totalSisa).toBe(72000);
    expect(r.periode).toEqual([{ bulan: 10, tahun: 2026, sisa: 72000 }]);
  });

  it('sampai September 2026 posisinya bersih', () => {
    const r = getTunggakanBulanan(398, 9, 2026, buatState(meteran, pembayaran, warga));
    expect(r.jumlahBulan).toBe(0);
  });

  it('nominalnya sama dengan sisa dari getWargaBillingSummary', () => {
    const state = buatState(meteran, pembayaran, warga);
    const tunggakan = getTunggakanBulanan(398, 10, 2026, state);
    const { sisa } = getWargaBillingSummary(398, 72000, 0, 10, 2026, state);
    expect(tunggakan.totalSisa).toBe(sisa);
  });

  it('bila Oktober juga terlewat, November jadi 2 bulan', () => {
    const plusNov = [...meteran, mtr(200, 398, 11, 2026, 64000)];
    const r = getTunggakanBulanan(398, 11, 2026, buatState(plusNov, pembayaran, warga));
    expect(r.jumlahBulan).toBe(2);
    expect(r.totalSisa).toBe(136000); // 72.000 + 64.000
  });
});
