// src/features/laporan-keuangan/components/TransactionLog.jsx
import { fmtRp, fmtDate } from '../../../utils/format';

const TransactionLog = ({ byrSiklus, klrBln, wargaList }) => {
  // Gabungkan pemasukan dan pengeluaran, lalu urutkan berdasarkan tanggal
  const transactions = [
    ...(byrSiklus || []).map(p => ({
      tanggal: p.tanggal_bayar,
      tipe: p.keterangan && p.keterangan.startsWith('[PATUNGAN]') ? 'PATUNGAN' : 'PEMASUKAN',
      warga: wargaList?.find(x => x.id === p.warga_id)?.nama || 'Sistem',
      ket: p.keterangan || 'Iuran air bersih',
      masuk: p.jumlah_bayar,
      keluar: 0
    })),
    ...(klrBln || []).map(k => ({
      tanggal: k.tanggal,
      tipe: k.kategori === 'Perbaikan Mesin (Patungan)' ? 'MESIN_KELUAR' : 'PENGELUARAN',
      warga: 'Kas Pengeluaran',
      ket: `[${k.kategori}] ${k.keterangan}`,
      masuk: 0,
      keluar: k.jumlah
    }))
  ].sort((x, y) => new Date(x.tanggal) - new Date(y.tanggal));

  if (transactions.length === 0) {
    return (
      <div className="rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50 p-5">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">Log Rincian Pemasukan & Pengeluaran</h3>
        <p className="text-center text-slate-500 italic py-8">Tidak ada transaksi pada periode ini.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50 p-5 space-y-4 print:overflow-visible print:border-none print:shadow-none">
      <div className="p-1 border-b border-slate-100 dark:border-slate-700/60 print:hidden flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Log Rincian Pemasukan & Pengeluaran</h3>
      </div>
      
      <div className="overflow-x-auto print:overflow-visible pb-2">
        <div className="min-w-[800px] space-y-2">
          {/* Header Row */}
          <div className="grid grid-cols-6 gap-2 text-center text-[10px] font-bold uppercase tracking-wider text-white">
            <div className="p-3 bg-slate-700 dark:bg-slate-600 rounded-xl">Tanggal</div>
            <div className="p-3 bg-slate-700 dark:bg-slate-600 rounded-xl">Tipe</div>
            <div className="p-3 bg-slate-700 dark:bg-slate-600 rounded-xl">Warga / Penerima</div>
            <div className="p-3 bg-slate-700 dark:bg-slate-600 rounded-xl text-left pl-4">Keterangan</div>
            <div className="p-3 bg-emerald-700 rounded-xl">Pemasukan (+)</div>
            <div className="p-3 bg-rose-700 rounded-xl">Pengeluaran (-)</div>
          </div>

          {/* Data Rows */}
          {transactions.map((item, idx) => {
            let typeBg = 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-350';
            if (item.tipe === 'PATUNGAN') typeBg = 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300';
            else if (item.tipe === 'PEMASUKAN') typeBg = 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-750 dark:text-emerald-300';
            else if (item.tipe === 'MESIN_KELUAR' || item.tipe === 'PENGELUARAN') typeBg = 'bg-rose-100 dark:bg-rose-950/60 text-rose-755 dark:text-rose-350';

            return (
              <div key={idx} className="grid grid-cols-6 gap-2 text-center text-xs font-semibold items-center">
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 rounded-xl font-mono">
                  {fmtDate(item.tanggal)}
                </div>
                <div className={`p-2.5 rounded-xl font-bold ${typeBg}`}>
                  {item.tipe}
                </div>
                <div className="p-2.5 bg-sky-50/40 dark:bg-sky-950/15 text-sky-850 dark:text-sky-300 rounded-xl truncate font-bold">
                  {item.warga}
                </div>
                <div className="p-2.5 bg-slate-50/50 dark:bg-slate-800/30 text-slate-600 dark:text-slate-400 rounded-xl text-left pl-3 truncate whitespace-pre-wrap">
                  {item.ket}
                </div>
                <div className="p-2.5 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-750 dark:text-emerald-300 rounded-xl font-mono font-bold">
                  {item.masuk > 0 ? fmtRp(item.masuk) : '—'}
                </div>
                <div className="p-2.5 bg-rose-50/40 dark:bg-rose-950/20 text-rose-755 dark:text-rose-350 rounded-xl font-mono font-bold">
                  {item.keluar > 0 ? fmtRp(item.keluar) : '—'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TransactionLog;