// src/features/laporan-keuangan/components/SummaryCards.jsx
import { fmtRp } from '../../../utils/format';

const SummaryCards = ({ data }) => {
  const cards = [
    { label: 'Warga Aktif', value: data.wargaAktif, color: 'slate' },
    { label: 'Tagihan Air', value: fmtRp(data.tagihan), color: 'slate' },
    { label: 'Pendapatan Meteran', value: fmtRp(data.pendapatanAir), color: 'emerald' },
    { label: 'Kas Bersih Meteran', value: fmtRp(data.kasBersihMeteran), color: 'cyan' },
    { label: 'Total Pemasukan', value: fmtRp(data.masuk), color: 'slate' },
    { label: 'Pengeluaran Kas RT', value: fmtRp(data.keluar), color: 'slate' },
    { label: 'Saldo Kas RT', value: fmtRp(data.saldo), color: data.saldo >= 0 ? 'emerald' : 'rose' },
    { label: 'Kas Patungan', value: fmtRp(data.saldoPatungan), color: 'amber' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4">
      {cards.map((card, idx) => (
        <SummaryCard key={idx} {...card} />
      ))}
    </div>
  );
};

const SummaryCard = ({ label, value, color = 'slate' }) => {
  const colorClasses = {
    slate: 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white',
    emerald: 'border-emerald-200 bg-emerald-50/20 dark:bg-emerald-950/10 text-emerald-700 dark:text-emerald-400',
    cyan: 'border-cyan-200 bg-cyan-50/20 dark:bg-cyan-950/10 text-cyan-700 dark:text-cyan-400',
    amber: 'border-amber-250 bg-amber-50/20 dark:bg-amber-950/10 text-amber-700 dark:text-amber-400',
    rose: 'border-rose-200 bg-rose-50/20 dark:bg-rose-950/10 text-rose-700 dark:text-rose-400',
  };

  return (
    <div className={`p-4 rounded-xl border print-card ${colorClasses[color]}`}>
      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-xl font-bold mt-1 ${color === 'slate' ? 'text-slate-900 dark:text-white' : ''}`}>
        {value}
      </p>
    </div>
  );
};

export default SummaryCards;