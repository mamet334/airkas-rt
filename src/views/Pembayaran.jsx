import { useState } from 'react';
import { useDb } from '../store/DbContext';
import { useNotification } from '../store/NotificationContext';
import { fmtRp, fmtDate, fmtDateTime, MONTHS } from '../utils/format';
import { getCycleMonthYear, getWargaDeposit, getWargaTunggakanLalu, filterByrBySiklus } from '../utils/billing';
import { 
  Download, 
  Plus, 
  Trash2, 
  Lock, 
  DollarSign
} from 'lucide-react';

const Pembayaran = () => {
  const { state, isAdminUnlocked, executeWrite } = useDb();
  const { showToast, showAlert } = useNotification();

  const cur = new Date();
  const cycle = getCycleMonthYear(cur);
  const [selectedMonth, setSelectedMonth] = useState(cycle.month);
  const [selectedYear, setSelectedYear] = useState(cycle.year);

  const b = selectedMonth;
  const t = selectedYear;

  // Active Modals state
  const [activeModal, setActiveModal] = useState(null); // 'bayar', 'patungan', 'kas_lain'
  const [isSaving, setIsSaving] = useState(false); // Guard anti double-submit

  // Form inputs state
  const [payMeterId, setPayMeterId] = useState('');
  const [payJumlah, setPayJumlah] = useState('');
  const [payTgl, setPayTgl] = useState(cur.toISOString().split('T')[0]);
  const [payMetode, setPayMetode] = useState('Tunai');
  const [payBukti, setPayBukti] = useState('');
  const [payKet, setPayKet] = useState('');

  const [patunganWarga, setPatunganWarga] = useState('');
  const [patunganJumlah, setPatunganJumlah] = useState('50000');
  const [patunganKet, setPatunganKet] = useState('Patungan Perbaikan Mesin Pompa Air');
  const [patunganTgl, setPatunganTgl] = useState(cur.toISOString().split('T')[0]);
  const [patunganMetode, setPatunganMetode] = useState('Tunai');
  const [patunganNoBukti, setPatunganNoBukti] = useState('');

  const [kasLainWarga, setKasLainWarga] = useState('');
  const [kasLainKet, setKasLainKet] = useState('');
  const [kasLainJumlah, setKasLainJumlah] = useState('');
  const [kasLainTgl, setKasLainTgl] = useState(cur.toISOString().split('T')[0]);
  const [kasLainMetode, setKasLainMetode] = useState('Tunai');
  const [kasLainNoBukti, setKasLainNoBukti] = useState('');

  // 1. Calculations for Period
  const mtrBln = state.meteran.filter(m => m.bulan === b && m.tahun === t);
  const byrBln = state.pembayaran.filter(p => p.bulan === b && p.tahun === t);

  // Rekapitulasi Data
  const rekap = mtrBln.map(m => {
    const w = state.warga.find(x => x.id === m.warga_id);
    if (!w || w.alamat === 'SISTEM') return null;

    const tagihan = w.adalah_pengelola ? 0 : m.total_tagihan;
    const sudah = byrBln.filter(p => p.meteran_id === m.id).reduce((s, p) => s + p.jumlah_bayar, 0);
    const dep = getWargaDeposit(m.warga_id, b, t, state);
    const tunggakanLalu = getWargaTunggakanLalu(m.warga_id, b, t, state);
    const sisa = tagihan + tunggakanLalu - sudah - dep;

    const bayars = byrBln.filter(p => p.meteran_id === m.id);

    let status = 'Belum Bayar';
    if (tagihan === 0) {
      status = 'Lunas';
    } else if (sudah >= tagihan) {
      status = 'Lunas';
    } else if (sudah + dep >= tagihan) {
      status = 'Lunas (Deposit)';
    } else if (sudah > 0) {
      status = 'Sebagian';
    }

    return {
      id: m.id,
      warga_id: m.warga_id,
      nama: w.nama,
      noMeter: w.no_meter,
      tagihan,
      sudah,
      sisa,
      dep,
      tunggakanLalu,
      status,
      bayars
    };
  }).filter(Boolean);

  const totalTagihan = rekap.reduce((s, r) => s + r.tagihan, 0);
  const totalUangMasuk = rekap.reduce((s, r) => s + r.sudah, 0);
  const totalTunggakan = rekap.reduce((s, r) => s + Math.max(0, r.sisa), 0);

  // Outstanding list for Bayar Modal
  const outstanding = mtrBln.map(m => {
    const w = state.warga.find(x => x.id === m.warga_id);
    if (!w || w.alamat === 'SISTEM') return null;
    const tagihan = w.adalah_pengelola ? 0 : m.total_tagihan;
    const sudah = byrBln.filter(p => p.meteran_id === m.id).reduce((s, p) => s + p.jumlah_bayar, 0);
    const dep = getWargaDeposit(m.warga_id, b, t, state);
    const tunggakanLalu = getWargaTunggakanLalu(m.warga_id, b, t, state);
    const sisa = tagihan + tunggakanLalu - sudah - dep;

    return {
      id: m.id,
      warga_id: m.warga_id,
      nama: w.nama,
      noMeter: w.no_meter,
      sisa,
      dep,
      tunggakanLalu
    };
  }).filter(x => x && x.sisa > 0);

  // Histori Log Transaksi Pembayaran
  const byrList = [...state.pembayaran]
    .filter(p => p.bulan === b && p.tahun === t)
    .sort((x, y) => new Date(y.tanggal_bayar) - new Date(x.tanggal_bayar));

  // Handle Bayar Modal opening
  const handleOpenBayar = () => {
    if (outstanding.length === 0) {
      showToast('Seluruh warga sudah lunas pembayaran untuk bulan ini', 'info');
      return;
    }
    const first = outstanding[0];
    setPayMeterId(first.id);
    setPayJumlah(first.sisa.toString());
    setPayTgl(new Date().toISOString().split('T')[0]);
    setPayMetode('Tunai');
    setPayBukti('');
    setPayKet('');
    setActiveModal('bayar');
  };

  const handlePayMeterIdChange = (id) => {
    setPayMeterId(id);
    const sel = outstanding.find(o => String(o.id) === String(id));
    if (sel) {
      setPayJumlah(sel.sisa.toString());
    }
  };

  const handleSaveBayar = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    const sel = outstanding.find(o => String(o.id) === String(payMeterId));
    if (!sel) {
      showToast('Data warga atau tagihan tidak ditemukan. Coba muat ulang halaman.', 'error');
      return;
    }

    const jumlah = Number(payJumlah);
    if (isNaN(jumlah) || jumlah === 0) {
      showToast('Jumlah nominal transaksi tidak boleh Rp 0', 'error');
      return;
    }

    if (jumlah > sel.sisa) {
      showAlert({
        title: 'Kelebihan Pembayaran',
        message: `Nominal Rp ${fmtRp(jumlah)} melebihi sisa tunggakan (${fmtRp(sel.sisa)}). Kelebihan Rp ${fmtRp(jumlah - sel.sisa)} akan otomatis masuk sebagai DEPOSIT warga. Lanjutkan?`,
        type: 'warning',
        onConfirm: () => submitPayment(sel, jumlah)
      });
    } else {
      submitPayment(sel, jumlah);
    }
  };

  const submitPayment = async (sel, jumlah) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const w = state.warga.find(x => x.id === sel.warga_id);
      const payId = crypto.randomUUID();
      const payRecord = {
        id: payId,
        meteran_id: sel.id,
        warga_id: sel.warga_id,
        bulan: b,
        tahun: t,
        jumlah_bayar: jumlah,
        metode: payMetode,
        no_bukti: payBukti.trim() || null,
        keterangan: payKet.trim() || null,
        tanggal_bayar: new Date(payTgl + 'T10:00:00.000Z').toISOString()
      };

      await executeWrite({
        table: 'pembayaran',
        action: 'insert',
        data: payRecord,
        logMsg: `Penerimaan uang ${fmtRp(jumlah)} (${payMetode}) dari ${w ? w.nama : '-'} untuk periode ${MONTHS[b]} ${t}`
      });

      setActiveModal(null);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Patungan Modal opening
  const handleOpenPatungan = () => {
    const wargaReguler = state.warga.filter(w => w.aktif && w.alamat !== 'SISTEM');
    if (wargaReguler.length > 0) {
      setPatunganWarga(wargaReguler[0].id);
    }
    setPatunganJumlah('50000');
    setPatunganKet('Patungan Perbaikan Mesin Pompa Air');
    setPatunganTgl(new Date().toISOString().split('T')[0]);
    setPatunganMetode('Tunai');
    setPatunganNoBukti('');
    setActiveModal('patungan');
  };

  const handleSavePatungan = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    const jumlah = Number(patunganJumlah);
    if (!patunganWarga || isNaN(jumlah) || jumlah <= 0) {
      showToast('Harap lengkapi semua isian dengan benar', 'error');
      return;
    }

    // ✅ ANTI DUPLIKAT: Cek apakah warga ini sudah punya patungan dengan keterangan sama di periode ini
    const numWargaId = Number(patunganWarga);
    const ketPatungan = patunganKet.trim();
    const sudahAdaPatungan = state.pembayaran.find(p =>
      p.warga_id === numWargaId &&
      p.bulan === b &&
      p.tahun === t &&
      p.keterangan && p.keterangan.includes('[PATUNGAN]') &&
      p.keterangan.includes(ketPatungan)
    );

    if (sudahAdaPatungan) {
      const w = state.warga.find(x => String(x.id) === String(patunganWarga));
      const dupMsg = `⚠️ DUPLIKAT DITOLAK: Patungan ${w ? w.nama : 'Warga'} sebesar ${fmtRp(jumlah)} untuk "${ketPatungan}" di ${MONTHS[b]} ${t} — sudah tercatat sebelumnya.`;
      showToast(dupMsg, 'error');

      // Catat penolakan di Audit Log agar admin bisa melacak
      executeWrite({
        table: 'audit',
        action: 'insert',
        data: { aksi: 'BLOCKED', detail: dupMsg, created_at: new Date().toISOString() },
        logMsg: dupMsg
      });
      return;
    }

    setIsSaving(true);
    try {
      // Abaikan tanggal real-time untuk penentuan periode, gunakan filter UI
      const pBln = b;
      const pThn = t;

      // 1. Get or create dummy meteran for SISTEM
      const dummyW = state.warga.find(w => w.alamat === 'SISTEM');
      if (!dummyW) {
        showToast('Warga SISTEM tidak ditemukan. Harap jalankan inisialisasi.', 'error');
        return;
      }

      let dummyMeter = state.meteran.find(m => m.warga_id === dummyW.id && m.bulan === pBln && m.tahun === pThn);
      let meterId = dummyMeter ? dummyMeter.id : null;

      if (!meterId) {
        meterId = crypto.randomUUID();
        const newDummyMeter = {
          id: meterId,
          warga_id: dummyW.id,
          bulan: pBln,
          tahun: pThn,
          meter_lalu: 0,
          meter_sekarang: 0,
          pemakaian: 0,
          tarif_per_m3: 0,
          biaya_admin: 0,
          total_tagihan: 0
        };
        const realMeterId = await executeWrite({
          table: 'meteran',
          action: 'insert',
          data: newDummyMeter,
          logMsg: `Membuat record meteran dummy SISTEM untuk patungan periode ${MONTHS[pBln]} ${pThn}`
        });
        if (realMeterId) meterId = realMeterId;
      }

      // 2. Insert Payment record with [PATUNGAN]
      const payId = crypto.randomUUID();
      const payRecord = {
        id: payId,
        meteran_id: meterId,
        warga_id: numWargaId,
        bulan: pBln,
        tahun: pThn,
        jumlah_bayar: jumlah,
        metode: patunganMetode,
        no_bukti: patunganNoBukti.trim() || null,
        keterangan: `[PATUNGAN] ${ketPatungan}`,
        tanggal_bayar: new Date(patunganTgl + 'T10:00:00.000Z').toISOString()
      };

      const w = state.warga.find(x => String(x.id) === String(patunganWarga));

      await executeWrite({
        table: 'pembayaran',
        action: 'insert',
        data: payRecord,
        logMsg: `Mencatat patungan warga dari ${w ? w.nama : '-'} sebesar ${fmtRp(jumlah)}: ${ketPatungan}`
      });

      setActiveModal(null);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Kas Lain Modal opening
  const handleOpenKasLain = () => {
    const dummyW = state.warga.find(w => w.alamat === 'SISTEM');
    setKasLainWarga(dummyW ? dummyW.id : '');
    setKasLainKet('');
    setKasLainJumlah('');
    setKasLainTgl(new Date().toISOString().split('T')[0]);
    setKasLainMetode('Tunai');
    setKasLainNoBukti('');
    setActiveModal('kas_lain');
  };

  const handleSaveKasLain = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    const jumlah = Number(kasLainJumlah);
    if (!kasLainWarga || !kasLainKet.trim() || isNaN(jumlah) || jumlah <= 0) {
      showToast('Harap lengkapi semua isian dengan benar', 'error');
      return;
    }

    setIsSaving(true);
    try {
      // Abaikan tanggal real-time untuk penentuan periode, gunakan filter UI
      const kBln = b;
      const kThn = t;

      const dummyW = state.warga.find(w => w.alamat === 'SISTEM');
      if (!dummyW) {
        showToast('Warga SISTEM tidak ditemukan.', 'error');
        return;
      }

      let dummyMeter = state.meteran.find(m => m.warga_id === dummyW.id && m.bulan === kBln && m.tahun === kThn);
      let meterId = dummyMeter ? dummyMeter.id : null;

      if (!meterId) {
        meterId = crypto.randomUUID();
        const newDummyMeter = {
          id: meterId,
          warga_id: dummyW.id,
          bulan: kBln,
          tahun: kThn,
          meter_lalu: 0,
          meter_sekarang: 0,
          pemakaian: 0,
          tarif_per_m3: 0,
          biaya_admin: 0,
          total_tagihan: 0
        };
        const realMeterId = await executeWrite({
          table: 'meteran',
          action: 'insert',
          data: newDummyMeter,
          logMsg: `Membuat record meteran dummy SISTEM untuk kas lain periode ${MONTHS[kBln]} ${kThn}`
        });
        if (realMeterId) meterId = realMeterId;
      }

      // 2. Insert Payment record
      const numWargaId = Number(kasLainWarga);
      const payId = crypto.randomUUID();
      const payRecord = {
        id: payId,
        meteran_id: meterId,
        warga_id: numWargaId,
        bulan: kBln,
        tahun: kThn,
        jumlah_bayar: jumlah,
        metode: kasLainMetode,
        no_bukti: kasLainNoBukti.trim() || null,
        keterangan: kasLainKet.trim(),
        tanggal_bayar: new Date(kasLainTgl + 'T10:00:00.000Z').toISOString()
      };

      const wName = state.warga.find(x => x.id === kasLainWarga)?.nama || 'Kas RT';

      await executeWrite({
        table: 'pembayaran',
        action: 'insert',
        data: payRecord,
        logMsg: `Mencatat penerimaan kas lainnya sebesar ${fmtRp(jumlah)} dari ${wName}: ${kasLainKet}`
      });

      setActiveModal(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePay = async (p) => {
    const w = state.warga.find(x => x.id === p.warga_id);
    showAlert({
      title: 'Hapus Transaksi',
      message: `Yakin ingin membatalkan & menghapus transaksi pembayaran senilai ${fmtRp(p.jumlah_bayar)} dari ${w ? w.nama : '-'}?`,
      type: 'danger',
      onConfirm: async () => {
        // If dummy meteran linked is also empty, we delete it
        const m = state.meteran.find(x => x.id === p.meteran_id);
        
        await executeWrite({
          table: 'pembayaran',
          action: 'delete',
          id: p.id,
          logMsg: `Membatalkan pembayaran ${fmtRp(p.jumlah_bayar)} dari ${w ? w.nama : '-'}`
        });

        if (m && m.pemakaian === 0 && m.tarif_per_m3 === 0 && m.biaya_admin === 0) {
          // Verify if there are other payments connected to this meteran. If not, delete it
          const otherPays = state.pembayaran.filter(x => x.meteran_id === m.id && x.id !== p.id);
          if (otherPays.length === 0) {
            await executeWrite({
              table: 'meteran',
              action: 'delete',
              id: m.id,
              logMsg: `Menghapus meteran virtual sistem linked to deleted payment`
            });
          }
        }
        showToast('Transaksi berhasil dihapus.', 'success');
      }
    });
  };

  // INDONESIAN DELIMITER CSV EXPORTER (SEMICOLON ;)
  const escapeCsv = (value) => {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
  };

  const handleExportCSV = () => {
    if (byrList.length === 0) {
      showToast('Tidak ada transaksi pembayaran untuk periode ini.', 'warning');
      return;
    }

    const rtName = state.settings?.nama_rt || 'RT / RW';
    const pengelola = state.settings?.pengelola || state.settings?.nama_pengelola || 'Nama Pengelola';
    const alamatRt = state.settings?.alamat_rt || 'Alamat RT tidak tersedia';

    let csv = `LAPORAN PEMBAYARAN AIR;${escapeCsv(rtName)};${escapeCsv(`${MONTHS[b]} ${t}`)};;;;\r\n`;
    csv += `Nama Pengelola;${escapeCsv(pengelola)};Alamat;${escapeCsv(alamatRt)};;;;\r\n`;
    csv += 'No;Tanggal Transaksi;Nama Warga;Nomor Meteran;Jumlah Diterima (Rp);Metode;Nomor Bukti;Keterangan\r\n';
    
    byrList.forEach((p, idx) => {
      const w = state.warga.find(x => x.id === p.warga_id);
      const name = w ? w.nama : 'Sistem / Umum';
      const noMet = w ? w.no_meter : '-';
      const dateStr = new Date(p.tanggal_bayar).toLocaleDateString('id-ID');
      const amount = p.jumlah_bayar.toString();
      const meth = p.metode || 'Tunai';
      const proof = p.no_bukti || '-';
      const desc = p.keterangan || '-';

      csv += `${idx + 1};${escapeCsv(dateStr)};${escapeCsv(name)};${escapeCsv(noMet)};${amount};${escapeCsv(meth)};${escapeCsv(proof)};${escapeCsv(desc)}\r\n`;
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Pembayaran_Air_${MONTHS[b]}_${t}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Ekspor CSV Semicolon berhasil diunduh.', 'success');
  };

  return (
    <div className="space-y-6">
      {/* 3 SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Piutang Tagihan</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{fmtRp(totalTagihan)}</p>
        </div>
        <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/10 shadow-sm border border-emerald-200/60 dark:border-emerald-900/30">
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-500">Pemasukan Diterima</p>
          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">{fmtRp(totalUangMasuk)}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Belum Dibayar (Tunggakan)</p>
          <p className={`text-xl font-bold mt-1 ${totalTunggakan > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{fmtRp(totalTunggakan)}</p>
        </div>
      </div>

      {/* FILTER & ACTIONS BAR */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
        <div className="flex items-center gap-3">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="px-3 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            {MONTHS.map((m, idx) => idx > 0 && <option key={idx} value={idx}>{m} (15 {idx === 1 ? 'Des' : MONTHS[idx-1]} - 14 {m})</option>)}
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
              onClick={handleOpenPatungan}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 shadow-md shadow-amber-600/25 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <DollarSign size={14} />
              Catat Patungan Warga
            </button>
            <button
              onClick={handleOpenKasLain}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-slate-700 hover:bg-slate-600 shadow-md active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Plus size={14} />
              Pemasukan Kas Lain
            </button>
            {mtrBln.length > 0 && (
              <button
                onClick={handleOpenBayar}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-500 shadow-md shadow-teal-600/25 active:scale-95 transition-all flex items-center gap-1.5"
              >
                <Plus size={14} />
                Terima Bayar
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 rounded-xl border border-amber-200/40 dark:border-amber-900/30">
            <Lock size={14} />
            Buka Kunci Admin untuk melakukan penerimaan kas
          </div>
        )}
      </div>

      {/* REKAP STATUS PEMBAYARAN TABLE */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Rekapitulasi Pembayaran Air — {MONTHS[b]} {t}</h3>
        </div>
        <div className="overflow-x-auto">
          {rekap.length === 0 ? (
            <div className="p-12 text-center text-slate-400 dark:text-slate-500 font-medium">
              Belum ada data tagihan periode ini. Silakan catat meteran terlebih dahulu.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-700/60">
                  <th className="p-3.5 sticky top-0 left-0 z-30 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700">Warga</th>
                  <th className="p-3.5 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800">No. Meter</th>
                  <th className="p-3.5 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 text-right">Tagihan</th>
                  <th className="p-3.5 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 text-right">Sudah Bayar</th>
                  <th className="p-3.5 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 text-right">Kekurangan / Deposit</th>
                  <th className="p-3.5 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 text-center">Status</th>
                  <th className="p-3.5 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800">Riwayat Bayar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                {rekap.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 text-slate-700 dark:text-slate-300">
                    <td className="p-3.5 font-bold text-slate-900 dark:text-slate-100 sticky left-0 z-10 bg-white dark:bg-slate-800 border-r border-slate-100 dark:border-slate-700/40">{r.nama}</td>
                    <td className="p-3.5"><code className="font-mono text-cyan-600 dark:text-cyan-400 font-bold">{r.noMeter}</code></td>
                    <td className="p-3.5 text-right font-semibold">{fmtRp(r.tagihan)}</td>
                    <td className="p-3.5 text-right text-emerald-600 dark:text-emerald-400 font-bold">{fmtRp(r.sudah)}</td>
                    <td className={`p-3.5 text-right font-bold ${r.sisa > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {r.sisa < 0 ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 font-bold">
                          + Deposit {fmtRp(Math.abs(r.sisa))}
                        </span>
                      ) : (
                        fmtRp(r.sisa)
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        r.sisa < 0 ? 'bg-teal-100 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400' :
                        r.status === 'Lunas' ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400' :
                        r.status === 'Sebagian' ? 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400' :
                        'bg-rose-100 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400'
                      }`}>
                        {r.sisa < 0 ? 'Lunas (Lebih)' : r.status}
                      </span>
                    </td>
                    <td className="p-3.5 max-w-[200px] truncate">
                      {r.bayars.length > 0 ? (
                        <div className="space-y-0.5">
                          {r.bayars.map(byr => (
                            <div key={byr.id} className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                              {fmtDate(byr.tanggal_bayar)}: <strong>{fmtRp(byr.jumlah_bayar)}</strong> ({byr.metode})
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* TRANSACTION HISTORI LOG */}
      {byrList.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Histori Transaksi Pembayaran</h3>
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1"
            >
              <Download size={14} />
              Ekspor CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-700/60">
                  <th className="p-3.5 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800">Tanggal</th>
                  <th className="p-3.5 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800">Warga</th>
                  <th className="p-3.5 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 text-right">Jumlah Masuk</th>
                  <th className="p-3.5 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 text-center">Metode</th>
                  <th className="p-3.5 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 text-center">Kwitansi</th>
                  <th className="p-3.5 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800">Keterangan</th>
                  {isAdminUnlocked && <th className="p-3.5 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                {byrList.map(p => {
                  const w = state.warga.find(x => x.id === p.warga_id);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 text-slate-700 dark:text-slate-300">
                      <td className="p-3.5 font-mono">{fmtDateTime(p.tanggal_bayar)}</td>
                      <td className="p-3.5 font-semibold">{w ? w.nama : <span className="text-slate-400 italic">Umum / Sistem</span>}</td>
                      <td className="p-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400">{fmtRp(p.jumlah_bayar)}</td>
                      <td className="p-3.5 text-center">{p.metode}</td>
                      <td className="p-3.5 text-center font-mono">{p.no_bukti || '-'}</td>
                      <td className="p-3.5 text-slate-500 dark:text-slate-400 max-w-[200px] truncate">{p.keterangan || '-'}</td>
                      {isAdminUnlocked && (
                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => handleDeletePay(p)}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TERIMA BAYAR MODAL */}
      {activeModal === 'bayar' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <form onSubmit={handleSaveBayar} className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Terima Pembayaran Air</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Pilih Nama Warga & Sisa Tunggakan</label>
                <select
                  value={payMeterId}
                  onChange={(e) => handlePayMeterIdChange(e.target.value)}
                  className="px-3 py-2 w-full rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                >
                  {outstanding.map(o => (
                    <option key={o.id} value={o.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                      {o.nama} — {o.noMeter} (Sisa: {fmtRp(o.sisa)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Tanggal Bayar</label>
                  <input
                    type="date"
                    required
                    value={payTgl}
                    onChange={(e) => setPayTgl(e.target.value)}
                    className="px-3 py-2 w-full rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Jumlah Uang Diterima (Rp)</label>
                  <input
                    type="number"
                    required
                    value={payJumlah}
                    onChange={(e) => setPayJumlah(e.target.value)}
                    className="px-3 py-2 w-full rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Metode</label>
                  <select
                    value={payMetode}
                    onChange={(e) => setPayMetode(e.target.value)}
                    className="px-3 py-2 w-full rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                  >
                    <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Tunai</option>
                    <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Transfer</option>
                    <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">QRIS</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">No. Bukti Kwitansi (Opsional)</label>
                  <input
                    type="text"
                    value={payBukti}
                    onChange={(e) => setPayBukti(e.target.value)}
                    placeholder="Contoh: KW-01"
                    className="px-3 py-2 w-full rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Keterangan / Memo (Opsional)</label>
                <input
                  type="text"
                  value={payKet}
                  onChange={(e) => setPayKet(e.target.value)}
                  placeholder="Contoh: Cicilan i iuran air"
                  className="px-3 py-2 w-full rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className={`px-5 py-2 rounded-xl text-sm font-semibold text-white shadow-md transition-all ${isSaving ? 'bg-slate-400 cursor-not-allowed' : 'bg-teal-600 hover:bg-teal-500 active:scale-95'}`}
              >
                {isSaving ? '⏳ Menyimpan...' : 'Simpan Transaksi'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CATAT PATUNGAN MODAL */}
      {activeModal === 'patungan' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <form onSubmit={handleSavePatungan} className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Catat Iuran Patungan Warga</h3>
            
            <div className="p-3 rounded-xl border border-amber-200/50 dark:border-amber-900/20 bg-amber-50/40 dark:bg-amber-950/10 text-amber-800 dark:text-amber-400 text-xs">
              Mencatat iuran patungan warga untuk perbaikan pompa air. Dana patungan ini akan terakumulasi secara terpisah dari tagihan meteran.
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Tanggal Setor</label>
                <input
                  type="date"
                  required
                  value={patunganTgl}
                  onChange={(e) => setPatunganTgl(e.target.value)}
                  className="px-3 py-2 w-full rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Nama Warga Pembayar</label>
                <select
                  required
                  value={patunganWarga}
                  onChange={(e) => setPatunganWarga(e.target.value)}
                  className="px-3 py-2 w-full rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                >
                  <option value="" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">-- Pilih Warga --</option>
                  {state.warga.filter(w => w.aktif && w.alamat !== 'SISTEM').map(w => (
                    <option key={w.id} value={w.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">{w.nama} ({w.no_meter})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Nominal Patungan (Rp)</label>
                <input
                  type="number"
                  required
                  value={patunganJumlah}
                  onChange={(e) => setPatunganJumlah(e.target.value)}
                  className="px-3 py-2 w-full rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Keperluan / Keterangan Patungan</label>
                <input
                  type="text"
                  required
                  value={patunganKet}
                  onChange={(e) => setPatunganKet(e.target.value)}
                  className="px-3 py-2 w-full rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Metode Pembayaran</label>
                  <select
                    value={patunganMetode}
                    onChange={(e) => setPatunganMetode(e.target.value)}
                    className="px-3 py-2 w-full rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                  >
                    <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Tunai</option>
                    <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Nomor Bukti (Opsional)</label>
                  <input
                    type="text"
                    value={patunganNoBukti}
                    onChange={(e) => setPatunganNoBukti(e.target.value)}
                    placeholder="Contoh: KW-PAT01"
                    className="px-3 py-2 w-full rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className={`px-5 py-2 rounded-xl text-sm font-semibold text-white shadow-md transition-all ${isSaving ? 'bg-slate-400 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-500 active:scale-95'}`}
              >
                {isSaving ? '⏳ Menyimpan...' : 'Simpan Patungan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* KAS LAIN MODAL */}
      {activeModal === 'kas_lain' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <form onSubmit={handleSaveKasLain} className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Pemasukan Kas Lainnya (Non-Air)</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Tanggal Penerimaan</label>
                <input
                  type="date"
                  required
                  value={kasLainTgl}
                  onChange={(e) => setKasLainTgl(e.target.value)}
                  className="px-3 py-2 w-full rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Pilih Warga / Sumber</label>
                <select
                  required
                  value={kasLainWarga}
                  onChange={(e) => setKasLainWarga(e.target.value)}
                  className="px-3 py-2 w-full rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                >
                  <option value="">-- Pilih --</option>
                  <option value={state.warga.find(w => w.alamat === 'SISTEM')?.id}>Kas RT (Umum)</option>
                  {state.warga.filter(w => w.alamat !== 'SISTEM').map(w => (
                    <option key={w.id} value={w.id}>{w.nama}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Keterangan / Sumber Penerimaan</label>
                <input
                  type="text"
                  required
                  value={kasLainKet}
                  onChange={(e) => setKasLainKet(e.target.value)}
                  placeholder="Contoh: Pemasangan Baru, Modal Awal Kas"
                  className="px-3 py-2 w-full rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Jumlah Masuk (Rp)</label>
                <input
                  type="number"
                  required
                  value={kasLainJumlah}
                  onChange={(e) => setKasLainJumlah(e.target.value)}
                  placeholder="Nominal Rupiah"
                  className="px-3 py-2 w-full rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Metode</label>
                  <select
                    value={kasLainMetode}
                    onChange={(e) => setKasLainMetode(e.target.value)}
                    className="px-3 py-2 w-full rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                  >
                    <option>Tunai</option>
                    <option>Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Nomor Bukti (Opsional)</label>
                  <input
                    type="text"
                    value={kasLainNoBukti}
                    onChange={(e) => setKasLainNoBukti(e.target.value)}
                    placeholder="Contoh: M-05"
                    className="px-3 py-2 w-full rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className={`px-5 py-2 rounded-xl text-sm font-semibold text-white shadow-md transition-all ${isSaving ? 'bg-slate-400 cursor-not-allowed' : 'bg-teal-600 hover:bg-teal-500 active:scale-95'}`}
              >
                {isSaving ? '⏳ Menyimpan...' : 'Simpan Penerimaan'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Pembayaran;
