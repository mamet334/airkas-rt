import { getWargaDeposit as getOldDeposit, getWargaTunggakanLalu as getOldTunggakan } from './billing.js';
import { calculateDeposit, calculateArrears, evaluatePaymentStatus, calculateBill, getWargaBillingSummary } from './billingEngine.js';

let passed = true;

const stateMock = {
  warga: [
    { id: 1, nama: 'Normal', aktif: true, adalah_pengelola: false, alamat: 'Rumah' },
    { id: 2, nama: 'Pengelola', aktif: true, adalah_pengelola: true, alamat: 'Rumah' },
    { id: 3, nama: 'SISTEM', aktif: true, adalah_pengelola: false, alamat: 'SISTEM' }
  ],
  meteran: [
    { id: 'm1', warga_id: 1, bulan: 1, tahun: 2026, total_tagihan: 100000 },
    { id: 'm2', warga_id: 1, bulan: 2, tahun: 2026, total_tagihan: 80000 },
    { id: 'm3', warga_id: 2, bulan: 1, tahun: 2026, total_tagihan: 100000 }
  ],
  pembayaran: [
    { id: 'p1', warga_id: 1, meteran_id: 'm1', bulan: 1, tahun: 2026, jumlah_bayar: 100000 },
    { id: 'p2', warga_id: 1, meteran_id: 'm2', bulan: 2, tahun: 2026, jumlah_bayar: 50000 }, // Underpay
    { id: 'p3', warga_id: 1, meteran_id: 'm1', bulan: 1, tahun: 2025, jumlah_bayar: 200000 }, // Overpay old month to test deposit
    { id: 'p4', warga_id: 3, meteran_id: 'mSys', bulan: 1, tahun: 2026, jumlah_bayar: 500000 } // Sistem payment
  ]
};

const checkParity = (wargaId, m, y) => {
  const oldDep = getOldDeposit(wargaId, m, y, stateMock);
  const newDep = calculateDeposit(wargaId, m, y, stateMock);
  if (oldDep !== newDep) {
    console.error(`MISMATCH Deposit Warga ${wargaId}: Old ${oldDep} vs New ${newDep}`);
    passed = false;
  }

  const oldArr = getOldTunggakan(wargaId, m, y, stateMock);
  const newArr = calculateArrears(wargaId, m, y, stateMock);
  if (oldArr !== newArr) {
    console.error(`MISMATCH Tunggakan Warga ${wargaId}: Old ${oldArr} vs New ${newArr}`);
    passed = false;
  }

  // Uji utilitas getWargaBillingSummary terhadap perhitungan manual
  const w = stateMock.warga.find(x => x.id === wargaId);
  const rawTagihan = 50000;
  const sudahBayar = 10000;
  
  const manualTagihan = (w && w.adalah_pengelola) ? 0 : rawTagihan;
  const manualKewajiban = manualTagihan + oldArr;
  const manualSisa = manualKewajiban - sudahBayar - oldDep;

  const summary = getWargaBillingSummary(wargaId, rawTagihan, sudahBayar, m, y, stateMock);

  if (summary.tagihan !== manualTagihan) {
    console.error(`MISMATCH Summary Tagihan Warga ${wargaId}: Manual ${manualTagihan} vs Util ${summary.tagihan}`);
    passed = false;
  }
  if (summary.kewajiban !== manualKewajiban) {
    console.error(`MISMATCH Summary Kewajiban Warga ${wargaId}: Manual ${manualKewajiban} vs Util ${summary.kewajiban}`);
    passed = false;
  }
  if (summary.sisa !== manualSisa) {
    console.error(`MISMATCH Summary Sisa Warga ${wargaId}: Manual ${manualSisa} vs Util ${summary.sisa}`);
    passed = false;
  }
};

// Skenario 1: Bayar Sebagian & Tunggakan
checkParity(1, 3, 2026);
// Skenario 2: Pengelola (0)
checkParity(2, 3, 2026);
// Skenario 3: SISTEM (should ignore)
checkParity(3, 3, 2026);

// Status evaluation check
if (evaluatePaymentStatus(100000, 100000, 0) !== 'Lunas') passed = false;
if (evaluatePaymentStatus(100000, 50000, 0) !== 'Sebagian') passed = false;
if (evaluatePaymentStatus(100000, 150000, 0) !== 'Lunas') passed = false; // Overpay
if (evaluatePaymentStatus(100000, 0, 100000) !== 'Lunas (Deposit)') passed = false;
if (evaluatePaymentStatus(100000, 0, 0) !== 'Belum Bayar') passed = false;
if (evaluatePaymentStatus(0, 0, 0) !== 'Lunas') passed = false; // Pengelola

// Calculate Bill Check
if (calculateBill(100, 120, 8000, false) !== 160000) passed = false;
if (calculateBill(100, 80, 8000, false) !== 0) passed = false; // Meter turun -> 0 pemakaian
if (calculateBill(100, 120, 8000, true) !== 0) passed = false; // Pengelola

if (passed) {
  console.log('SUCCESS: Logic Parity Check 100% PASS (0 Mismatch)');
} else {
  console.log('FAILED: Mismatch detected');
  process.exit(1);
}
