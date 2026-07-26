// src/features/laporan-keuangan/components/PengeluaranTable.jsx
import { fmtRp, fmtDate } from '../../../utils/format';

const PengeluaranTable = ({ klrBln, totalKeluar }) => {
  if (!klrBln || klrBln.length === 0) {
    return null; // Tidak render apa-apa jika tidak ada data
  }

  // Hitung total per kategori
  const kategoriSummary = klrBln.reduce((acc, k) => {
    acc[k.kategori] = (acc[k.kategori] || 0) + k.jumlah;
    return acc;
  }, {});

  const kategoriEntries = Object.entries(kategoriSummary);

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50 p-5 space-y-4 print:overflow-visible print:border-none print:shadow-none">
      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
        <span>📤</span> Rincian Pengeluaran Per Kategori
      </h3>
      
      {/* Category Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {kategoriEntries.map(([cat, total]) => {
          const pct = totalKeluar > 0 ? ((total / totalKeluar) * 100).toFixed(0) : 0;
          const colorMap = {
            'Listrik Pompa': 'bg-cyan-50 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-800/40 text-cyan-700 dark:text-cyan-300',
            'Perbaikan Mesin (Patungan)': 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-300',
            'Operasional': 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/40 text-blue-700 dark:text-blue-300',
            'Perawatan & Sparepart': 'bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800/40 text-violet-700 dark:text-violet-300',
          };
          const cls = colorMap[cat] || 'bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300';
          return (
            <div key={cat} className={`p-3 rounded-xl border ${cls}`}>
              <p className="text-[9px] font-bold uppercase truncate">{cat}</p>
              <p className="text-sm font-bold mt-1">{fmtRp(total)}</p>
              <p className="text-[9px] font-semibold opacity-70">{pct}% dari total</p>
            </div>
          );
        })}
      </div>

      {/* Detail Pengeluaran Table */}
      <div className="overflow-x-auto print:overflow-visible pb-2">
        <div className="min-w-[700px] space-y-1.5">
          <div className="grid grid-cols-5 gap-1.5 text-center text-[9px] font-bold uppercase tracking-wider text-white">
            <div className="p-2.5 bg-slate-700 dark:bg-slate-600 rounded-xl">Tanggal</div>
            <div className="p-2.5 bg-slate-700 dark:bg-slate-600 rounded-xl">Kategori</div>
            <div className="p-2.5 bg-slate-700 dark:bg-slate-600 rounded-xl text-left pl-3">Keterangan</div>
            <div className="p-2.5 bg-slate-700 dark:bg-slate-600 rounded-xl">No. Bukti</div>
            <div className="p-2.5 bg-rose-700 rounded-xl">Jumlah</div>
          </div>
          {[...klrBln].sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal)).map((k, idx) => (
            <div key={k.id || idx} className="grid grid-cols-5 gap-1.5 text-center text-[11px] font-semibold items-center">
              <div className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl font-mono text-slate-700 dark:text-slate-200">
                {fmtDate(k.tanggal)}
              </div>
              <div className={`p-2 rounded-xl font-bold text-[10px] ${
                k.kategori === 'Listrik Pompa' ? 'bg-cyan-100 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300' :
                k.kategori === 'Perbaikan Mesin (Patungan)' ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300' :
                'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300'
              }`}>
                {k.kategori}
              </div>
              <div className="p-2 bg-slate-50/50 dark:bg-slate-800/30 text-slate-600 dark:text-slate-400 rounded-xl text-left pl-3 whitespace-pre-wrap">
                {k.keterangan}
              </div>
              <div className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl font-mono text-slate-500 dark:text-slate-400">
                {k.no_bukti || '-'}
              </div>
              <div className="p-2 bg-rose-50/40 dark:bg-rose-950/20 text-rose-700 dark:text-rose-350 rounded-xl font-mono font-bold">
                {fmtRp(k.jumlah)}
              </div>
            </div>
          ))}
          {/* Total Row */}
          <div className="grid grid-cols-5 gap-1.5 text-center text-xs font-bold items-center mt-1">
            <div className="col-span-4 p-2.5 bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 rounded-xl text-right pr-4">
              TOTAL PENGELUARAN
            </div>
            <div className="p-2.5 bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 rounded-xl font-mono">
              {fmtRp(totalKeluar)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PengeluaranTable;