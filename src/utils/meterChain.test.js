import { describe, it, expect } from 'vitest';
import {
  periodKey,
  periodeBerikutnya,
  siklusEfektifPenggantian,
  findBarisTerakhir,
  findPenggantianTerakhir,
  resolveMeterLalu,
  hitungPemakaian
} from './meterChain.js';

const mtr = (warga_id, bulan, tahun, meter_lalu, meter_sekarang) => ({
  warga_id, bulan, tahun, meter_lalu, meter_sekarang
});

describe('meterChain — periodKey', () => {
  it('mengurutkan periode lintas tahun dengan benar', () => {
    expect(periodKey(1, 2026)).toBeGreaterThan(periodKey(12, 2025));
    expect(periodKey(10, 2026)).toBeGreaterThan(periodKey(9, 2026));
  });
});

describe('meterChain — tanpa penggantian (perilaku lama harus utuh)', () => {
  const meteran = [
    mtr(1, 8, 2026, 85, 101),
    mtr(1, 9, 2026, 101, 114),
    mtr(1, 10, 2026, 114, 123)
  ];

  it('meter lalu diambil dari baris sebelumnya', () => {
    const r = resolveMeterLalu(1, 10, 2026, { meteran });
    expect(r.meterLalu).toBe(114);
    expect(r.isRantaiBaru).toBe(false);
    expect(r.pemakaianMeterLama).toBe(0);
  });

  it('warga yang belum punya catatan mulai dari 0', () => {
    const r = resolveMeterLalu(99, 10, 2026, { meteran });
    expect(r.meterLalu).toBe(0);
  });

  it('tahan terhadap bulan yang terlewat — tidak jatuh ke 0', () => {
    // Tidak ada catatan September; November harus tetap menyambung dari Oktober
    const bolong = [mtr(1, 10, 2026, 114, 123)];
    const r = resolveMeterLalu(1, 12, 2026, { meteran: bolong });
    expect(r.meterLalu).toBe(123);
  });

  it('tidak tertukar antar warga', () => {
    const campur = [mtr(1, 10, 2026, 114, 123), mtr(2, 10, 2026, 40, 48)];
    expect(resolveMeterLalu(2, 11, 2026, { meteran: campur }).meterLalu).toBe(48);
  });
});

describe('meterChain — kasus Sukiono (ganti setelah pencatatan)', () => {
  // Angka asli: Oktober 2026 tercatat 114 -> 123, lalu meteran fisik diganti
  // pada 15 Okt sehingga penggantian berlaku mulai siklus November 2026.
  const meteran = [
    mtr(398, 9, 2026, 101, 114),
    mtr(398, 10, 2026, 114, 123)
  ];
  const penggantian = [{
    id: 1, warga_id: 398, tanggal: '2026-10-15', bulan: 11, tahun: 2026,
    no_meter_lama: 'M-012', meter_akhir_lama: null,
    no_meter_baru: 'M-012B', meter_awal_baru: 0
  }];

  it('Oktober tidak terpengaruh — tagihan lama tetap utuh', () => {
    const r = resolveMeterLalu(398, 10, 2026, { meteran, penggantian });
    expect(r.meterLalu).toBe(114);
    expect(r.isRantaiBaru).toBe(false);
  });

  it('November mulai dari 0, bukan 123', () => {
    const r = resolveMeterLalu(398, 11, 2026, { meteran, penggantian });
    expect(r.meterLalu).toBe(0);
    expect(r.isRantaiBaru).toBe(true);
    expect(r.meterSebelumGanti).toBe(123);
  });

  it('angka akhir meteran lama dikosongkan -> sisa pemakaian diabaikan', () => {
    const r = resolveMeterLalu(398, 11, 2026, { meteran, penggantian });
    expect(r.pemakaianMeterLama).toBe(0);
  });

  it('angka meteran baru yang kecil tidak lagi dianggap mundur', () => {
    const { meterLalu, pemakaianMeterLama } = resolveMeterLalu(398, 11, 2026, { meteran, penggantian });
    expect(hitungPemakaian(8, meterLalu, pemakaianMeterLama)).toBe(8);
  });

  it('Desember menyambung dari meteran baru, bukan mengulang dari 0', () => {
    const lanjut = [...meteran, mtr(398, 11, 2026, 0, 8)];
    const r = resolveMeterLalu(398, 12, 2026, { meteran: lanjut, penggantian });
    expect(r.meterLalu).toBe(8);
    expect(r.isRantaiBaru).toBe(false);
    expect(r.pemakaianMeterLama).toBe(0);
  });
});

describe('meterChain — ganti di tengah siklus (angka akhir lama dicatat)', () => {
  const meteran = [mtr(5, 9, 2026, 50, 60)];
  const penggantian = [{
    id: 2, warga_id: 5, tanggal: '2026-09-25', bulan: 10, tahun: 2026,
    meter_akhir_lama: 66, meter_awal_baru: 0
  }];

  it('sisa pemakaian meteran lama ikut ditagih', () => {
    const r = resolveMeterLalu(5, 10, 2026, { meteran, penggantian });
    expect(r.meterLalu).toBe(0);
    expect(r.pemakaianMeterLama).toBe(6); // 66 - 60
  });

  it('total pemakaian = sisa meteran lama + pemakaian meteran baru', () => {
    const { meterLalu, pemakaianMeterLama } = resolveMeterLalu(5, 10, 2026, { meteran, penggantian });
    expect(hitungPemakaian(9, meterLalu, pemakaianMeterLama)).toBe(15); // 6 + 9
  });

  it('sisa pemakaian lama tidak ditagih ulang di siklus berikutnya', () => {
    const lanjut = [...meteran, mtr(5, 10, 2026, 0, 9)];
    const r = resolveMeterLalu(5, 11, 2026, { meteran: lanjut, penggantian });
    expect(r.pemakaianMeterLama).toBe(0);
    expect(r.meterLalu).toBe(9);
  });

  it('angka akhir lama lebih kecil dari catatan terakhir tidak jadi negatif', () => {
    const aneh = [{ ...penggantian[0], meter_akhir_lama: 55 }];
    const r = resolveMeterLalu(5, 10, 2026, { meteran, penggantian: aneh });
    expect(r.pemakaianMeterLama).toBe(0);
  });
});

describe('meterChain — meteran bekas yang tidak mulai dari 0', () => {
  it('memakai angka awal yang diisi admin', () => {
    const meteran = [mtr(7, 9, 2026, 100, 120)];
    const penggantian = [{ id: 3, warga_id: 7, bulan: 10, tahun: 2026, meter_awal_baru: 35 }];
    const r = resolveMeterLalu(7, 10, 2026, { meteran, penggantian });
    expect(r.meterLalu).toBe(35);
    expect(hitungPemakaian(42, r.meterLalu, r.pemakaianMeterLama)).toBe(7);
  });
});

describe('meterChain — penggantian berkali-kali (syarat: tanpa ubah kode lagi)', () => {
  const meteran = [
    mtr(9, 10, 2026, 0, 12),   // meteran kedua
    mtr(9, 11, 2026, 0, 5)     // meteran ketiga
  ];
  const penggantian = [
    { id: 10, warga_id: 9, bulan: 10, tahun: 2026, meter_awal_baru: 0 },
    { id: 11, warga_id: 9, bulan: 11, tahun: 2026, meter_awal_baru: 0 }
  ];

  it('penggantian kedua tetap mereset rantai', () => {
    const r = resolveMeterLalu(9, 11, 2026, { meteran: [meteran[0]], penggantian });
    expect(r.meterLalu).toBe(0);
    expect(r.isRantaiBaru).toBe(true);
  });

  it('siklus setelah penggantian terakhir menyambung normal', () => {
    const r = resolveMeterLalu(9, 12, 2026, { meteran, penggantian });
    expect(r.meterLalu).toBe(5);
    expect(r.isRantaiBaru).toBe(false);
  });

  it('event lama tidak menarik ulang rantai yang sudah berjalan', () => {
    // Event Oktober sudah dilewati oleh catatan Oktober & November
    const r = resolveMeterLalu(9, 12, 2026, { meteran, penggantian: [penggantian[0]] });
    expect(r.meterLalu).toBe(5);
  });
});

describe('meterChain — pembantu pencarian', () => {
  const meteran = [mtr(1, 9, 2026, 101, 114), mtr(1, 10, 2026, 114, 123)];

  it('findBarisTerakhir mengabaikan periode saat ini dan sesudahnya', () => {
    expect(findBarisTerakhir(1, 10, 2026, meteran).meter_sekarang).toBe(114);
    expect(findBarisTerakhir(1, 9, 2026, meteran)).toBeNull();
  });

  it('findPenggantianTerakhir memasukkan periode saat ini', () => {
    const g = [{ id: 1, warga_id: 1, bulan: 10, tahun: 2026, meter_awal_baru: 0 }];
    expect(findPenggantianTerakhir(1, 10, 2026, g)).not.toBeNull();
    expect(findPenggantianTerakhir(1, 9, 2026, g)).toBeNull();
  });

  it('aman saat daftar kosong atau tidak dikirim', () => {
    expect(findBarisTerakhir(1, 10, 2026, [])).toBeNull();
    expect(findPenggantianTerakhir(1, 10, 2026)).toBeNull();
    expect(resolveMeterLalu(1, 10, 2026).meterLalu).toBe(0);
  });
});

describe('meterChain — hitungPemakaian', () => {
  it('tidak pernah negatif', () => {
    expect(hitungPemakaian(5, 10)).toBe(0);
  });

  it('menangani nilai kosong', () => {
    expect(hitungPemakaian('', 0)).toBe(0);
    expect(hitungPemakaian(null, null)).toBe(0);
  });

  it('menerima angka desimal seperti data lama (12.5 m3)', () => {
    expect(hitungPemakaian(21, 12.5)).toBe(8.5);
  });
});

describe('meterChain — siklus efektif penggantian', () => {
  // Riwayat Sukiono: pembacaan Oktober 2026 sudah diambil (114 -> 123) pada
  // 15 Okt, lalu meteran fisik diganti pada hari yang sama.
  const meteranSukiono = [
    mtr(398, 9, 2026, 101, 114),
    mtr(398, 10, 2026, 114, 123)
  ];

  it('ganti setelah pembacaan siklus itu -> berlaku siklus BERIKUTNYA', () => {
    const r = siklusEfektifPenggantian(398, '2026-10-15', meteranSukiono);
    expect(r).toEqual({ bulan: 11, tahun: 2026 });
  });

  it('ganti sebelum pembacaan siklus itu -> berlaku siklus itu juga', () => {
    // Siklus Oktober belum dicatat
    const belumOktober = [mtr(398, 9, 2026, 101, 114)];
    const r = siklusEfektifPenggantian(398, '2026-10-15', belumOktober);
    expect(r).toEqual({ bulan: 10, tahun: 2026 });
  });

  it('ganti di tengah siklus setelah pembacaan -> siklus berikutnya', () => {
    // 25 Sep jatuh di siklus September; September sudah dicatat
    const r = siklusEfektifPenggantian(398, '2026-09-25', meteranSukiono);
    expect(r).toEqual({ bulan: 10, tahun: 2026 });
  });

  it('warga tanpa catatan sama sekali -> siklus tanggal itu sendiri', () => {
    const r = siklusEfektifPenggantian(77, '2026-10-15', meteranSukiono);
    expect(r).toEqual({ bulan: 10, tahun: 2026 });
  });

  it('melewati pergantian tahun dengan benar', () => {
    const akhirTahun = [mtr(1, 12, 2026, 10, 20)];
    const r = siklusEfektifPenggantian(1, '2026-12-20', akhirTahun);
    expect(r).toEqual({ bulan: 1, tahun: 2027 });
  });

  it('periodeBerikutnya menangani Desember -> Januari', () => {
    expect(periodeBerikutnya(12, 2026)).toEqual({ bulan: 1, tahun: 2027 });
    expect(periodeBerikutnya(10, 2026)).toEqual({ bulan: 11, tahun: 2026 });
  });

  it('siklus hasilnya membuat angka akhir meteran lama terbaca 123, bukan 114', () => {
    const efektif = siklusEfektifPenggantian(398, '2026-10-15', meteranSukiono);
    const dasar = resolveMeterLalu(398, efektif.bulan, efektif.tahun, { meteran: meteranSukiono });
    expect(dasar.meterSebelumGanti).toBe(123);
  });

  it('Oktober yang sudah ditagih tidak ikut terpengaruh oleh event November', () => {
    const efektif = siklusEfektifPenggantian(398, '2026-10-15', meteranSukiono);
    const penggantian = [{
      id: 1, warga_id: 398, bulan: efektif.bulan, tahun: efektif.tahun,
      meter_akhir_lama: null, meter_awal_baru: 0
    }];
    const oktober = resolveMeterLalu(398, 10, 2026, { meteran: meteranSukiono, penggantian });
    expect(oktober.meterLalu).toBe(114);     // tetap seperti semula
    expect(oktober.isRantaiBaru).toBe(false);
  });
});
