// src/features/laporan-keuangan/hooks/useLaporanData.js
import { useMemo } from 'react';
import { getCycleMonthYear, filterByrBySiklus, filterKlrBySiklus, getCycleDateRange } from '../../../utils/billing';
import { calculateTotalTagihan, calculatePendapatanAir, calculateMonthlySummary } from '../../../utils/reportCalculations';

export const useLaporanData = (state, selectedMonth, selectedYear, reportType) => {
  const cur = new Date();
  // Hapus variabel cycle yang tidak dipakai
  // const cycle = getCycleMonthYear(cur);
  
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
  // 1. Data untuk periode billing (targetB = b - 1)
  const mtrBln = state.meteran.filter(m => m.bulan === targetB && m.tahun === targetT);
  const byrBln = state.pembayaran.filter(p => p.bulan === targetB && p.tahun === targetT);
  
  // 2. Data untuk siklus laporan yang dipilih (b, t)
  const byrSiklus = filterByrBySiklus(state.pembayaran, b, t);
  const klrSiklus = filterKlrBySiklus(state.pengeluaran, b, t);
  const cycleRange = getCycleDateRange(b, t);

  const wargaAktif = state.warga.filter(w => w.aktif && w.alamat !== 'SISTEM');

  // 3. Perhitungan Tagihan & Pendapatan
  const tagihan = calculateTotalTagihan(mtrBln, state.warga, state.pembayaran);
  const pendapatanAir = calculatePendapatanAir(byrBln, state.meteran, state.warga);
  
  const keluarAir = klrSiklus
    .filter(k => k.kategori !== 'Perbaikan Mesin (Patungan)')
    .reduce((s, k) => s + k.jumlah, 0);
  
  const masuk = byrSiklus.reduce((s, p) => s + p.jumlah_bayar, 0);
  const keluar = klrSiklus.reduce((s, k) => s + k.jumlah, 0);

  // 4. ✅ SALDO AKHIR PER PERIODE (sama dengan UI)
  // Saldo Bawaan + Pemasukan Periode - Pengeluaran Periode
  const { start: cycleStartStr } = getCycleDateRange(b, t);
  
  const prevMasuk = state.pembayaran.filter(p => {
    const tgl = (p.tanggal_bayar || p.tanggal || '').split('T')[0];
    return tgl && tgl < cycleStartStr;
  }).reduce((s, p) => s + p.jumlah_bayar, 0);

  const prevKeluar = state.pengeluaran.filter(k => {
    const tgl = (k.tanggal || '').split('T')[0];
    return tgl && tgl < cycleStartStr;
  }).reduce((s, k) => s + k.jumlah, 0);
  
  const saldoAwalCash = prevMasuk - prevKeluar;
  const saldoAkhirCash = saldoAwalCash + masuk - keluar;

  // 5. SALDO PATUNGAN PER PERIODE
  const patunganPeriode = byrSiklus.filter(p => 
    p.keterangan && p.keterangan.startsWith('[PATUNGAN]')
  ).reduce((s, p) => s + p.jumlah_bayar, 0);

  const mesinExpPeriode = klrSiklus.filter(k => 
    k.kategori === 'Perbaikan Mesin (Patungan)'
  ).reduce((s, k) => s + k.jumlah, 0);

  const saldoPatunganPerPeriode = patunganPeriode - mesinExpPeriode;

  // 6. SALDO REAL-TIME (Untuk Dashboard)
  const totalBayarAll = state.pembayaran.reduce((s, p) => s + p.jumlah_bayar, 0);
  const totalKeluarAll = state.pengeluaran.reduce((s, k) => s + k.jumlah, 0);
  const saldoRealtime = totalBayarAll - totalKeluarAll;

  const patunganAll = state.pembayaran.filter(p => 
    p.keterangan && p.keterangan.startsWith('[PATUNGAN]')
  ).reduce((s, p) => s + p.jumlah_bayar, 0);
  
  const mesinExpAll = state.pengeluaran.filter(k => 
    k.kategori === 'Perbaikan Mesin (Patungan)'
  ).reduce((s, k) => s + k.jumlah, 0);
  
  const saldoPatunganRealtime = patunganAll - mesinExpAll;

  return {
    mtrBln, 
    byrBln, 
    byrSiklus, 
    klrBln: klrSiklus,
    cycleRange, 
    wargaAktif,
    tagihan, 
    pendapatanAir, 
    keluarAir, 
    kasBersihMeteran: pendapatanAir - keluarAir,
    masuk, 
    keluar, 
    // ✅ SALDO AKHIR PER PERIODE (sama dengan UI)
    saldo: saldoAkhirCash,
    saldoPatungan: saldoPatunganPerPeriode,
    // Cash flow
    saldoAwalCash, 
    saldoAkhirCash,
    // Saldo real-time
    saldoRealtime,
    saldoPatunganRealtime,
    targetB, 
    targetT
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