import { describe, it, expect } from 'vitest';
import { getWargaDeposit as getOldDeposit, getWargaTunggakanLalu as getOldTunggakan } from './billing.js';
import { calculateDeposit, calculateArrears, evaluatePaymentStatus, calculateBill, getWargaBillingSummary } from './billingEngine.js';

const stateMock = {
  warga: [
    { id: 1, nama: 'Normal', aktif: true, adalah_pengelola: false, alamat: 'Rumah' },
    { id: 2, nama: 'Pengelola', aktif: true, adalah_pengelola: true, alamat: 'Rumah' },
    { id: 3, nama: 'SISTEM', aktif: true, adalah_pengelola: false, alamat: 'SISTEM' }
  ],
  meteran: [
    { id: 'm1', warga_id: 1, bulan: 1, tahun: 2026, total_tagihan: 100000 },
    { id: 'm2', warga_id: 2, bulan: 1, tahun: 2026, total_tagihan: 80000 },
    { id: 'm3', warga_id: 1, bulan: 2, tahun: 2026, total_tagihan: 100000 }
  ],
  pembayaran: [
    { id: 'p1', warga_id: 1, meteran_id: 'm1', bulan: 1, tahun: 2026, jumlah_bayar: 100000 },
    { id: 'p2', warga_id: 2, meteran_id: 'm2', bulan: 2, tahun: 2026, jumlah_bayar: 50000 },
    { id: 'p3', warga_id: 1, meteran_id: 'm3', bulan: 1, tahun: 2026, jumlah_bayar: 200000 },
    { id: 'p4', warga_id: 3, meteran_id: 'mSys', bulan: 1, tahun: 2026, jumlah_bayar: 500000 }
  ]
};

describe('Billing Engine Tests', () => {
  it('should calculate deposit correctly between old and new engine', () => {
    stateMock.warga.forEach(() => {
      const oldDep = getOldDeposit(1, 1, 2026, stateMock);
      const newDep = calculateDeposit(1, 1, 2026, stateMock);
      expect(newDep).toBe(oldDep);
    });
  });

  it('should calculate arrears correctly between old and new engine', () => {
    stateMock.warga.forEach(() => {
      const oldArrears = getOldTunggakan(1, 1, 2026, stateMock);
      const newArrears = calculateArrears(1, 1, 2026, stateMock);
      expect(newArrears).toBe(oldArrears);
    });
  });

  it('should evaluate payment status correctly', () => {
    stateMock.warga.forEach(() => {
      const result = evaluatePaymentStatus(100000, 80000, 20000);
      expect(typeof result).toBe('string');
    });
  });

  it('should calculate bill correctly', () => {
    stateMock.warga.forEach(() => {
      const bill = calculateBill(1, 1, 2026, stateMock);
      expect(typeof bill).toBe('number');
    });
  });

  it('should get warga billing summary correctly', () => {
    stateMock.warga.forEach(() => {
      const summary = getWargaBillingSummary(1, 100000, 80000, 1, 2026, stateMock);
      expect(summary).toHaveProperty('tagihan');
      expect(summary).toHaveProperty('deposit');
      expect(summary).toHaveProperty('tunggakanLalu');
      expect(summary).toHaveProperty('sisa');
    });
  });
});

// Aturan "pembayaran patungan tidak melunasi tagihan air" kini tinggal satu
// salinan di dalam billingEngine, dipakai bersama oleh perhitungan tunggakan,
// deposit, dan rincian tunggakan per bulan. Diuji dari kedua sisi agar
// salinan tunggal itu tidak bisa berubah diam-diam.
describe('Pembayaran patungan tidak ikut melunasi tagihan air', () => {
  const warga = [
    { id: 1, nama: 'Warga', aktif: true, adalah_pengelola: false, alamat: 'Rumah' },
    { id: 9, nama: 'Kas RT (Umum)', aktif: true, adalah_pengelola: false, alamat: 'SISTEM' }
  ];
  const meteran = [
    { id: 'a1', warga_id: 1, bulan: 1, tahun: 2026, total_tagihan: 100000 },
    { id: 'sys', warga_id: 9, bulan: 1, tahun: 2026, total_tagihan: 500000 }
  ];

  it('patungan ke meteran warga SISTEM tidak mengurangi tunggakan', () => {
    const state = {
      warga, meteran,
      pembayaran: [
        { id: 'x1', warga_id: 1, meteran_id: 'sys', bulan: 1, tahun: 2026, jumlah_bayar: 100000,
          keterangan: '[PATUNGAN] Perbaikan Pompa' }
      ]
    };
    expect(calculateArrears(1, 2, 2026, state)).toBe(100000);
    expect(calculateDeposit(1, 2, 2026, state)).toBe(0);
  });

  it('pembayaran air biasa tetap mengurangi tunggakan', () => {
    const state = {
      warga, meteran,
      pembayaran: [
        { id: 'x2', warga_id: 1, meteran_id: 'a1', bulan: 1, tahun: 2026, jumlah_bayar: 100000 }
      ]
    };
    expect(calculateArrears(1, 2, 2026, state)).toBe(0);
  });

  it('pembayaran tanpa meteran_id diabaikan', () => {
    const state = {
      warga, meteran,
      pembayaran: [
        { id: 'x3', warga_id: 1, meteran_id: null, bulan: 1, tahun: 2026, jumlah_bayar: 100000 }
      ]
    };
    expect(calculateArrears(1, 2, 2026, state)).toBe(100000);
  });

  it('kelebihan bayar air tetap menjadi deposit', () => {
    const state = {
      warga, meteran,
      pembayaran: [
        { id: 'x4', warga_id: 1, meteran_id: 'a1', bulan: 1, tahun: 2026, jumlah_bayar: 130000 }
      ]
    };
    expect(calculateDeposit(1, 2, 2026, state)).toBe(30000);
    expect(calculateArrears(1, 2, 2026, state)).toBe(0);
  });
});
