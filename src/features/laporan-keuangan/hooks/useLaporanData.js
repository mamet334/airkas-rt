// src/features/laporan-keuangan/hooks/useLaporanData.js
import { useMemo } from 'react';
import { getCycleMonthYear, filterByrBySiklus, filterKlrBySiklus, getCycleDateRange } from '../../../utils/billing';
import { calculateTotalTagihan, calculatePendapatanAir, calculateMonthlySummary } from '../../../utils/reportCalculations';

export const useLaporanData = (state, selectedMonth, selectedYear, reportType) => {
  const cur = new Date();
  const cycle = getCycleMonthYear(cur);
  
  const targetB = selectedMonth === 1 ? 12 : selectedMonth - 1;
  const targetT = selectedMonth === 1 ? selectedYear - 1 : selectedYear;

  return useMemo(() => {
    if (reportType === 'bulanan') {
      return prepareMonthlyData(state, selectedMonth, selectedYear, targetB, targetT);
    } else {
      return prepareYearlyData(state, selectedYear);
    }
  }, [state, selectedMonth, selectedYear, reportType, targetB, targetT]);
};

const prepareMonthlyData = (state, b, t, targetB, targetT) => {
  const mtrBln = state.meteran.filter(m => m.bulan === targetB && m.tahun === targetT);
  const byrBln = state.pembayaran.filter(p => p.bulan === targetB && p.tahun === targetT);
  const byrSiklus = filterByrBySiklus(state.pembayaran, b, t);
  const klrBln = filterKlrBySiklus(state.pengeluaran, b, t);
  const cycleRange = getCycleDateRange(b, t);

  const wargaAktif = state.warga.filter(w => w.aktif && w.alamat !== 'SISTEM');

  const tagihan = calculateTotalTagihan(mtrBln, state.warga, state.pembayaran, targetB, targetT);
  const pendapatanAir = calculatePendapatanAir(byrBln, state.meteran, state.warga);
  
  const keluarAir = klrBln
    .filter(k => k.kategori !== 'Perbaikan Mesin (Patungan)')
    .reduce((s, k) => s + k.jumlah, 0);
  
  const masuk = byrSiklus.reduce((s, p) => s + p.jumlah_bayar, 0);
  const keluar = klrBln.reduce((s, k) => s + k.jumlah, 0);

  // PERHITUNGAN SALDO
  const totalBayarAll = state.pembayaran.reduce((s, p) => s + p.jumlah_bayar, 0);
  const totalKeluarAll = state.pengeluaran.reduce((s, k) => s + k.jumlah, 0);
  const saldo = totalBayarAll - totalKeluarAll;

  // PERHITUNGAN SALDO PATUNGAN
  const allPatungan = state.pembayaran.filter(p => p.keterangan && p.keterangan.startsWith('[PATUNGAN]'));
  const totalPatunganAll = allPatungan.reduce((s, p) => s + p.jumlah_bayar, 0);
  const allMesinExp = state.pengeluaran.filter(k => k.kategori === 'Perbaikan Mesin (Patungan)');
  const totalMesinExpAll = allMesinExp.reduce((s, k) => s + k.jumlah, 0);
  const saldoPatungan = totalPatunganAll - totalMesinExpAll;

  // PERHITUNGAN CASH FLOW
  const { start: cycleStartStr } = getCycleDateRange(b, t);
  const prevMasuk = state.pembayaran.filter(p => {
    const tgl = (p.tanggal_bayar || '').split('T')[0];
    return tgl && tgl < cycleStartStr;
  }).reduce((s, p) => s + p.jumlah_bayar, 0);

  const prevKeluar = state.pengeluaran.filter(k => {
    const tgl = (k.tanggal || '').split('T')[0];
    return tgl && tgl < cycleStartStr;
  }).reduce((s, k) => s + k.jumlah, 0);
  
  const saldoAwalCash = prevMasuk - prevKeluar;
  const saldoAkhirCash = saldoAwalCash + masuk - keluar;

  return {
    mtrBln, byrBln, byrSiklus, klrBln, cycleRange, wargaAktif,
    tagihan, pendapatanAir, keluarAir, kasBersihMeteran: pendapatanAir - keluarAir,
    masuk, keluar, 
    saldo,           // ✅ PASTIKAN INI ADA
    saldoPatungan,   // ✅ PASTIKAN INI ADA
    saldoAwalCash, 
    saldoAkhirCash,
    targetB, targetT
  };
};

const prepareYearlyData = (state, tahun) => {
  const activeMonths = Array.from({ length: 12 }, (_, i) => i + 1);
  
  const summaryData = activeMonths.map(bulan => 
    calculateMonthlySummary(bulan, tahun, state)
  );

  const grandTotals = summaryData.reduce((acc, d) => ({
    tagihan: acc.tagihan + d.totalTagihan,
    bayarWater: acc.bayarWater + d.totalBayarWater,
    kasLain: acc.kasLain + d.totalKasLain,
    pemasukan: acc.pemasukan + d.totalPemasukan,
    pengeluaran: acc.pengeluaran + d.totalPengeluaran,
    patungan: acc.patungan + d.totalPatungan,
    klrPatungan: acc.klrPatungan + d.totalKlrPatungan,
  }), { tagihan: 0, bayarWater: 0, kasLain: 0, pemasukan: 0, pengeluaran: 0, patungan: 0, klrPatungan: 0 });

  return {
    summaryData,
    grandTotals: {
      ...grandTotals,
      saldo: grandTotals.pemasukan - grandTotals.pengeluaran
    }
  };
};