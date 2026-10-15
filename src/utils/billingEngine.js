import { getCycleDateRange, getCycleMonthYear } from './cycleEngine.js';
import { periodKey } from './meterChain.js';

/**
 * Apakah sebuah pembayaran boleh dihitung sebagai pembayaran AIR milik warga.
 *
 * Diabaikan: pembayaran tanpa meteran, dan pembayaran yang terhubung ke
 * meteran milik warga SISTEM (mis. patungan perbaikan pompa) — supaya uang
 * patungan tidak ikut melunasi tagihan air.
 *
 * Aturan ini dulu disalin apa adanya di tiga tempat, sehingga perubahannya
 * harus diingat di tiga tempat pula. Sekarang hanya ada di sini.
 */
const isPembayaranAirWarga = (bayar, wargaId, state) => {
  if (bayar.warga_id !== wargaId) return false;
  if (bayar.meteran_id === null) return false;

  const mtr = state.meteran.find(met => met.id === bayar.meteran_id);
  if (mtr) {
    const wg = state.warga.find(w => w.id === mtr.warga_id);
    if (wg && wg.alamat === 'SISTEM') return false;
  }

  return true;
};

// 1. Arrears (Tunggakan Lalu)
export const calculateArrears = (wargaId, m, y, state) => {
  const w = state.warga.find(wg => wg.id === wargaId);
  if (w && w.adalah_pengelola) return 0; // Pengelola RT tidak memiliki deposit/tunggakan

  const pastMeters = state.meteran.filter(x => {
    if (x.warga_id !== wargaId) return false;
    return (x.tahun < y) || (x.tahun === y && x.bulan < m);
  });
  const totalTagihan = pastMeters.reduce((s, x) => s + x.total_tagihan, 0);

  const pastPayments = state.pembayaran.filter(x =>
    isPembayaranAirWarga(x, wargaId, state) &&
    ((x.tahun < y) || (x.tahun === y && x.bulan < m))
  );
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

  const pastPayments = state.pembayaran.filter(x =>
    isPembayaranAirWarga(x, wargaId, state) &&
    ((x.tahun < y) || (x.tahun === y && x.bulan < m))
  );
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

// 4b. Tunggakan per bulan (berapa BULAN warga menunggak, bukan hanya nominalnya)
//
// Nominal tunggakan saja tidak memberi tahu warga bahwa dia sudah tertinggal
// beberapa periode. Fungsi ini memecah kewajiban menjadi per bulan, lalu
// melunasinya secara FIFO (bulan tertua dibayar lebih dulu) dari seluruh
// pembayaran yang pernah masuk sampai periode yang diminta.
//
// Pembayaran yang terhubung ke meteran warga SISTEM (mis. patungan pompa)
// tidak ikut, sama seperti aturan di calculateArrears/calculateDeposit.
export const getTunggakanBulanan = (wargaId, m, y, state) => {
  const kosong = { jumlahBulan: 0, periode: [], totalSisa: 0 };

  const w = state.warga.find(x => x.id === wargaId);
  if (w && w.adalah_pengelola) return kosong; // Pengelola RT tidak ditagih

  const batas = periodKey(m, y);

  const tagihanBulanan = state.meteran
    .filter(x => x.warga_id === wargaId && periodKey(x.bulan, x.tahun) <= batas)
    .sort((a, b) => periodKey(a.bulan, a.tahun) - periodKey(b.bulan, b.tahun));

  let sisaUang = state.pembayaran
    .filter(x =>
      isPembayaranAirWarga(x, wargaId, state) &&
      periodKey(x.bulan, x.tahun) <= batas
    )
    .reduce((s, x) => s + (x.jumlah_bayar || 0), 0);

  const periode = [];
  let totalSisa = 0;

  for (const row of tagihanBulanan) {
    const tagihan = row.total_tagihan || 0;
    if (tagihan <= 0) continue; // bulan tanpa tagihan tidak dihitung menunggak

    const terbayar = Math.min(sisaUang, tagihan);
    sisaUang -= terbayar;

    const kurang = tagihan - terbayar;
    if (kurang > 0) {
      periode.push({ bulan: row.bulan, tahun: row.tahun, sisa: kurang });
      totalSisa += kurang;
    }
  }

  return { jumlahBulan: periode.length, periode, totalSisa };
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
