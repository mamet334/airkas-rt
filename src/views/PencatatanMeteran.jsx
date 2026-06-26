/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { useDb } from '../store/DbContext';
import { useNotification } from '../store/NotificationContext';
import { fmtRp, MONTHS } from '../utils/format';
import { Save, Lock, ArrowRight, CheckCircle, Info } from 'lucide-react';
import { getCycleMonthYear } from '../utils/billing';

const PencatatanMeteran = () => {
  const { state, isAdminUnlocked, executeWrite } = useDb();
  const { showToast, showAlert } = useNotification();

  const cur = new Date();
  const cycle = getCycleMonthYear(cur);
  const [selectedMonth, setSelectedMonth] = useState(cycle.month);
  const [selectedYear, setSelectedYear] = useState(cycle.year);

  const b = selectedMonth;
  const t = selectedYear;

  // Local state to hold form inputs
  const [readings, setReadings] = useState([]);

  // Calculate previous month/year
  const getPrevMonthYear = (m, y) => {
    let prevM = m - 1;
    let prevY = y;
    if (prevM === 0) {
      prevM = 12;
      prevY--;
    }
    return { month: prevM, year: prevY };
  };

  const { month: prevM, year: prevY } = getPrevMonthYear(b, t);

  // Initialize readings state when month/year or state changes
  useEffect(() => {
    const activeWarga = state.warga.filter(w => w.aktif && w.alamat !== 'SISTEM');
    const tarif = state.settings.tarif_per_m3 || 8000;

    const initialReadings = activeWarga.map(w => {
      // Find current reading for this month/year if it already exists
      const existing = state.meteran.find(m => m.warga_id === w.id && m.bulan === b && m.tahun === t);
      
      // Find previous reading to default "meter_lalu"
      const previous = state.meteran.find(m => m.warga_id === w.id && m.bulan === prevM && m.tahun === prevY);
      const defaultMeterLalu = previous ? previous.meter_sekarang : 0;

      return {
        warga_id: w.id,
        nama: w.nama,
        no_meter: w.no_meter,
        adalah_pengelola: w.adalah_pengelola === true,
        id: existing ? existing.id : crypto.randomUUID(),
        meter_lalu: existing ? existing.meter_lalu : defaultMeterLalu,
        meter_sekarang_input: existing ? existing.meter_sekarang.toString() : '',
        tarif_per_m3: existing ? existing.tarif_per_m3 : tarif,
        isExisting: !!existing
      };
    });

    setReadings(initialReadings);
  }, [b, t, state.warga, state.meteran, state.settings, prevM, prevY]);

  const handleInputChange = (wargaId, val) => {
    setReadings(prev => prev.map(r => {
      if (r.warga_id !== wargaId) return r;
      
      const metSekarang = val === '' ? 0 : Number(val);
      const pemakaian = Math.max(0, metSekarang - r.meter_lalu);
      
      // Pengelola RT gratis, total tagihan selalu Rp 0
      const totalTagihan = r.adalah_pengelola ? 0 : (pemakaian * r.tarif_per_m3);

      return {
        ...r,
        meter_sekarang_input: val,
        pemakaian,
        total_tagihan: totalTagihan
      };
    }));
  };

  const handleSaveAll = async () => {
    // Validate inputs
    const filledReadings = readings.filter(r => r.meter_sekarang_input !== '');
    if (filledReadings.length === 0) {
      showToast('Masukkan setidaknya satu angka meter sekarang untuk disimpan.', 'warning');
      return;
    }

    // Check for negative usage and extreme spikes
    let hasExtremeUsage = false;
    for (const r of filledReadings) {
      const metSek = Number(r.meter_sekarang_input);
      if (isNaN(metSek) || metSek < 0) {
        showToast(`Meter sekarang warga ${r.nama} tidak valid.`, 'error');
        return;
      }
      if (metSek < r.meter_lalu) {
        showToast(`Meter sekarang warga ${r.nama} (${metSek}) tidak boleh kurang dari meter lalu (${r.meter_lalu})!`, 'error');
        return;
      }
      if (metSek - r.meter_lalu > 150) {
        hasExtremeUsage = true;
      }
    }

    const confirmMsg = hasExtremeUsage
      ? `PERINGATAN: Terdapat lonjakan pemakaian air tidak wajar (>150 m³). Pastikan tidak ada salah ketik. Tetap simpan pencatatan untuk ${filledReadings.length} warga?`
      : `Simpan pencatatan meteran untuk ${filledReadings.length} warga pada periode ${MONTHS[b]} ${t}?`;

    showAlert({
      title: 'Simpan Meteran',
      message: confirmMsg,
      type: hasExtremeUsage ? 'danger' : 'warning',
      onConfirm: async () => {
        let savedCount = 0;
        try {
          for (const r of filledReadings) {
            const metSek = Number(r.meter_sekarang_input);
            const pemakaian = metSek - r.meter_lalu;
            const totalTagihan = r.adalah_pengelola ? 0 : (pemakaian * r.tarif_per_m3);

            const meteranRecord = {
              id: r.id,
              warga_id: r.warga_id,
              bulan: b,
              tahun: t,
              meter_lalu: r.meter_lalu,
              meter_sekarang: metSek,
              pemakaian: pemakaian,
              tarif_per_m3: r.tarif_per_m3,
              biaya_admin: 0,
              total_tagihan: totalTagihan
            };

            await executeWrite({
              table: 'meteran',
              action: r.isExisting ? 'update' : 'insert',
              id: r.id,
              data: meteranRecord,
              logMsg: `Catat meteran ${r.nama}: Lalu ${r.meter_lalu}, Sekarang ${metSek}, Pakai ${pemakaian} m3, Tagihan ${fmtRp(totalTagihan)}`
            });
            savedCount++;
          }
          showToast(`Berhasil menyimpan ${savedCount} catatan meteran!`, 'success');
        } catch (e) {
          if (savedCount > 0) {
            showToast(`Menyimpan ${savedCount} catatan, tetapi gagal melanjutkan sisanya.`, 'warning');
          }
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* HEADER & FILTER BAR */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Pencatatan Meteran Air</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Pencatatan pemakaian air bulanan warga</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period selector */}
          <div className="flex gap-2">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-3 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {MONTHS.map((m, idx) => idx > 0 && <option key={idx} value={idx}>{m} (15 {idx === 1 ? 'Des' : MONTHS[idx-1]} - 14 {m})</option>)}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {[2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Action Button */}
          {isAdminUnlocked ? (
            <button
              onClick={handleSaveAll}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-teal-600 hover:bg-teal-500 shadow-md shadow-teal-600/25 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Save size={16} />
              Simpan Semua
            </button>
          ) : (
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 rounded-xl border border-amber-200/40 dark:border-amber-900/30">
              <Lock size={14} />
              Buka Kunci Admin untuk mengisi meteran
            </div>
          )}
        </div>
      </div>

      {/* TARIF SETTING INFO */}
      <div className="flex items-center gap-2.5 p-3.5 rounded-xl border border-teal-200/50 dark:border-teal-900/20 bg-teal-50/40 dark:bg-teal-950/10 text-teal-800 dark:text-teal-400 text-xs">
        <Info size={16} />
        <span>Tarif air aktif: <strong>{fmtRp(state.settings.tarif_per_m3 || 8000)} / m³</strong>. Biaya administrasi: <strong>{fmtRp(state.settings.biaya_admin || 0)}</strong>.</span>
      </div>

      {/* INPUT LIST CARD */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-700/60">
                <th className="p-4 sticky top-0 left-0 z-30 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700">Warga</th>
                <th className="p-4 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800">No. Meter</th>
                <th className="p-4 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 text-center">Meter Lalu</th>
                <th className="p-4 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 text-center">Meter Sekarang</th>
                <th className="p-4 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 text-center">Pemakaian</th>
                <th className="p-4 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 text-right">Estimasi Tagihan</th>
                <th className="p-4 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 text-center">Status Simpan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
              {readings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 dark:text-slate-500 font-medium">
                    Tidak ada warga aktif untuk dicatat.
                  </td>
                </tr>
              ) : (
                readings.map(r => {
                  const metSek = r.meter_sekarang_input === '' ? 0 : Number(r.meter_sekarang_input);
                  const pemakaian = Math.max(0, metSek - r.meter_lalu);
                  const tagihan = r.adalah_pengelola ? 0 : (pemakaian * r.tarif_per_m3);
                  
                  return (
                    <tr key={r.warga_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 text-slate-700 dark:text-slate-300">
                      <td className="p-4 sticky left-0 z-10 bg-white dark:bg-slate-800 border-r border-slate-100 dark:border-slate-700/40">
                        <span className="font-bold text-slate-900 dark:text-slate-100 block">{r.nama}</span>
                        {r.adalah_pengelola && (
                          <span className="text-[9px] font-bold text-cyan-600 dark:text-cyan-400">Pengelola (Gratis Rp 0)</span>
                        )}
                      </td>
                      <td className="p-4"><code className="font-mono text-cyan-600 dark:text-cyan-400 font-bold">{r.no_meter}</code></td>
                      <td className="p-4 text-center">
                        <span className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 font-mono text-slate-600 dark:text-slate-400 font-bold text-xs">
                          {r.meter_lalu}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <ArrowRight size={14} className="text-slate-400" />
                          <input
                            type="number"
                            disabled={!isAdminUnlocked}
                            value={r.meter_sekarang_input}
                            onChange={(e) => handleInputChange(r.warga_id, e.target.value)}
                            placeholder="Ketik angka..."
                            className="px-2.5 py-1.5 w-24 rounded-lg font-mono font-bold text-center text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60 disabled:cursor-not-allowed"
                          />
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-0.5 rounded-md font-mono font-bold text-xs ${pemakaian > 0 ? 'bg-teal-50 dark:bg-teal-950/20 text-teal-700 dark:text-teal-400' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}>
                          {pemakaian} m³
                        </span>
                      </td>
                      <td className="p-4 text-right font-bold text-slate-900 dark:text-slate-100">
                        {fmtRp(tagihan)}
                      </td>
                      <td className="p-4 text-center">
                        {r.isExisting ? (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-bold text-[9px] bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle size={10} />
                            Tersimpan
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-bold text-[9px] bg-slate-100 dark:bg-slate-700/30 text-slate-400">
                            Belum Ada
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PencatatanMeteran;
