// src/views/LaporanKeuangan.jsx
import { useState } from 'react';
import { useDb } from '../store/DbContext';
import { useLaporanData } from '../features/laporan-keuangan/hooks/useLaporanData';
import { useReportActions } from '../features/laporan-keuangan/hooks/useReportActions';
import LaporanControls from '../features/laporan-keuangan/components/LaporanControls';
import SummaryCards from '../features/laporan-keuangan/components/SummaryCards';
import WargaDetailTable from '../features/laporan-keuangan/components/WargaDetailTable';
import PengeluaranTable from '../features/laporan-keuangan/components/PengeluaranTable';
import TransactionLog from '../features/laporan-keuangan/components/TransactionLog';
import { fmtRp, MONTHS } from '../utils/format';

const LaporanKeuangan = () => {
  const { state } = useDb();
  const cur = new Date();
  
  // 1. State Lokal (Hanya untuk UI kontrol)
  const [reportType, setReportType] = useState('bulanan');
  const [selectedMonth, setSelectedMonth] = useState(cur.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(cur.getFullYear());

  // 2. Data Processing (Delegasikan ke Custom Hook!)
  const data = useLaporanData(state, selectedMonth, selectedYear, reportType);

  // 3. Action Handlers (PDF, CSV, WA, Image)
  const actions = useReportActions(data, reportType, selectedMonth, selectedYear, state);

  return (
    <div className="space-y-6">
      {/* A. KONTROL: Filter & Tombol Aksi */}
      <LaporanControls
        reportType={reportType}
        setReportType={setReportType}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        onPrint={actions.handlePrint}
        onExportPDF={actions.handleExportPDF}
        onExportCSV={actions.handleExportCSV}
        onShareWA={actions.handleShareWA}
        onShareImage={actions.handleShareImage}
        isSharing={actions.isSharing}
      />

      {/* B. KONTEN: Tampilan Berdasarkan Tipe Laporan */}
      {reportType === 'bulanan' ? (
        <div id="report-bulanan-capture" className="space-y-6 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-3xl border border-slate-200/50 dark:border-slate-700/50 print:p-0 print:bg-transparent print:border-none">
          
          {/* Print Header */}
          <div className="print-header text-center py-6 border-b-4 double border-slate-900/60">
            <h2 className="text-xl font-bold text-slate-900 uppercase">Laporan Keuangan Bulanan Air Bersih</h2>
            <h3 className="text-md font-bold text-teal-800 uppercase mt-1">{state.settings?.nama_rt || 'KAS AIR RT / RW'}</h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Periode: {MONTHS[selectedMonth]} {selectedYear} 
              (Siklus {data.cycleRange?.start?.split('-').reverse().join('/')} s/d {data.cycleRange?.end?.split('-').reverse().join('/')})
            </p>
            <p className="text-xs text-slate-600 mt-1">Pengelola: {state.settings?.pengelola || 'Nama Pengelola'}</p>
            <p className="text-xs text-slate-600 mt-0.5">Alamat: {state.settings?.alamat_rt || 'Alamat RT tidak tersedia'}</p>
          </div>

          {/* Summary Cards (Komponen Kecil) */}
          <SummaryCards data={{
            wargaAktif: data.wargaAktif?.length || 0,
            tagihan: data.tagihan,
            pendapatanAir: data.pendapatanAir,
            kasBersihMeteran: data.kasBersihMeteran,
            masuk: data.masuk,
            keluar: data.keluar,
            saldo: data.saldo,
            saldoPatungan: data.saldoPatungan
          }} />

          {/* Detail Table Warga (Komponen Kecil) */}
          <div className="rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50 p-5 space-y-4 print:overflow-visible print:border-none print:shadow-none">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <span>👥</span> Detail Tagihan & Pembayaran Warga
            </h3>
            <WargaDetailTable 
              mtrBln={data.mtrBln}
              byrBln={data.byrBln}
              targetB={data.targetB}
              targetT={data.targetT}
              warga={data.wargaAktif}
              state={state}
            />
          </div>

          {/* Rincian Pengeluaran Per Kategori */}
          <PengeluaranTable 
            klrBln={data.klrBln}
            totalKeluar={data.keluar}
          />

          {/* Log Rincian Pemasukan & Pengeluaran */}
          <TransactionLog 
            byrSiklus={data.byrSiklus}
            klrBln={data.klrBln}
            wargaList={data.wargaAktif}
          />

          {/* Rincian Perhitungan Matematis & Tanda Tangan */}
          <div className="print-avoid-break mt-6">
            <div className="mx-auto w-full max-w-md print:max-w-lg">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm print:border-slate-400 print:shadow-none">
                <h4 className="text-center font-bold text-sm text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2.5 mb-3">
                  Rincian Perhitungan Matematis Saldo Akhir
                </h4>
                <div className="space-y-2 font-mono text-xs text-slate-700 dark:text-slate-350">
                  <div className="flex justify-between">
                    <span>Saldo Bawaan (Awal)</span>
                    <span className="font-bold">{data.saldoAwalCash < 0 ? '-' : ''}{fmtRp(Math.abs(data.saldoAwalCash || 0))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Pemasukan</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">+ {fmtRp(data.masuk || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Pengeluaran</span>
                    <span className="text-rose-600 dark:text-rose-450 font-bold">- {fmtRp(data.keluar || 0)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2 font-bold text-slate-900 dark:text-white">
                    <span>Saldo Akhir Kas RT</span>
                    <span>= {data.saldoAkhirCash < 0 ? '-' : ''}{fmtRp(Math.abs(data.saldoAkhirCash || 0))}</span>
                  </div>
                </div>
                <p className="mt-4 text-[9px] text-center italic text-slate-500 dark:text-slate-450 print:text-slate-650">
                  *Catatan: Jika angka Saldo Akhir bernilai minus, berarti Kas RT memiliki tanggungan/hutang berwujud defisit.
                </p>
              </div>
            </div>

            {/* SIGNATURE BLOCK */}
            <div className="hidden print:block mt-12 px-4 pb-8 print:px-0 print:pb-0 print-signature-group">
              <div className="text-center p-4 break-inside-avoid">
                <p className="text-xs text-slate-700">Mengetahui,</p>
                <p className="text-xs font-bold text-slate-900">{state.settings?.jabatan_rt || 'Ketua RT 01 / RW 03'}</p>
                <div className="h-16 mt-2"></div>
                <div className="w-36 mx-auto border-b border-slate-400 print:border-black"></div>
              </div>
              <div className="text-center p-4 break-inside-avoid">
                <p className="text-xs text-slate-700">Dibuat Oleh,</p>
                <p className="text-xs font-bold text-slate-900">Pengelola Kas</p>
                <div className="h-16 mt-2"></div>
                <p className="text-xs font-bold text-slate-900 underline decoration-slate-400 print:decoration-black">{state.settings?.pengelola || 'Slamet Susanto'}</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div id="report-tahunan-capture" className="space-y-6 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-3xl border border-slate-200/50 dark:border-slate-700/50 print:p-0 print:bg-transparent print:border-none">
          
          {/* Print Header Tahunan */}
          <div className="print-header text-center py-6 border-b-4 double border-slate-900/60">
            <h2 className="text-lg font-bold text-slate-900 uppercase">REKAPITULASI LAPORAN KEUANGAN TAHUNAN</h2>
            <h3 className="text-sm font-bold text-teal-800 uppercase mt-0.5">{state.settings?.nama_rt || 'KAS AIR RT / RW'}</h3>
            <h4 className="text-xs font-bold mt-1 text-slate-700">Tahun Buku: {selectedYear}</h4>
            <p className="text-xs text-slate-600 mt-1">Pengelola: {state.settings?.pengelola || 'Nama Pengelola'}</p>
          </div>

          {/* Tabel Tahunan Sederhana */}
          <div className="rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50 p-5 print:overflow-visible print:border-none print:shadow-none">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">Rekapitulasi Per Bulan</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white">
                    <th className="p-3 rounded-tl-xl">Bulan</th>
                    <th className="p-3 text-right">Tagihan Air</th>
                    <th className="p-3 text-right">Total Masuk</th>
                    <th className="p-3 text-right">Pengeluaran Kas</th>
                    <th className="p-3 text-right rounded-tr-xl">Saldo Bersih</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                  {data.summaryData?.map(d => (
                    <tr key={d.bulan} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{d.bulanNama}</td>
                      <td className="p-3 text-right font-mono">{fmtRp(d.totalTagihan)}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-600">{fmtRp(d.totalPemasukan)}</td>
                      <td className="p-3 text-right font-mono text-rose-600">{fmtRp(d.totalPengeluaran)}</td>
                      <td className={`p-3 text-right font-mono font-bold ${d.saldoBersih >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {fmtRp(d.saldoBersih)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-200 dark:bg-slate-800 font-bold">
                    <td className="p-3 text-slate-900 dark:text-white">TOTAL</td>
                    <td className="p-3 text-right font-mono text-slate-900 dark:text-white">{fmtRp(data.grandTotals?.tagihan || 0)}</td>
                    <td className="p-3 text-right font-mono text-emerald-600">{fmtRp(data.grandTotals?.pemasukan || 0)}</td>
                    <td className="p-3 text-right font-mono text-rose-600">{fmtRp(data.grandTotals?.pengeluaran || 0)}</td>
                    <td className={`p-3 text-right font-mono font-bold ${(data.grandTotals?.saldo || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {fmtRp(data.grandTotals?.saldo || 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Tanda Tangan Tahunan */}
          <div className="hidden print:block mt-12 px-4 pb-8 print:px-0 print:pb-0 print-signature-group">
            <div className="text-center p-4 break-inside-avoid">
              <p className="text-xs text-slate-700">Mengetahui,</p>
              <p className="text-xs font-bold text-slate-900">{state.settings?.jabatan_rt || 'Ketua RT 01 / RW 03'}</p>
              <div className="h-16 mt-2"></div>
              <div className="w-36 mx-auto border-b border-slate-400 print:border-black"></div>
            </div>
            <div className="text-center p-4 break-inside-avoid">
              <p className="text-xs text-slate-700">Dibuat Oleh,</p>
              <p className="text-xs font-bold text-slate-900">Pengelola Kas</p>
              <div className="h-16 mt-2"></div>
              <p className="text-xs font-bold text-slate-900 underline decoration-slate-400 print:decoration-black">{state.settings?.pengelola || 'Slamet Susanto'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LaporanKeuangan;