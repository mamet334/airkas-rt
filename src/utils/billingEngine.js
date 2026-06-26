import { getCycleDateRange, getCycleMonthYear } from './cycleEngine.js';

// 1. Arrears (Tunggakan Lalu)
export const calculateArrears = (wargaId, m, y, state) => {
  const w = state.warga.find(wg => wg.id === wargaId);
  if (w && w.adalah_pengelola) return 0; // Pengelola RT tidak memiliki deposit/tunggakan

  const pastMeters = state.meteran.filter(x => {
    if (x.warga_id !== wargaId) return false;
    return (x.tahun < y) || (x.tahun === y && x.bulan < m);
  });
  const totalTagihan = pastMeters.reduce((s, x) => s + x.total_tagihan, 0);

  const pastPayments = state.pembayaran.filter(x => {
    if (x.warga_id !== wargaId) return false;
    if (x.meteran_id === null) return false;

    const mtr = state.meteran.find(met => met.id === x.meteran_id);
    if (mtr) {
      const wg = state.warga.find(wItem => wItem.id === mtr.warga_id);
      if (wg && wg.alamat === 'SISTEM') return false;
    }

    return (x.tahun < y) || (x.tahun === y && x.bulan < m);
  });
  const totalBayar = pastPayments.reduce((s, x) => s + x.jumlah_bayar, 0);

  return Math.max(0, totalTagihan - totalBayar);
};

// 2. Deposit
export const calculateDeposit = (wargaId, m, y, state) => {
  const w = state.warga.find(wg => wg.id === wargaId);
  if (w && w.adalah_pengelola) return 0; // Pengelola RT tidak memiliki deposit/tunggakan

  const pastMeters = state.meteran.filter(x => {
    if (x.warga_id !== wargaId) return false;
    return (x.tahun < y) || (x.tahun === y && x.bulan < m);
  });
  const totalTagihan = pastMeters.reduce((s, x) => s + x.total_tagihan, 0);

  const pastPayments = state.pembayaran.filter(x => {
    if (x.warga_id !== wargaId) return false;
    if (x.meteran_id === null) return false;

    const mtr = state.meteran.find(met => met.id === x.meteran_id);
    if (mtr) {
      const wg = state.warga.find(wItem => wItem.id === mtr.warga_id);
      if (wg && wg.alamat === 'SISTEM') return false;
    }

    return (x.tahun < y) || (x.tahun === y && x.bulan < m);
  });
  const totalBayar = pastPayments.reduce((s, x) => s + x.jumlah_bayar, 0);

  return Math.max(0, totalBayar - totalTagihan);
};

// 3. Payment Status (Extracted from Pembayaran.jsx)
export const evaluatePaymentStatus = (tagihan, sudahBayar, deposit) => {
  if (tagihan === 0) {
    return 'Lunas';
  } else if (sudahBayar >= tagihan) {
    return 'Lunas';
  } else if (sudahBayar + deposit >= tagihan) {
    return 'Lunas (Deposit)';
  } else if (sudahBayar > 0) {
    return 'Sebagian';
  }
  return 'Belum Bayar';
};

// 4. Calculate Bill (Extracted from PencatatanMeteran.jsx)
export const calculateBill = (meterLalu, meterSekarang, tarifPerM3, adalahPengelola) => {
  const pemakaian = Math.max(0, meterSekarang - meterLalu);
  return adalahPengelola ? 0 : (pemakaian * tarifPerM3);
};

// 5. Billing Summary (Combined util to remove duplicates in Dashboard/Laporan/Pembayaran)
export const getWargaBillingSummary = (wargaId, rawTagihan, sudahBayar, m, y, state) => {
  const w = state.warga.find(x => x.id === wargaId);
  const tagihan = (w && w.adalah_pengelola) ? 0 : (rawTagihan || 0);
  
  const deposit = calculateDeposit(wargaId, m, y, state);
  const tunggakanLalu = calculateArrears(wargaId, m, y, state);
  
  const kewajiban = tagihan + tunggakanLalu;
  const sisa = kewajiban - sudahBayar - deposit;

  return { tagihan, deposit, tunggakanLalu, kewajiban, sisa };
};

// Backward Compatibility Aliases
export const getWargaTunggakanLalu = calculateArrears;
export const getWargaDeposit = calculateDeposit;
export { getCycleDateRange, getCycleMonthYear };

export const filterByrBySiklus = (pembayaran, month, year) => {
  const { start, end } = getCycleDateRange(month, year);
  return pembayaran.filter(p => {
    const tgl = (p.tanggal_bayar || '').split('T')[0];
    return tgl >= start && tgl <= end;
  });
};

export const filterKlrBySiklus = (pengeluaran, month, year) => {
  const { start, end } = getCycleDateRange(month, year);
  return pengeluaran.filter(k => {
    const tgl = (k.tanggal || '').split('T')[0];
    return tgl >= start && tgl <= end;
  });
};
