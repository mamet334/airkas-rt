import { useState } from 'react';
import { useDb } from '../store/DbContext';
import { useNotification } from '../store/NotificationContext';
import { fmtRp, fmtDate, MONTHS } from '../utils/format';
import { getCycleMonthYear } from '../utils/billing';
import { 
  Download, 
  Plus, 
  Trash2, 
  Lock
} from 'lucide-react';

const CATEGORIES = [
  "Listrik Pompa",
  "Operasional",
  "Perbaikan Mesin (Patungan)",
  "Perawatan & Sparepart",
  "Lain-lain"
];

const Pengeluaran = () => {
  const { state, isAdminUnlocked, executeWrite } = useDb();
  const { showToast, showAlert } = useNotification();

  const cur = new Date();
  const cycle = getCycleMonthYear(cur);
  const [selectedMonth, setSelectedMonth] = useState(cycle.month);
  const [selectedYear, setSelectedYear] = useState(cycle.year);

  const b = selectedMonth;
  const t = selectedYear;

  // Add modal state
  const [isAdding, setIsAdding] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    tanggal: cur.toISOString().split('T')[0],
    kategori: 'Listrik Pompa',
    keterangan: '',
    jumlah: '',
    no_bukti: ''
  });

  const resetForm = () => {
    setFormData({
      tanggal: new Date().toISOString().split('T')[0],
      kategori: 'Listrik Pompa',
      keterangan: '',
      jumlah: '',
      no_bukti: ''
    });
  };

  // Filtered list of expenditures for the cycle
  const list = [...state.pengeluaran]
    .filter(k => {
      const c = getCycleMonthYear(k.tanggal);
      return c.month === b && c.year === t;
    })
    .sort((x, y) => new Date(y.tanggal) - new Date(x.tanggal));

  const totalExp = list.reduce((s, p) => s + p.jumlah, 0);

  // Category Summaries
  const byKat = {};
  CATEGORIES.forEach(cat => { byKat[cat] = 0; });
  list.forEach(p => {
    byKat[p.kategori] = (byKat[p.kategori] || 0) + p.jumlah;
  });

  const handleSave = async (e) => {
    e.preventDefault();
    const jumlah = Number(formData.jumlah);
    if (!formData.keterangan.trim() || isNaN(jumlah) || jumlah <= 0) {
      showToast('Harap lengkapi isian wajib dengan benar', 'error');
      return;
    }

    const expRecord = {
      id: crypto.randomUUID(),
      tanggal: new Date(formData.tanggal + 'T12:00:00.000Z').toISOString(),
      kategori: formData.kategori,
      keterangan: formData.keterangan.trim(),
      jumlah: jumlah,
      no_bukti: formData.no_bukti.trim() || null
    };

    await executeWrite({
      table: 'pengeluaran',
      action: 'insert',
      data: expRecord,
      logMsg: `Input pengeluaran: ${formData.kategori} - ${formData.keterangan} senilai ${fmtRp(jumlah)}`
    });

    setIsAdding(false);
    resetForm();
  };

  const handleDelete = (p) => {
    showAlert({
      title: 'Hapus Pengeluaran',
      message: `Yakin ingin menghapus data pengeluaran ${p.kategori} senilai ${fmtRp(p.jumlah)}?`,
      type: 'danger',
      onConfirm: async () => {
        await executeWrite({
          table: 'pengeluaran',
          action: 'delete',
          id: p.id,
          logMsg: `Menghapus pengeluaran: ${p.kategori} (${p.keterangan}) senilai ${fmtRp(p.jumlah)}`
        });
        showToast('Pengeluaran berhasil dihapus.', 'success');
      }
    });
  };

  const escapeCsv = (value) => {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
  };

  // INDONESIAN DELIMITER CSV EXPORTER (SEMICOLON ;)
  const handleExportCSV = () => {
    if (list.length === 0) {
      showToast('Tidak ada data pengeluaran untuk periode ini.', 'warning');
      return;
    }

    const rtName = state.settings?.nama_rt || 'RT / RW';
    const pengelola = state.settings?.pengelola || state.settings?.nama_pengelola || 'Nama Pengelola';
    const alamatRt = state.settings?.alamat_rt || 'Alamat RT tidak tersedia';

    let csv = `LAPORAN PENGELUARAN KAS;${escapeCsv(rtName)};${escapeCsv(`${MONTHS[b]} ${t}`)};;;;\r\n`;
    csv += `Nama Pengelola;${escapeCsv(pengelola)};Alamat;${escapeCsv(alamatRt)};;;;\r\n`;
    csv += 'No;Tanggal;Kategori;Keterangan;Nominal Pengeluaran (Rp);Nomor Bukti\r\n';
    list.forEach((p, idx) => {
      const dateStr = new Date(p.tanggal).toLocaleDateString('id-ID');
      const cat = p.kategori || '-';
      const desc = p.keterangan || '-';
      const amount = p.jumlah.toString();
      const proof = p.no_bukti || '-';

      csv += `${idx + 1};${escapeCsv(dateStr)};${escapeCsv(cat)};${escapeCsv(desc)};${amount};${escapeCsv(proof)}\r\n`;
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Pengeluaran_Kas_${MONTHS[b]}_${t}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Ekspor CSV Semicolon berhasil diunduh.', 'success');
  };

  return (
    <div className="space-y-6">
      {/* FILTER & ACTIONS BAR */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
        <div className="flex items-center gap-3">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="px-3 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            {MONTHS.map((m, idx) => idx > 0 && <option key={idx} value={idx}>{m}</option>)}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            {[2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {isAdminUnlocked ? (
          <div className="flex gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
            >
              <Download size={14} />
              CSV
            </button>
            <button
              onClick={() => {
                resetForm();
                setIsAdding(true);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-500 shadow-md active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Plus size={14} />
              Tambah Pengeluaran
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 rounded-xl border border-amber-200/40 dark:border-amber-900/30">
            <Lock size={14} />
            Buka Kunci Admin untuk mengubah pengeluaran
          </div>
        )}
      </div>

      {/* DETAILED LAYOUT: TABLE & SUMMARIES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* EXPENDITURE TABLE */}
        <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700/60">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Daftar Pengeluaran RT — {MONTHS[b]} {t}</h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Siklus pengeluaran: Tanggal 15 s/d 14 bulan berjalan</p>
          </div>
          <div className="overflow-x-auto">
            {list.length === 0 ? (
              <div className="p-12 text-center text-slate-400 dark:text-slate-500 font-medium">
                Belum ada data pengeluaran kas RT periode ini.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-700/60">
                    <th className="p-3.5 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800">Tanggal</th>
                    <th className="p-3.5 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800">Kategori</th>
                    <th className="p-3.5 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800">Keterangan</th>
                    <th className="p-3.5 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 text-right">Jumlah</th>
                    <th className="p-3.5 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 text-center">No. Bukti</th>
                    {isAdminUnlocked && <th className="p-3.5 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 text-center">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                  {list.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 text-slate-700 dark:text-slate-300">
                      <td className="p-3.5 font-mono">{fmtDate(p.tanggal)}</td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${
                          p.kategori === 'Perbaikan Mesin (Patungan)' ? 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400' :
                          p.kategori === 'Listrik Pompa' ? 'bg-cyan-100 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-400' :
                          'bg-slate-100 dark:bg-slate-750 text-slate-600 dark:text-slate-400'
                        }`}>
                          {p.kategori}
                        </span>
                      </td>
                      <td className="p-3.5 font-medium whitespace-pre-wrap">{p.keterangan}</td>
                      <td className="p-3.5 text-right font-bold text-rose-600 dark:text-rose-400">{fmtRp(p.jumlah)}</td>
                      <td className="p-3.5 text-center font-mono">{p.no_bukti || '-'}</td>
                      {isAdminUnlocked && (
                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => handleDelete(p)}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  <tr className="bg-rose-50/50 dark:bg-rose-950/10 font-bold text-slate-900 dark:text-white border-t border-rose-100 dark:border-rose-900/30">
                    <td colSpan="3" className="p-4 text-right">TOTAL PENGELUARAN</td>
                    <td className="p-4 text-right text-rose-600 dark:text-rose-400">{fmtRp(totalExp)}</td>
                    <td colSpan={isAdminUnlocked ? 2 : 1}></td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* SIDE BAR: CATEGORY BREAKDOWNS */}
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
            <h3 className="text-sm font-bold text-slate-850 dark:text-slate-250 mb-3">Ringkasan Kategori</h3>
            <div className="space-y-3.5">
              {CATEGORIES.map(cat => {
                const value = byKat[cat] || 0;
                const pct = totalExp > 0 ? (value / totalExp) * 100 : 0;
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-600 dark:text-slate-400">{cat}</span>
                      <span className="text-slate-900 dark:text-white font-bold">{fmtRp(value)}</span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                      <div 
                        style={{ width: `${pct}%` }} 
                        className={`h-full rounded-full ${
                          cat === 'Perbaikan Mesin (Patungan)' ? 'bg-amber-500' :
                          cat === 'Listrik Pompa' ? 'bg-cyan-500' : 'bg-teal-500'
                        }`}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ADD EXPENDITURE MODAL */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <form onSubmit={handleSave} className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Tambah Pengeluaran Kas</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Tanggal Pengeluaran</label>
                <input
                  type="date"
                  required
                  value={formData.tanggal}
                  onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
                  className="px-3 py-2 w-full rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Kategori</label>
                <select
                  value={formData.kategori}
                  onChange={(e) => setFormData({ ...formData, kategori: e.target.value })}
                  className="px-3 py-2 w-full rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                >
                  {CATEGORIES.map(cat => <option key={cat}>{cat}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Keterangan Pengeluaran</label>
                <textarea
                  required
                  rows="3"
                  value={formData.keterangan}
                  onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
                  placeholder="Contoh:&#10;1bh poring robuta rd 85 Rp 225.000&#10;1bh piston npr Rp 175.000"
                  className="px-3 py-2 w-full rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 resize-y"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Nominal Jumlah (Rp)</label>
                  <input
                    type="number"
                    required
                    value={formData.jumlah}
                    onChange={(e) => setFormData({ ...formData, jumlah: e.target.value })}
                    placeholder="Contoh: 150000"
                    className="px-3 py-2 w-full rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Nomor Bukti (Opsional)</label>
                  <input
                    type="text"
                    value={formData.no_bukti}
                    onChange={(e) => setFormData({ ...formData, no_bukti: e.target.value })}
                    placeholder="Contoh: K-01"
                    className="px-3 py-2 w-full rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-teal-600 hover:bg-teal-500 shadow-md active:scale-95 transition-all"
              >
                Simpan Pengeluaran
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Pengeluaran;
