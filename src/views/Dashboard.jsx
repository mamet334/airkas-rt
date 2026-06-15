import { useState } from 'react';
import { useDb } from '../store/DbContext';
import { fmtRp, MONTHS } from '../utils/format';
import { getCycleMonthYear, filterByrBySiklus, filterKlrBySiklus, getWargaDeposit, getWargaTunggakanLalu } from '../utils/billing';
import { 
  Users, 
  FileText, 
  Droplet, 
  Gauge, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Wallet, 
  Wrench, 
  CheckCircle,
  AlertCircle,
  X
} from 'lucide-react';

const Dashboard = () => {
  const { state } = useDb();
  
  const cur = new Date();
  const cycle = getCycleMonthYear(cur);
  const [selectedMonth, setSelectedMonth] = useState(cycle.month);
  const [selectedYear, setSelectedYear] = useState(cycle.year);

  const b = selectedMonth;
  const t = selectedYear;

  // Target month/year for billing offset (b - 1)
  const targetB = b === 1 ? 12 : b - 1;
  const targetT = b === 1 ? t - 1 : t;

  // Warga Aktif
  const wargaAktif = state.warga.filter(w => w.aktif && w.alamat !== 'SISTEM');

  // Meteran & Pembayaran & Pengeluaran Bulan ini (Siklus 15-15)
  const mtrBln = state.meteran.filter(m => m.bulan === targetB && m.tahun === targetT);
  const byrBln = filterByrBySiklus(state.pembayaran, b, t);
  const klrBln = filterKlrBySiklus(state.pengeluaran, b, t);

  const [detailModal, setDetailModal] = useState({ isOpen: false, title: '', type: '', items: [], total: 0 });
  const openDetail = (title, type, items, total) => setDetailModal({ isOpen: true, title, type, items, total });

  // 1. Tagihan Air
  const tagihanItems = mtrBln.filter(m => {
    const w = state.warga.find(x => x.id === m.warga_id);
    return w && w.alamat !== 'SISTEM';
  }).map(m => {
    const w = state.warga.find(x => x.id === m.warga_id);
    let currTagihan = m.total_tagihan;
    if (w && w.adalah_pengelola) {
      currTagihan = state.pembayaran.filter(p => p.meteran_id === m.id).reduce((sum, p) => sum + p.jumlah_bayar, 0);
    }
    return { ...m, nama_warga: w ? w.nama : 'Unknown', nominal: currTagihan, desc: `Tagihan Air ${w ? w.nama : ''}`, category: 'Tagihan' };
  }).filter(m => m.nominal > 0);
  const tagihan = tagihanItems.reduce((s, m) => s + m.nominal, 0);

  // 2. Pendapatan Meteran (A)
  const pendapatanAirItems = byrBln.filter(p => {
    const mt = state.meteran.find(x => x.id === p.meteran_id);
    if (!mt) return false;
    const w = state.warga.find(x => x.id === mt.warga_id);
    return w && w.alamat !== 'SISTEM' && (!p.keterangan || !p.keterangan.startsWith('[PATUNGAN]'));
  }).map(p => {
    const mt = state.meteran.find(x => x.id === p.meteran_id);
    const w = state.warga.find(x => x.id === mt?.warga_id);
    return { ...p, nama_warga: w ? w.nama : 'Unknown', nominal: p.jumlah_bayar, desc: `Bayar Tagihan ${p.keterangan || ''}`, category: 'Meteran Air' };
  });
  const pendapatanAir = pendapatanAirItems.reduce((s, p) => s + p.nominal, 0);

  // 3. Pemasukan Kas Lain (B)
  const pemasukanLainItems = byrBln.filter(p => {
    const mt = state.meteran.find(x => x.id === p.meteran_id);
    if (!mt) return false;
    const w = state.warga.find(x => x.id === mt.warga_id);
    return w && w.alamat === 'SISTEM' && (!p.keterangan || !p.keterangan.startsWith('[PATUNGAN]'));
  }).map(p => ({ ...p, nama_warga: 'SISTEM', nominal: p.jumlah_bayar, desc: p.keterangan || 'Lainnya', category: 'Pemasukan Lain' }));
  const pemasukanLain = pemasukanLainItems.reduce((s, p) => s + p.nominal, 0);

  // 4. Pemasukan Patungan (C)
  const pemasukanPatunganItems = byrBln.filter(p => p.keterangan && p.keterangan.startsWith('[PATUNGAN]')).map(p => {
    const mt = state.meteran.find(x => x.id === p.meteran_id);
    const w = state.warga.find(x => x.id === mt?.warga_id);
    return { ...p, nama_warga: w ? w.nama : 'Unknown', nominal: p.jumlah_bayar, desc: p.keterangan, category: 'Patungan' };
  });
  const pemasukanPatungan = pemasukanPatunganItems.reduce((s, p) => s + p.nominal, 0);

  // 5. Total Pemasukan Bulan Ini
  const masukItems = [...pendapatanAirItems, ...pemasukanLainItems, ...pemasukanPatunganItems];
  const masuk = masukItems.reduce((s, p) => s + p.nominal, 0);

  // 6. Keluar Air / Operasional (D)
  const keluarAirItems = klrBln.filter(k => k.kategori !== 'Perbaikan Mesin (Patungan)').map(k => ({ ...k, nominal: k.jumlah, desc: k.keterangan, nama_warga: k.kategori, category: 'Operasional' }));
  const keluarAir = keluarAirItems.reduce((s, k) => s + k.nominal, 0);

  // 7. Keluar Mesin / Patungan (E)
  const keluarPatunganItems = klrBln.filter(k => k.kategori === 'Perbaikan Mesin (Patungan)').map(k => ({ ...k, nominal: k.jumlah, desc: k.keterangan, nama_warga: k.kategori, category: 'Mesin Patungan' }));
  const keluarPatungan = keluarPatunganItems.reduce((s, k) => s + k.nominal, 0);

  // 8. Total Pengeluaran Bulan Ini
  const keluarItems = [...keluarAirItems, ...keluarPatunganItems];
  const keluar = keluarItems.reduce((s, k) => s + k.nominal, 0);

  // 9. Kas Bersih Meteran (Bulan Ini)
  const kasBersihMeteran = pendapatanAir - keluarAir;

  // 10. Saldo Kas RT (Total All-time)
  const totalBayarAllItems = state.pembayaran.map(p => ({ ...p, nominal: p.jumlah_bayar, desc: p.keterangan, type: 'in', nama_warga: 'Pemasukan' }));
  const totalKeluarAllItems = state.pengeluaran.map(k => ({ ...k, nominal: k.jumlah, desc: k.keterangan, type: 'out', nama_warga: 'Pengeluaran' }));
  const totalBayarAll = state.rekap ? state.rekap.total_bayar : totalBayarAllItems.reduce((s, p) => s + p.nominal, 0);
  const totalKeluarAll = state.rekap ? state.rekap.total_keluar : totalKeluarAllItems.reduce((s, k) => s + k.nominal, 0);
  const saldo = state.rekap ? state.rekap.kas_rt_bersih : (totalBayarAll - totalKeluarAll);

  // 11. Saldo Patungan Mesin (All-time)
  const allPatunganItems = state.pembayaran.filter(p => p.keterangan && p.keterangan.startsWith('[PATUNGAN]')).map(p => ({...p, nominal: p.jumlah_bayar, type: 'in', desc: p.keterangan, nama_warga: 'Pemasukan Patungan'}));
  const allMesinExpItems = state.pengeluaran.filter(k => k.kategori === 'Perbaikan Mesin (Patungan)').map(k => ({...k, nominal: k.jumlah, type: 'out', desc: k.keterangan, nama_warga: 'Pengeluaran Patungan'}));
  const saldoPatunganItems = [...allPatunganItems, ...allMesinExpItems];
  const totalPatunganAll = state.rekap ? state.rekap.total_patungan_masuk : allPatunganItems.reduce((s, p) => s + p.nominal, 0);
  const totalMesinExpAll = state.rekap ? state.rekap.total_mesin_keluar : allMesinExpItems.reduce((s, k) => s + k.nominal, 0);
  const saldoPatungan = state.rekap ? state.rekap.kas_patungan_bersih : (totalPatunganAll - totalMesinExpAll);

  // Belum Bayar (tunggakan setelah siklus berjalan selesai, yaitu bulan-bulan < b)
  const belumBayar = state.warga.map(w => {
    if (!w.aktif || w.alamat === 'SISTEM' || w.adalah_pengelola) return null;
    
    const sisa = getWargaTunggakanLalu(w.id, b, t, state);
    if (sisa <= 0) return null;

    const mBln = state.meteran.find(m => m.warga_id === w.id && m.bulan === targetB && m.tahun === targetT);
    const tagihanBulanIni = mBln ? mBln.total_tagihan : 0;

    return {
      id: w.id,
      nama: w.nama,
      no_meter: w.no_meter,
      tagihanBulanIni,
      sisa
    };
  }).filter(Boolean);

  // 6 Months Chart Data
  const chartData = [];
  for (let i = 5; i >= 0; i--) {
    let bm = b - i, ty = t;
    if (bm <= 0) {
      bm += 12;
      ty--;
    }
    const mas = filterByrBySiklus(state.pembayaran, bm, ty).reduce((s, p) => s + p.jumlah_bayar, 0);
    const kel = filterKlrBySiklus(state.pengeluaran, bm, ty).reduce((s, k) => s + k.jumlah, 0);
    chartData.push({ label: MONTHS[bm].substring(0, 3), masuk: mas, keluar: kel });
  }
  const maxVal = Math.max(1, ...chartData.map(d => Math.max(d.masuk, d.keluar)));

  const formatShortRp = (n) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.?0+$/, '') + ' jt';
    if (n >= 1000) return (n / 1000).toFixed(0) + ' rb';
    return n.toString();
  };

  return (
    <div className="space-y-6">
      {/* FILTER BULAN / TAHUN */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Statistik Ringkasan</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Kas Air RT 01 / RW 03 periode berjalan</p>
        </div>
        <div className="flex gap-2">
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="px-3 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-teal-500"
          >
            {MONTHS.map((m, idx) => idx > 0 && <option key={idx} value={idx}>{m} (15 {idx === 1 ? 'Des' : MONTHS[idx-1]} - 14 {m})</option>)}
          </select>
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-teal-500"
          >
            {[2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* KARTU RINGKASAN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Warga Aktif */}
        <div onClick={() => openDetail("Warga Aktif", "warga", wargaAktif, wargaAktif.length)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors p-4 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900/30 text-slate-600 dark:text-slate-400">
            <Users size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{wargaAktif.length}</p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Warga Aktif</p>
          </div>
        </div>

        {/* Tagihan Air */}
        <div onClick={() => openDetail("Tagihan Air", "uang", tagihanItems, tagihan)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors p-4 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900/30 text-slate-600 dark:text-slate-400">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{fmtRp(tagihan)}</p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Tagihan Air {MONTHS[targetB]}</p>
          </div>
        </div>

        {/* Saldo Kas RT */}
        <div onClick={() => openDetail("Saldo Kas RT (Seluruh Waktu)", "mix", [...totalBayarAllItems, ...totalKeluarAllItems], saldo)} className="cursor-pointer hover:bg-teal-100/50 dark:hover:bg-teal-900/40 transition-colors p-4 rounded-2xl bg-teal-50/50 dark:bg-teal-950/10 shadow-sm border border-teal-200/60 dark:border-teal-900/30 flex items-center gap-4 col-span-1 lg:col-span-2">
          <div className="p-3 rounded-xl bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400">
            <Wallet size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-teal-700 dark:text-teal-400">{fmtRp(saldo)}</p>
            <p className="text-xs font-bold text-teal-600 dark:text-teal-500">Saldo Kas RT (Seluruh Waktu)</p>
            <p className="text-[10px] text-teal-500/80 dark:text-teal-500/60 mt-0.5">Rumus: Total Seluruh Pemasukan - Total Seluruh Pengeluaran</p>
          </div>
        </div>

        {/* Pendapatan Meteran (A) */}
        <div onClick={() => openDetail("Pendapatan Air (A)", "uang", pendapatanAirItems, pendapatanAir)} className="cursor-pointer hover:bg-emerald-100/50 dark:hover:bg-emerald-900/40 transition-colors p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/10 shadow-sm border border-emerald-200/60 dark:border-emerald-900/30 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
            <Droplet size={24} />
          </div>
          <div>
            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{fmtRp(pendapatanAir)}</p>
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-500">Pendapatan Air (A)</p>
            <p className="text-[10px] text-emerald-500/80 dark:text-emerald-500/60 mt-0.5">Iuran air warga bulan ini</p>
          </div>
        </div>

        {/* Pemasukan Lain (B) */}
        <div onClick={() => openDetail("Pemasukan Lain (B)", "uang", pemasukanLainItems, pemasukanLain)} className="cursor-pointer hover:bg-emerald-100/50 dark:hover:bg-emerald-900/40 transition-colors p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/10 shadow-sm border border-emerald-200/60 dark:border-emerald-900/30 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
            <ArrowDownCircle size={24} />
          </div>
          <div>
            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{fmtRp(pemasukanLain)}</p>
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-500">Pemasukan Lain (B)</p>
            <p className="text-[10px] text-emerald-500/80 dark:text-emerald-500/60 mt-0.5">Selain air & patungan bulan ini</p>
          </div>
        </div>

        {/* Total Pemasukan */}
        <div onClick={() => openDetail("Total Pemasukan Bulan Ini", "uang", masukItems, masuk)} className="cursor-pointer hover:bg-emerald-200/50 dark:hover:bg-emerald-800/40 transition-colors p-4 rounded-2xl bg-emerald-100/50 dark:bg-emerald-900/20 shadow-sm border border-emerald-300/60 dark:border-emerald-800/40 flex items-center gap-4 col-span-1 lg:col-span-2">
          <div className="p-3 rounded-xl bg-emerald-200 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300">
            <ArrowDownCircle size={24} />
          </div>
          <div>
            <p className="text-xl font-bold text-emerald-800 dark:text-emerald-300">{fmtRp(masuk)}</p>
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Total Semua Pemasukan Bulan Ini</p>
            <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/70 mt-0.5">Rumus: Pendapatan Air (A) + Pemasukan Lain (B) + Patungan Warga</p>
          </div>
        </div>

        {/* Pengeluaran Operasional (C) */}
        <div onClick={() => openDetail("Pengeluaran Operasional (C)", "uang", keluarAirItems, keluarAir)} className="cursor-pointer hover:bg-rose-100/50 dark:hover:bg-rose-900/40 transition-colors p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/10 shadow-sm border border-rose-200/60 dark:border-rose-900/30 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">
            <ArrowUpCircle size={24} />
          </div>
          <div>
            <p className="text-xl font-bold text-rose-700 dark:text-rose-400">{fmtRp(keluarAir)}</p>
            <p className="text-xs font-bold text-rose-600 dark:text-rose-500">Pengeluaran Operasional (C)</p>
            <p className="text-[10px] text-rose-500/80 dark:text-rose-500/60 mt-0.5">Listrik, admin, dll bulan ini</p>
          </div>
        </div>

        {/* Kas Bersih Meteran */}
        <div onClick={() => openDetail("Kas Bersih Meteran", "mix", [...pendapatanAirItems.map(k=>({...k, type: "in"})), ...keluarAirItems.map(k=>({...k, type: "out"}))], kasBersihMeteran)} className="cursor-pointer hover:bg-cyan-100/50 dark:hover:bg-cyan-900/40 transition-colors p-4 rounded-2xl bg-cyan-50/50 dark:bg-cyan-950/10 shadow-sm border border-cyan-200/60 dark:border-cyan-900/30 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400">
            <Gauge size={24} />
          </div>
          <div>
            <p className="text-xl font-bold text-cyan-700 dark:text-cyan-400">{fmtRp(kasBersihMeteran)}</p>
            <p className="text-xs font-bold text-cyan-600 dark:text-cyan-500">Kas Bersih Meteran Air</p>
            <p className="text-[10px] text-cyan-500/80 dark:text-cyan-500/60 mt-0.5">Rumus: Pendapatan Air (A) - Operasional (C)</p>
          </div>
        </div>

        {/* Total Pengeluaran */}
        <div onClick={() => openDetail("Total Pengeluaran Bulan Ini", "uang", keluarItems, keluar)} className="cursor-pointer hover:bg-rose-200/50 dark:hover:bg-rose-800/40 transition-colors p-4 rounded-2xl bg-rose-100/50 dark:bg-rose-900/20 shadow-sm border border-rose-300/60 dark:border-rose-800/40 flex items-center gap-4 col-span-1 lg:col-span-2">
          <div className="p-3 rounded-xl bg-rose-200 dark:bg-rose-800 text-rose-700 dark:text-rose-300">
            <ArrowUpCircle size={24} />
          </div>
          <div>
            <p className="text-xl font-bold text-rose-800 dark:text-rose-300">{fmtRp(keluar)}</p>
            <p className="text-xs font-bold text-rose-700 dark:text-rose-400">Total Semua Pengeluaran Bulan Ini</p>
            <p className="text-[10px] text-rose-600/80 dark:text-rose-400/70 mt-0.5">Rumus: Operasional (C) + Biaya Servis Mesin Patungan</p>
          </div>
        </div>

        {/* Kas Patungan (Mesin) All-time */}
        <div onClick={() => openDetail("Sisa Saldo Kas Patungan Mesin", "mix", saldoPatunganItems, saldoPatungan)} className="cursor-pointer hover:bg-amber-100/50 dark:hover:bg-amber-900/40 transition-colors p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/10 shadow-sm border border-amber-200/60 dark:border-amber-900/30 flex items-center gap-4 col-span-1 lg:col-span-4">
          <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
            <Wrench size={24} />
          </div>
          <div>
            <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{fmtRp(saldoPatungan)}</p>
            <p className="text-xs font-bold text-amber-600 dark:text-amber-500">Sisa Saldo Kas Patungan Mesin (Seluruh Waktu)</p>
            <p className="text-[10px] text-amber-500/80 dark:text-amber-500/60 mt-0.5">Rumus: Total Uang Patungan Warga - Total Pengeluaran Servis Mesin</p>
          </div>
        </div>
      </div>

      {/* DUA KARTU TAMPILAN GRAFIK & TUNGGAKAN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART ARUS KAS */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
          <h3 className="text-md font-bold text-slate-900 dark:text-white mb-4">Arus Kas 6 Bulan Terakhir</h3>
          
          <div className="flex gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-6">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-teal-500 inline-block"></span> Pemasukan
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block"></span> Pengeluaran
            </span>
          </div>

          <div className="flex justify-between items-end h-[160px] pt-4 border-b border-slate-200 dark:border-slate-700 px-2">
            {chartData.map((d, idx) => (
              <div key={idx} className="flex flex-col items-center flex-1 max-w-[60px] gap-2 h-full justify-end">
                {/* Tooltip value */}
                <div className="flex flex-col items-center text-[9px] font-bold space-y-0.5">
                  <span className="text-teal-600 dark:text-teal-400">{d.masuk > 0 ? formatShortRp(d.masuk) : '-'}</span>
                  <span className="text-amber-600 dark:text-amber-400">{d.keluar > 0 ? formatShortRp(d.keluar) : '-'}</span>
                </div>
                {/* Bars */}
                <div className="flex items-end gap-1 w-full h-[100px]">
                  <div 
                    style={{ height: `${Math.max(4, (d.masuk / maxVal) * 100)}%` }}
                    className="flex-1 bg-teal-500 dark:bg-teal-600 rounded-t-sm hover:opacity-80 transition-all cursor-pointer"
                    title={`Pemasukan: ${fmtRp(d.masuk)}`}
                  ></div>
                  <div 
                    style={{ height: `${Math.max(4, (d.keluar / maxVal) * 100)}%` }}
                    className="flex-1 bg-amber-500 dark:bg-amber-600 rounded-t-sm hover:opacity-80 transition-all cursor-pointer"
                    title={`Pengeluaran: ${fmtRp(d.keluar)}`}
                  ></div>
                </div>
                {/* Label */}
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-1">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* DAFTAR WARGA BELUM BAYAR */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-md font-bold text-slate-900 dark:text-white">Belum Bayar — {MONTHS[b]} {t}</h3>
            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${belumBayar.length > 0 ? 'bg-rose-100 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400' : 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'}`}>
              {belumBayar.length} warga
            </span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[220px] rounded-xl border border-slate-100 dark:border-slate-700/60 no-scrollbar">
            {belumBayar.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
                <CheckCircle size={36} className="text-emerald-500 mb-2" />
                <p className="text-sm font-semibold">Semua warga lunas bulan ini!</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-700/60">
                    <th className="p-3 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800">Nama</th>
                    <th className="p-3 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800">No. Meter</th>
                    <th className="p-3 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 text-right">Tagihan</th>
                    <th className="p-3 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 text-right">Kekurangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                  {belumBayar.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 text-slate-700 dark:text-slate-300">
                      <td className="p-3 font-semibold">{item.nama}</td>
                      <td className="p-3"><code className="font-mono text-cyan-600 dark:text-cyan-400">{item.no_meter}</code></td>
                      <td className="p-3 text-right font-semibold">{item.tagihanBulanIni > 0 ? fmtRp(item.tagihanBulanIni) : '-'}</td>
                      <td className="p-3 text-right">
                        <span className="inline-flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400">
                          <AlertCircle size={12} />
                          {fmtRp(item.sisa)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      
      {/* MODAL DETAIL */}
      {detailModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-2xl shadow-xl flex flex-col overflow-hidden max-h-[85vh]">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/80">
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">{detailModal.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Daftar rincian transaksi</p>
              </div>
              <button onClick={() => setDetailModal({...detailModal, isOpen: false})} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1 bg-white dark:bg-slate-900/50">
              {detailModal.items.length === 0 ? (
                <div className="text-center text-slate-500 py-8">Tidak ada data.</div>
              ) : (
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                      <th className="pb-2 font-semibold">Nama / Ref</th>
                      {detailModal.type !== 'warga' && <th className="pb-2 font-semibold">Keterangan</th>}
                      {detailModal.type !== 'warga' && <th className="pb-2 font-semibold text-right">Nominal</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {detailModal.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 text-slate-700 dark:text-slate-300">
                          {detailModal.type === 'warga' ? item.nama : (item.nama_warga || '-')}
                        </td>
                        {detailModal.type !== 'warga' && (
                          <td className="py-3 text-slate-500 dark:text-slate-400 text-xs">
                            {item.desc || '-'}
                          </td>
                        )}
                        {detailModal.type !== 'warga' && (
                          <td className={`py-3 text-right font-semibold ${item.type === 'out' ? 'text-rose-600 dark:text-rose-400' : (item.type === 'in' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300')}`}>
                            {item.type === 'out' ? '-' : (item.type === 'in' ? '+' : '')}{fmtRp(item.nominal)}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* TOTAL / PENJUMLAHAN FOOTER */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/90 border-t border-slate-200 dark:border-slate-700">
              {detailModal.type === 'mix' ? (
                <div className="flex flex-col sm:flex-row justify-between items-center text-sm font-bold gap-2">
                  <div className="flex gap-4">
                    <span className="text-slate-500 dark:text-slate-400">Pemasukan: <span className="text-emerald-600 dark:text-emerald-400">{fmtRp(detailModal.items.filter(i => i.type === 'in').reduce((s, i) => s + i.nominal, 0))}</span></span>
                    <span className="text-slate-500 dark:text-slate-400">Pengeluaran: <span className="text-rose-600 dark:text-rose-400">{fmtRp(detailModal.items.filter(i => i.type === 'out').reduce((s, i) => s + i.nominal, 0))}</span></span>
                  </div>
                  <span className="text-slate-900 dark:text-white px-3 py-1 rounded-lg bg-white dark:bg-slate-700 shadow-sm border border-slate-200 dark:border-slate-600">Sisa Kas: {fmtRp(detailModal.total)}</span>
                </div>
              ) : detailModal.type === 'uang' ? (
                <div className="flex flex-col gap-3">
                  {detailModal.items.some(i => i.category) && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      {Array.from(new Set(detailModal.items.map(i => i.category).filter(Boolean))).map(cat => (
                        <span key={cat} className="text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-700/50 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600">
                          {cat}: <span className="font-bold text-emerald-600 dark:text-emerald-400">{fmtRp(detailModal.items.filter(i => i.category === cat).reduce((s, i) => s + i.nominal, 0))}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className={`flex justify-between items-center text-sm font-bold ${detailModal.items.some(i => i.category) ? 'pt-3 border-t border-slate-200 dark:border-slate-700' : ''}`}>
                    <span className="text-slate-600 dark:text-slate-300">Total Keseluruhan</span>
                    <span className="text-lg text-emerald-600 dark:text-emerald-400">{fmtRp(detailModal.total)}</span>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center text-sm font-bold">
                  <span className="text-slate-600 dark:text-slate-300">Total Warga Aktif</span>
                  <span className="text-lg text-slate-800 dark:text-white">{detailModal.total} Orang</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;