/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useMemo } from 'react';
import { useDb } from '../store/DbContext';
import { useNotification } from '../store/NotificationContext';
import { fmtRp, MONTHS } from '../utils/format';
import { Save, Lock, ArrowRight, CheckCircle, Info, Wrench, AlertTriangle } from 'lucide-react';
import { getCycleMonthYear } from '../utils/billing';
import { resolveMeterLalu, hitungPemakaian, periodKey, siklusEfektifPenggantian } from '../utils/meterChain';
import { keteranganAkhirMeterLama } from '../utils/gantiMeterText';

const todayStr = () => new Date().toISOString().split('T')[0];

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

  // Form penggantian meteran (null = tertutup)
  const [gantiForm, setGantiForm] = useState(null);

  // Initialize readings state when month/year or state changes
  useEffect(() => {
    const activeWarga = state.warga.filter(w => w.aktif && w.alamat !== 'SISTEM');
    const tarif = state.settings.tarif_per_m3 || 8000;

    const initialReadings = activeWarga.map(w => {
      const existing = state.meteran.find(m => m.warga_id === w.id && m.bulan === b && m.tahun === t);

      // Angka pembanding ditentukan oleh rantai meteran, bukan sekadar bulan
      // lalu — supaya meteran yang baru diganti mulai dari angka awalnya.
      const rantai = resolveMeterLalu(w.id, b, t, {
        meteran: state.meteran,
        penggantian: state.penggantian_meter
      });

      return {
        warga_id: w.id,
        nama: w.nama,
        no_meter: w.no_meter,
        adalah_pengelola: w.adalah_pengelola === true,
        id: existing ? existing.id : crypto.randomUUID(),
        meter_lalu: existing ? Number(existing.meter_lalu) : rantai.meterLalu,
        meter_sekarang_input: existing ? existing.meter_sekarang.toString() : '',
        tarif_per_m3: existing ? existing.tarif_per_m3 : tarif,
        isExisting: !!existing,
        // Jejak penggantian untuk siklus ini
        penggantian: rantai.penggantian,
        isRantaiBaru: rantai.isRantaiBaru,
        meterSebelumGanti: rantai.meterSebelumGanti,
        pemakaian_meter_lama: existing
          ? Number(existing.pemakaian_meter_lama || 0)
          : rantai.pemakaianMeterLama
      };
    });

    setReadings(initialReadings);
  }, [b, t, state.warga, state.meteran, state.penggantian_meter, state.settings]);

  // (i) Peringatan bila periode yang dipilih sudah berisi catatan tersimpan.
  // Menutup jebakan tanggal 14: mencatat pada tanggal 14 membuat dropdown
  // periode jatuh ke bulan sebelumnya, yang isinya sudah final.
  const tersimpanCount = readings.filter(r => r.isExisting).length;

  const handleInputChange = (wargaId, val) => {
    setReadings(prev => prev.map(r => (
      r.warga_id === wargaId ? { ...r, meter_sekarang_input: val } : r
    )));
  };

  const handleSaveAll = async () => {
    const filledReadings = readings.filter(r => r.meter_sekarang_input !== '');
    if (filledReadings.length === 0) {
      showToast('Masukkan setidaknya satu angka meter sekarang untuk disimpan.', 'warning');
      return;
    }

    let hasExtremeUsage = false;
    for (const r of filledReadings) {
      const metSek = Number(r.meter_sekarang_input);
      if (isNaN(metSek) || metSek < 0) {
        showToast(`Meter sekarang warga ${r.nama} tidak valid.`, 'error');
        return;
      }
      // Pengaman salah ketik tetap aktif. Pada siklus penggantian, meter_lalu
      // sudah bernilai angka awal meteran baru, jadi angka kecil lolos wajar
      // tanpa perlu melemahkan aturannya.
      if (metSek < r.meter_lalu) {
        showToast(
          r.isRantaiBaru
            ? `Meter sekarang warga ${r.nama} (${metSek}) tidak boleh kurang dari angka awal meteran baru (${r.meter_lalu})!`
            : `Meter sekarang warga ${r.nama} (${metSek}) tidak boleh kurang dari meter lalu (${r.meter_lalu})!`,
          'error'
        );
        return;
      }
      if (hitungPemakaian(metSek, r.meter_lalu, r.pemakaian_meter_lama) > 150) {
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
            const pemakaianLama = Number(r.pemakaian_meter_lama || 0);
            const pemakaian = hitungPemakaian(metSek, r.meter_lalu, pemakaianLama);
            const totalTagihan = r.adalah_pengelola ? 0 : (pemakaian * r.tarif_per_m3);

            const meteranRecord = {
              id: r.id,
              warga_id: r.warga_id,
              bulan: b,
              tahun: t,
              meter_lalu: r.meter_lalu,
              meter_sekarang: metSek,
              // `pemakaian` tetap total yang ditagih (lama + baru) agar semua
              // laporan yang sudah membaca kolom ini tidak perlu diubah.
              pemakaian: pemakaian,
              pemakaian_meter_lama: pemakaianLama,
              ganti_meter_id: r.penggantian ? r.penggantian.id : null,
              tarif_per_m3: r.tarif_per_m3,
              biaya_admin: 0,
              total_tagihan: totalTagihan
            };

            const jejakGanti = pemakaianLama > 0
              ? `, termasuk sisa meteran lama ${pemakaianLama} m3`
              : (r.isRantaiBaru ? ' (meteran baru)' : '');

            await executeWrite({
              table: 'meteran',
              action: r.isExisting ? 'update' : 'insert',
              id: r.id,
              data: meteranRecord,
              logMsg: `Catat meteran ${r.nama}: Lalu ${r.meter_lalu}, Sekarang ${metSek}, Pakai ${pemakaian} m3${jejakGanti}, Tagihan ${fmtRp(totalTagihan)}`
            });
            savedCount++;
          }
          showToast(`Berhasil menyimpan ${savedCount} catatan meteran!`, 'success');
          // eslint-disable-next-line no-unused-vars
        } catch (e) {
          if (savedCount > 0) {
            showToast(`Menyimpan ${savedCount} catatan, tetapi gagal melanjutkan sisanya.`, 'warning');
          }
        }
      }
    });
  };

  // ─── Penggantian meteran ──────────────────────────────────────────────────
  // Menyusun isi form dari tanggal penggantian. Siklus berlakunya TIDAK
  // diambil dari periode yang sedang dibuka di tabel, melainkan dihitung:
  // bila pembacaan siklus itu sudah dilakukan, meteran baru baru terbaca
  // pada siklus berikutnya.
  const buatGantiForm = (warga, tanggal, sebelumnya = {}) => {
    const efektif = siklusEfektifPenggantian(warga.warga_id, tanggal, state.meteran);
    const dasar = resolveMeterLalu(warga.warga_id, efektif.bulan, efektif.tahun, {
      meteran: state.meteran,
      penggantian: state.penggantian_meter
    });

    return {
      warga_id: warga.warga_id,
      nama: warga.nama,
      tanggal,
      bulan: efektif.bulan,
      tahun: efektif.tahun,
      no_meter_lama: warga.no_meter || '',
      no_meter_baru: '',
      meter_awal_baru: '0',
      keterangan: 'Meteran lama rusak',
      ...sebelumnya,
      // Diisi otomatis dari pembacaan terakhir SEBELUM siklus berlaku.
      // Nilainya sama dengan angka terakhir meteran lama, sehingga sisa
      // pemakaiannya 0 kecuali admin menaikkannya karena sempat membaca
      // meteran lama sekali lagi saat penggantian.
      meter_akhir_lama: dasar.meterSebelumGanti ? String(dasar.meterSebelumGanti) : ''
    };
  };

  const openGantiForm = (r) => {
    setGantiForm(buatGantiForm(r, todayStr()));
  };

  // Angka meteran lama terakhir yang tercatat sebelum siklus penggantian.
  // Dipakai untuk memperkirakan sisa pemakaian meteran lama secara langsung
  // saat admin mengetik, memakai aturan yang sama dengan perhitungan simpan.
  const dasarGanti = useMemo(() => {
    if (!gantiForm) return null;
    return resolveMeterLalu(gantiForm.warga_id, gantiForm.bulan, gantiForm.tahun, {
      meteran: state.meteran,
      penggantian: state.penggantian_meter
    });
  }, [gantiForm, state.meteran, state.penggantian_meter]);

  const infoAkhirLama = keteranganAkhirMeterLama(
    gantiForm?.meter_akhir_lama,
    dasarGanti?.meterSebelumGanti ?? 0
  );

  // Catatan yang sudah tersimpan pada siklus penggantian atau sesudahnya.
  // Angka tagihan yang sudah diumumkan ke warga tidak dihitung ulang diam-diam.
  const barisTerdampak = useMemo(() => {
    if (!gantiForm) return [];
    const batas = periodKey(gantiForm.bulan, gantiForm.tahun);
    return state.meteran
      .filter(m => m.warga_id === gantiForm.warga_id && periodKey(m.bulan, m.tahun) >= batas)
      .sort((x, y) => periodKey(x.bulan, x.tahun) - periodKey(y.bulan, y.tahun));
  }, [gantiForm, state.meteran]);

  const handleSaveGanti = async (e) => {
    e.preventDefault();
    if (!gantiForm) return;

    const awalBaru = Number(gantiForm.meter_awal_baru || 0);
    if (isNaN(awalBaru) || awalBaru < 0) {
      showToast('Angka awal meteran baru tidak valid.', 'error');
      return;
    }

    const akhirLamaRaw = String(gantiForm.meter_akhir_lama).trim();
    const akhirLama = akhirLamaRaw === '' ? null : Number(akhirLamaRaw);
    if (akhirLama !== null && (isNaN(akhirLama) || akhirLama < 0)) {
      showToast('Angka akhir meteran lama tidak valid.', 'error');
      return;
    }

    const sudahAda = state.penggantian_meter.some(
      g => g.warga_id === gantiForm.warga_id && g.bulan === gantiForm.bulan && g.tahun === gantiForm.tahun
    );
    if (sudahAda) {
      showToast(`Penggantian meteran ${gantiForm.nama} untuk periode ${MONTHS[gantiForm.bulan]} ${gantiForm.tahun} sudah tercatat.`, 'warning');
      return;
    }

    const peringatan = barisTerdampak.length > 0
      ? `\n\nPERHATIAN: Ada ${barisTerdampak.length} catatan meteran yang sudah tersimpan pada periode ${MONTHS[gantiForm.bulan]} ${gantiForm.tahun} atau sesudahnya. Tagihan yang sudah tersimpan TIDAK dihitung ulang otomatis — periksa manual bila perlu.`
      : '';

    showAlert({
      title: 'Catat Penggantian Meteran',
      message:
        `Catat penggantian meteran ${gantiForm.nama}?\n\n` +
        `Mulai siklus: ${MONTHS[gantiForm.bulan]} ${gantiForm.tahun}\n` +
        `Meteran baru dimulai dari angka: ${awalBaru}\n` +
        (akhirLama === null
          ? 'Sisa pemakaian meteran lama: diabaikan (tidak ditagih)'
          : `Angka akhir meteran lama: ${akhirLama} (sisa pemakaiannya ikut ditagih)`) +
        peringatan,
      type: barisTerdampak.length > 0 ? 'danger' : 'warning',
      onConfirm: async () => {
        const record = {
          id: crypto.randomUUID(),
          warga_id: gantiForm.warga_id,
          tanggal: gantiForm.tanggal,
          bulan: gantiForm.bulan,
          tahun: gantiForm.tahun,
          no_meter_lama: gantiForm.no_meter_lama || null,
          meter_akhir_lama: akhirLama,
          no_meter_baru: gantiForm.no_meter_baru.trim().toUpperCase() || null,
          meter_awal_baru: awalBaru,
          keterangan: gantiForm.keterangan || ''
        };

        try {
          await executeWrite({
            table: 'penggantian_meter',
            action: 'insert',
            data: record,
            logMsg:
              `Ganti meteran ${gantiForm.nama} (${gantiForm.no_meter_lama || '-'} -> ${record.no_meter_baru || 'nomor tetap'}) ` +
              `mulai ${MONTHS[gantiForm.bulan]} ${gantiForm.tahun}, angka awal ${awalBaru}` +
              (akhirLama === null ? ', sisa meteran lama diabaikan' : `, angka akhir lama ${akhirLama}`)
          });

          // (b) Nomor meteran warga ikut diperbarui bila nomor baru diisi.
          if (record.no_meter_baru) {
            await executeWrite({
              table: 'warga',
              action: 'update',
              id: gantiForm.warga_id,
              data: { no_meter: record.no_meter_baru },
              logMsg: `Perbarui no meter ${gantiForm.nama}: ${gantiForm.no_meter_lama || '-'} -> ${record.no_meter_baru}`
            });
          }

          showToast(`Penggantian meteran ${gantiForm.nama} tercatat.`, 'success');
          setGantiForm(null);
          // eslint-disable-next-line no-unused-vars
        } catch (err) {
          showToast('Gagal menyimpan penggantian meteran.', 'error');
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Pencatatan Meteran Air</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Pencatatan pemakaian air bulanan warga</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            <select
              value={selectedMonth}
              onChange={(_e) => setSelectedMonth(Number(_e.target.value))}
              className="px-3 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {MONTHS.map((m, idx) => idx > 0 && <option key={idx} value={idx}>{m} (15 {idx === 1 ? 'Des' : MONTHS[idx-1]} - 14 {m})</option>)}
            </select>
            <select
              value={selectedYear}
              onChange={(_e) => setSelectedYear(Number(_e.target.value))}
              className="px-3 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {[2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

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

      <div className="flex items-center gap-2.5 p-3.5 rounded-xl border border-teal-200/50 dark:border-teal-900/20 bg-teal-50/40 dark:bg-teal-950/10 text-teal-800 dark:text-teal-400 text-xs">
        <Info size={16} />
        <span>Tarif air aktif: <strong>{fmtRp(state.settings.tarif_per_m3 || 8000)} / m³</strong>. Biaya administrasi: <strong>{fmtRp(state.settings.biaya_admin || 0)}</strong>.</span>
      </div>

      {tersimpanCount > 0 && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-amber-200/60 dark:border-amber-900/30 bg-amber-50/60 dark:bg-amber-950/10 text-amber-800 dark:text-amber-400 text-xs">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>
            Periode <strong>{MONTHS[b]} {t}</strong> sudah berisi <strong>{tersimpanCount} catatan tersimpan</strong>.
            Menyimpan ulang akan <strong>menimpa</strong> angka yang sudah ada. Pastikan periode yang dipilih benar —
            mencatat pada tanggal 14 membuat periode jatuh ke bulan sebelumnya.
          </span>
        </div>
      )}

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
                {isAdminUnlocked && (
                  <th className="p-4 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 text-center">Meteran</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
              {readings.length === 0 ? (
                <tr>
                  <td colSpan={isAdminUnlocked ? 8 : 7} className="p-8 text-center text-slate-400 dark:text-slate-500 font-medium">
                    Tidak ada warga aktif untuk dicatat.
                  </td>
                </tr>
              ) : (
                readings.map(r => {
                  const metSek = r.meter_sekarang_input === '' ? 0 : Number(r.meter_sekarang_input);
                  const pemakaian = hitungPemakaian(metSek, r.meter_lalu, r.pemakaian_meter_lama);
                  const tagihan = r.adalah_pengelola ? 0 : (pemakaian * r.tarif_per_m3);

                  return (
                    <tr key={r.warga_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 text-slate-700 dark:text-slate-300">
                      <td className="p-4 sticky left-0 z-10 bg-white dark:bg-slate-800 border-r border-slate-100 dark:border-slate-700/40">
                        <span className="font-bold text-slate-900 dark:text-slate-100 block">{r.nama}</span>
                        {r.adalah_pengelola && (
                          <span className="text-[9px] font-bold text-cyan-600 dark:text-cyan-400">Pengelola (Gratis Rp 0)</span>
                        )}
                        {r.isRantaiBaru && (
                          <span className="mt-0.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-bold text-[9px] bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400">
                            <Wrench size={9} />
                            Meteran Baru
                          </span>
                        )}
                      </td>
                      <td className="p-4"><code className="font-mono text-cyan-600 dark:text-cyan-400 font-bold">{r.no_meter}</code></td>
                      <td className="p-4 text-center">
                        <span className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 font-mono text-slate-600 dark:text-slate-400 font-bold text-xs">
                          {r.meter_lalu}
                        </span>
                        {r.isRantaiBaru && (
                          <span className="block mt-1 text-[9px] text-slate-400">
                            meteran lama berakhir di {r.meterSebelumGanti}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <ArrowRight size={14} className="text-slate-400" />
                          <input
                            type="number"
                            disabled={!isAdminUnlocked}
                            value={r.meter_sekarang_input}
                            onChange={(_e) => handleInputChange(r.warga_id, _e.target.value)}
                            placeholder="Ketik angka..."
                            className="px-2.5 py-1.5 w-24 rounded-lg font-mono font-bold text-center text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60 disabled:cursor-not-allowed"
                          />
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-0.5 rounded-md font-mono font-bold text-xs ${pemakaian > 0 ? 'bg-teal-50 dark:bg-teal-950/20 text-teal-700 dark:text-teal-400' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}>
                          {pemakaian} m³
                        </span>
                        {r.pemakaian_meter_lama > 0 && (
                          <span className="block mt-1 text-[9px] text-amber-600 dark:text-amber-400">
                            termasuk {r.pemakaian_meter_lama} m³ meteran lama
                          </span>
                        )}
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
                      {isAdminUnlocked && (
                        <td className="p-4 text-center">
                          <button
                            type="button"
                            onClick={() => openGantiForm(r)}
                            title="Catat penggantian meteran fisik"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-slate-500 hover:bg-amber-50 dark:hover:bg-amber-950/20 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                          >
                            <Wrench size={12} />
                            Ganti
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: PENGGANTIAN METERAN */}
      {gantiForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <form onSubmit={handleSaveGanti} className="max-w-md w-full max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-2xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Wrench size={18} className="text-amber-500" />
                Ganti Meteran
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Warga: <strong className="text-slate-700 dark:text-slate-200">{gantiForm.nama}</strong>
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-700/40 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              Catatan meteran periode sebelumnya <strong>tidak diubah</strong> — tagihan lama tetap utuh dan bisa dibayar seperti biasa.
              Penggantian ini hanya menentukan angka awal perhitungan mulai siklus yang dipilih.
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Tanggal Diganti</label>
                  <input
                    type="date"
                    required
                    value={gantiForm.tanggal}
                    onChange={(e) => setGantiForm(
                      buatGantiForm(gantiForm, e.target.value, {
                        no_meter_lama: gantiForm.no_meter_lama,
                        no_meter_baru: gantiForm.no_meter_baru,
                        meter_awal_baru: gantiForm.meter_awal_baru,
                        keterangan: gantiForm.keterangan
                      })
                    )}
                    className="px-3 py-2 w-full rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Berlaku Mulai Siklus</label>
                  <div className="flex gap-1.5">
                    <select
                      value={gantiForm.bulan}
                      onChange={(e) => setGantiForm({ ...gantiForm, bulan: Number(e.target.value) })}
                      className="px-2 py-2 w-full rounded-xl text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                    >
                      {MONTHS.map((m, idx) => idx > 0 && <option key={idx} value={idx}>{m}</option>)}
                    </select>
                    <select
                      value={gantiForm.tahun}
                      onChange={(e) => setGantiForm({ ...gantiForm, tahun: Number(e.target.value) })}
                      className="px-2 py-2 rounded-xl text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                    >
                      {[2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">No. Meter Lama</label>
                  <input
                    type="text"
                    value={gantiForm.no_meter_lama}
                    onChange={(e) => setGantiForm({ ...gantiForm, no_meter_lama: e.target.value })}
                    placeholder="Arsip"
                    className="px-3 py-2 w-full rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">No. Meter Baru</label>
                  <input
                    type="text"
                    value={gantiForm.no_meter_baru}
                    onChange={(e) => setGantiForm({ ...gantiForm, no_meter_baru: e.target.value })}
                    placeholder="Kosongkan jika tetap"
                    className="px-3 py-2 w-full rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Angka Akhir Meteran Lama <span className="font-normal text-slate-400">(opsional)</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={gantiForm.meter_akhir_lama}
                  onChange={(e) => setGantiForm({ ...gantiForm, meter_akhir_lama: e.target.value })}
                  placeholder="Kosongkan untuk mengabaikan"
                  className="px-3 py-2 w-full rounded-xl text-sm font-mono border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <p className={`text-[10px] mt-1 leading-relaxed ${infoAkhirLama.peringatan ? 'text-rose-500 dark:text-rose-400' : 'text-slate-400'}`}>
                  {infoAkhirLama.teks}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Angka Awal Meteran Baru</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={gantiForm.meter_awal_baru}
                  onChange={(e) => setGantiForm({ ...gantiForm, meter_awal_baru: e.target.value })}
                  className="px-3 py-2 w-full rounded-xl text-sm font-mono border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">Biasanya 0. Isi angka lain bila memakai meteran bekas.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Keterangan</label>
                <input
                  type="text"
                  value={gantiForm.keterangan}
                  onChange={(e) => setGantiForm({ ...gantiForm, keterangan: e.target.value })}
                  placeholder="Contoh: meteran lama rusak / macet"
                  className="px-3 py-2 w-full rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {barisTerdampak.length > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-xl border border-rose-200/60 dark:border-rose-900/30 bg-rose-50/60 dark:bg-rose-950/10 text-rose-700 dark:text-rose-400 text-[11px] leading-relaxed">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>
                    Ada <strong>{barisTerdampak.length} catatan meteran</strong> yang sudah tersimpan pada siklus ini atau sesudahnya
                    ({barisTerdampak.map(m => `${MONTHS[m.bulan]} ${m.tahun}`).join(', ')}).
                    Tagihan yang sudah tersimpan tidak dihitung ulang otomatis — periksa manual bila perlu.
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setGantiForm(null)}
                className="px-4 py-2 flex-1 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-all"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 flex-1 rounded-xl text-sm font-semibold text-white bg-amber-600 hover:bg-amber-500 shadow-md shadow-amber-600/25 active:scale-95 transition-all"
              >
                Simpan Penggantian
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default PencatatanMeteran;
