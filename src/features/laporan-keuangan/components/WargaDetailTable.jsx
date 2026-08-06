// src/features/laporan-keuangan/components/WargaDetailTable.jsx
import { fmtRp } from '../../../utils/format';
import { getWargaBillingSummary } from '../../../utils/billingEngine';
import { getWargaDeposit } from '../../../utils/billing';

const WargaDetailTable = ({ mtrBln, byrBln, targetB, targetT, warga, state }) => {
  const wargaActiveSorted = warga
    .filter(w => w.aktif && w.alamat !== 'SISTEM')
    .sort((a, b) => (a.no_urut || 999) - (b.no_urut || 999));

  return (
    <div className="overflow-x-auto print:overflow-visible pb-2">
      <div className="min-w-[1100px] space-y-2">
        <TableHeader />
        {wargaActiveSorted.map((w, idx) => (
          <WargaRow
            key={w.id}
            warga={w}
            index={idx}
            mtrBln={mtrBln}
            byrBln={byrBln}
            targetB={targetB}
            targetT={targetT}
            state={state}
          />
        ))}
      </div>
    </div>
  );
};

const TableHeader = () => (
  <div className="grid grid-cols-10 gap-1.5 text-center text-[9px] font-bold uppercase tracking-wider text-white">
    <div className="p-2.5 bg-slate-700 dark:bg-slate-600 rounded-xl">No. Meter</div>
    <div className="p-2.5 bg-slate-700 dark:bg-slate-600 rounded-xl text-left pl-3">Nama Warga</div>
    <div className="p-2.5 bg-slate-600 rounded-xl">Mtr Lalu</div>
    <div className="p-2.5 bg-slate-600 rounded-xl">Mtr Skrg</div>
    <div className="p-2.5 bg-teal-700 rounded-xl">Pakai (m³)</div>
    <div className="p-2.5 bg-amber-700 rounded-xl">Tagihan</div>
    <div className="p-2.5 bg-orange-700 rounded-xl">Tunggakan</div>
    <div className="p-2.5 bg-cyan-700 rounded-xl">Lebih Bayar</div>
    <div className="p-2.5 bg-emerald-700 rounded-xl">Bayar</div>
    <div className="p-2.5 bg-indigo-700 rounded-xl">Status</div>
  </div>
);

const WargaRow = ({ warga, index, mtrBln, byrBln, targetB, targetT, state }) => {
  const m = mtrBln.find(x => x.warga_id === warga.id);
  const rawTagihan = m ? m.total_tagihan : 0;
  const bayarVal = m ? byrBln.filter(p => p.meteran_id === m.id).reduce((s, p) => s + p.jumlah_bayar, 0) : 0;
  const { deposit: depMasuk, tunggakanLalu, sisa } = getWargaBillingSummary(
    warga.id, rawTagihan, bayarVal, targetB, targetT, state
  );
  const depositSetelah = getWargaDeposit(warga.id, targetB, targetT, state);

  const statusInfo = getStatusInfo(warga, sisa, bayarVal, depMasuk);

  return (
    <div className="grid grid-cols-10 gap-1.5 text-center text-[11px] font-semibold items-center">
      <div className="p-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 rounded-xl font-mono">
        {warga.no_meter || '-'}
      </div>
      <div className="p-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/60 text-slate-900 dark:text-slate-100 rounded-xl text-left pl-3 font-bold truncate">
        {index + 1}. {warga.nama}
      </div>
      <div className="p-2 bg-slate-50/60 dark:bg-slate-800/30 text-slate-500 dark:text-slate-400 rounded-xl font-mono">
        {m ? (m.meter_lalu ?? '-') : '-'}
      </div>
      <div className="p-2 bg-slate-50/60 dark:bg-slate-800/30 text-slate-700 dark:text-slate-200 rounded-xl font-mono font-bold">
        {m ? (m.meter_sekarang ?? '-') : '-'}
      </div>
      <div className="p-2 bg-teal-50/40 dark:bg-teal-950/20 text-teal-700 dark:text-teal-300 rounded-xl font-mono">
        {m ? (m.pemakaian_m3 || m.pemakaian || 0) : 0} m³
      </div>
      <div className="p-2 bg-amber-50/40 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 rounded-xl font-mono font-bold">
        {fmtRp(rawTagihan)}
      </div>
      <div className={`p-2 rounded-xl font-mono ${tunggakanLalu > 0 ? 'bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 font-bold' : 'bg-slate-50/40 dark:bg-slate-800/20 text-slate-400'}`}>
        {tunggakanLalu > 0 ? fmtRp(tunggakanLalu) : '-'}
      </div>
      <div className={`p-2 rounded-xl font-mono ${depositSetelah > 0 ? 'bg-cyan-100 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 font-bold' : 'bg-slate-50/40 dark:bg-slate-800/20 text-slate-400'}`}>
        {depositSetelah > 0 ? fmtRp(depositSetelah) : '-'}
      </div>
      <div className="p-2 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 rounded-xl font-mono font-bold">
        {fmtRp(bayarVal)}
      </div>
      <div className={`p-2 rounded-xl font-bold text-[10px] truncate ${statusInfo.color}`}>
        {statusInfo.text}
      </div>
    </div>
  );
};

const getStatusInfo = (warga, sisa, bayarVal, depMasuk) => {
  if (warga.adalah_pengelola) {
    return { text: 'Pengelola', color: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300' };
  }
  if (sisa <= 0) {
    if (sisa < 0) {
      return { 
        text: `Lunas (+${fmtRp(Math.abs(sisa)).replace('Rp', '').trim()})`, 
        color: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-750 dark:text-emerald-300' 
      };
    }
    return { text: 'Lunas', color: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-750 dark:text-emerald-300' };
  }
  const text = `Sisa ${fmtRp(sisa)}`;
  const color = (bayarVal > 0 || depMasuk > 0)
    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-750 dark:text-amber-300'
    : 'bg-rose-100 dark:bg-rose-950/60 text-rose-755 dark:text-rose-350';
  return { text, color };
};

export default WargaDetailTable;