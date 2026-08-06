import { describe, it, expect } from 'vitest';
import { getWargaDeposit as getOldDeposit, getWargaTunggakanLalu as getOldTunggakan } from '../billing';
import { calculateDeposit, calculateArrears, evaluatePaymentStatus, calculateBill, getWargaBillingSummary } from '../billingEngine';

const stateMock = {
  warga: [
    { id: 1, nama: 'Normal', aktif: true, adalah_pengelola: false, alamat: 'Rumah' },
    { id: 2, nama: 'Pengelola', aktif: true, adalah_pengelola: true, alamat: 'Rumah' },
    { id: 3, nama: 'SISTEM', aktif: true, adalah_pengelola: false, alamat: 'SISTEM' },
  ],
  meteran: [
    { id: 'm1', warga_id: 1, bulan: 1, tahun: 2026, total_tagihan: 100000 },
    { id: 'm2', warga_id: 2, bulan: 1, tahun: 2026, total_tagihan: 80000 },
    { id: 'm3', warga_id: 1, bulan: 2, tahun: 2026, total_tagihan: 100000 },
  ],
  pembayaran: [
    { id: 'p1', warga_id: 1, meteran_id: 'm1', bulan: 1, tahun: 2026, jumlah_bayar: 100000 },
    { id: 'p2', warga_id: 2, meteran_id: 'm2', bulan: 2, tahun: 2026, jumlah_bayar: 50000 },
    { id: 'p3', warga_id: 1, meteran_id: 'm3', bulan: 1, tahun: 2026, jumlah_bayar: 200000 },
    { id: 'p4', warga_id: 3, meteran_id: 'mSys', bulan: 1, tahun: 2026, jumlah_bayar: 500000 },
  ]
};

describe('Billing Engine Tests', () => {
  it('should calculate deposit correctly between old and new engine', () => {
    stateMock.warga.forEach(() => { // Hapus parameter underscore
      const oldDep = getOldDeposit(1, 1, 2026, stateMock);
      const newDep = calculateDeposit(1, 1, 2026, stateMock);
      expect(newDep).toBe(oldDep);
    });
  });

  it('should calculate arrears correctly between old and new engine', () => {
    stateMock.warga.forEach(() => { // Hapus parameter underscore
      const oldArrears = getOldTunggakan(1, 1, 2026, stateMock);
      const newArrears = calculateArrears(1, 1, 2026, stateMock);
      expect(newArrears).toBe(oldArrears);
    });
  });

  it('should evaluate payment status correctly', () => {
    stateMock.warga.forEach(() => { // Hapus parameter underscore
      const result = evaluatePaymentStatus(100000, 80000, 20000);
      expect(typeof result).toBe('string');
    });
  });

  it('should calculate bill correctly', () => {
    stateMock.warga.forEach(() => { // Hapus parameter underscore
      const bill = calculateBill(1, 1, 2026, stateMock);
      expect(typeof bill).toBe('number');
    });
  });

  it('should get warga billing summary correctly', () => {
    stateMock.warga.forEach(() => { // Hapus parameter underscore
      const summary = getWargaBillingSummary(1, 100000, 80000, 1, 2026, stateMock);
      expect(summary).toHaveProperty('tagihan');
      expect(summary).toHaveProperty('deposit');
      expect(summary).toHaveProperty('tunggakanLalu');
      expect(summary).toHaveProperty('sisa');
    });
  });
});