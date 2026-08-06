// src/utils/reportCalculations.js
import { MONTHS } from './format.js';

/**
 * Hitung total tagihan untuk periode tertentu
 */
export const calculateTotalTagihan = (meteranList, wargaList, pembayaranList) => {
  return meteranList.reduce((total, m) => {
    const warga = wargaList.find(w => w.id === m.warga_id);
    if (!warga || warga.alamat === 'SISTEM') return total;
    
    if (warga.adalah_pengelola) {
      const sudahBayar = pembayaranList
        .filter(p => p.meteran_id === m.id)
        .reduce((sum, p) => sum + p.jumlah_bayar, 0);
      return total + sudahBayar;
    }
    return total + m.total_tagihan;
  }, 0);
};

/**
 * Hitung pendapatan air dari pembayaran
 */
export const calculatePendapatanAir = (pembayaranList, meteranList, wargaList) => {
  return pembayaranList
    .filter(p => {
      const meteran = meteranList.find(m => m.id === p.meteran_id);
      if (!meteran) return false;
      const warga = wargaList.find(w => w.id === meteran.warga_id);
      return warga && warga.alamat !== 'SISTEM';
    })
    .reduce((total, p) => total + p.jumlah_bayar, 0);
};

/**
 * Hitung saldo kas (cash flow)
 */
export const calculateCashFlow = (saldoAwal, pemasukan, pengeluaran) => {
  return {
    saldoAwal,
    pemasukan,
    pengeluaran,
    saldoAkhir: saldoAwal + pemasukan - pengeluaran
  };
};

/**
 * Hitung ringkasan per bulan untuk laporan tahunan
 */
export const calculateMonthlySummary = (bulan, tahun, state) => {
  const { meteran, pembayaran, pengeluaran, warga } = state;
  
  const mBln = meteran.filter(x => {
    const w = warga.find(wg => wg.id === x.warga_id);
    return x.bulan === bulan && x.tahun === tahun && w && w.alamat !== 'SISTEM';
  });
  
  const pBln = pembayaran.filter(p => p.bulan === bulan && p.tahun === tahun);
  const kBln = pengeluaran.filter(k => {
    const kMonth = new Date(k.tanggal).getMonth() + 1;
    const kYear = new Date(k.tanggal).getFullYear();
    return kMonth === bulan && kYear === tahun;
  });

  const totalTagihan = calculateTotalTagihan(mBln, warga, pBln);
  const totalBayarWater = calculatePendapatanAir(pBln, meteran, warga);
  
  const allNonAirPayments = pBln.filter(p => {
    const mt = meteran.find(x => x.id === p.meteran_id);
    if (!mt) return true;
    const w = warga.find(wg => wg.id === mt.warga_id);
    return w && w.alamat === 'SISTEM';
  });

  const totalKasLain = allNonAirPayments
    .filter(p => !p.keterangan || !p.keterangan.startsWith('[PATUNGAN]'))
    .reduce((s, p) => s + p.jumlah_bayar, 0);

  const totalPemasukan = pBln.reduce((s, p) => s + p.jumlah_bayar, 0);
  const totalPengeluaran = kBln.reduce((s, k) => s + k.jumlah, 0);
  
  const patunganBln = allNonAirPayments.filter(p => 
    p.keterangan && p.keterangan.startsWith('[PATUNGAN]')
  );
  const totalPatungan = patunganBln.reduce((s, p) => s + p.jumlah_bayar, 0);

  const kPatungan = kBln.filter(k => k.kategori === 'Perbaikan Mesin (Patungan)');
  const totalKlrPatungan = kPatungan.reduce((s, k) => s + k.jumlah, 0);

  return {
    bulan,
    bulanNama: MONTHS[bulan],
    totalTagihan,
    totalBayarWater,
    totalKasLain,
    totalPemasukan,
    totalPengeluaran,
    saldoBersih: totalPemasukan - totalPengeluaran,
    totalPatungan,
    totalKlrPatungan
  };
};

// ... tambahkan fungsi perhitungan lainnya