import { useState } from 'react';
import { useDb } from '../store/DbContext';
import { fmtRp, fmtDate, MONTHS } from '../utils/format';
import { getCycleMonthYear, getCycleDateRange, filterByrBySiklus, filterKlrBySiklus, getWargaDeposit, getWargaTunggakanLalu } from '../utils/billing';
import { Printer, Download, MessageCircle, Image, Loader2 } from 'lucide-react';

const EMOJIS = {
  water: () => String.fromCodePoint(0x1F4A7),      // 💧
  chart: () => String.fromCodePoint(0x1F4CA),      // 📊
  moneyBag: () => String.fromCodePoint(0x1F4B0),   // 💰
  inbox: () => String.fromCodePoint(0x1F4E5),      // 📥
  outbox: () => String.fromCodePoint(0x1F4E4),     // 📤
  card: () => String.fromCodePoint(0x1F4B3),       // 💳
  users: () => String.fromCodePoint(0x1F465),      // 👥
  lunas: () => String.fromCodePoint(0x1F7E2),      // 🟢
  belumBayar: () => String.fromCodePoint(0x1F534), // 🔴
  pray: () => String.fromCodePoint(0x1F64F),       // 🙏
  calendar: () => String.fromCodePoint(0x1F4C5),   // 📅
  pin: () => String.fromCodePoint(0x1F4CC),        // 📌
  clipboard: () => String.fromCodePoint(0x1F4CB),  // 📋
  dollar: () => String.fromCodePoint(0x1F4B5),     // 💵
  wrench: () => String.fromCodePoint(0x1F527),     // 🔧
  globe: () => String.fromCodePoint(0x1F310),      // 🌐
};

const LaporanKeuangan = () => {
  const { state } = useDb();
  
  const cur = new Date();
  const cycle = getCycleMonthYear(cur);
  const [reportType, setReportType] = useState('bulanan'); // 'bulanan' | 'tahunan'
  const [selectedMonth, setSelectedMonth] = useState(cycle.month);
  const [selectedYear, setSelectedYear] = useState(cycle.year);
  const [sharingImg, setSharingImg] = useState(false);

  const b = selectedMonth;
  const t = selectedYear;

  // Target month/year for billing offset (b - 1)
  const targetB = b === 1 ? 12 : b - 1;
  const targetT = b === 1 ? t - 1 : t;

  // --- MONTHLY DATA PREPARATION (Siklus 15-15) ---
  // UI and billing summary cards are offset by 1 month (b - 1) to match the collection period
  const mtrBln = state.meteran.filter(m => m.bulan === targetB && m.tahun === targetT);
  const byrBln = state.pembayaran.filter(p => p.bulan === targetB && p.tahun === targetT);
  
  // Physical cash flow for the selected month (b)
  const byrSiklus = filterByrBySiklus(state.pembayaran, b, t);
  const klrBln = filterKlrBySiklus(state.pengeluaran, b, t);
  const cycleRange = getCycleDateRange(b, t);

  const wargaAktif = state.warga.filter(w => w.aktif && w.alamat !== 'SISTEM');
  const [captureMode, setCaptureMode] = useState(false);
  const mBlnActiveSorted = [...state.meteran.filter(m => {
    const w = state.warga.find(x => x.id === m.warga_id);
    return m.bulan === targetB && m.tahun === targetT && w && w.alamat !== 'SISTEM';
  })].sort((x, y) => {
    const wx = state.warga.find(w => w.id === x.warga_id);
    const wy = state.warga.find(w => w.id === y.warga_id);
    return (wx?.no_meter || '').localeCompare(wy?.no_meter || '');
  });

  // Calculations for Monthly Print Cards
  const tagihan = mtrBln.reduce((s, m) => {
    const w = state.warga.find(x => x.id === m.warga_id);
    if (!w || w.alamat === 'SISTEM') return s;
    if (w.adalah_pengelola) {
      const sudah = state.pembayaran.filter(p => p.meteran_id === m.id).reduce((sum, p) => sum + p.jumlah_bayar, 0);
      return s + sudah;
    }
    return s + m.total_tagihan;
  }, 0);

  const pendapatanAir = byrBln.filter(p => {
    const mt = state.meteran.find(x => x.id === p.meteran_id);
    if (!mt) return false;
    const w = state.warga.find(x => x.id === mt.warga_id);
    return w && w.alamat !== 'SISTEM';
  }).reduce((s, p) => s + p.jumlah_bayar, 0);

  const keluarAir = klrBln.filter(k => k.kategori !== 'Perbaikan Mesin (Patungan)').reduce((s, k) => s + k.jumlah, 0);
  const kasBersihMeteran = pendapatanAir - keluarAir;

  const masuk = byrSiklus.reduce((s, p) => s + p.jumlah_bayar, 0);
  const keluar = klrBln.reduce((s, k) => s + k.jumlah, 0);
  
  // All-time totals for monthly dashboard metrics
  const totalBayarAll = state.pembayaran.reduce((s, p) => s + p.jumlah_bayar, 0);
  const totalKeluarAll = state.pengeluaran.reduce((s, k) => s + k.jumlah, 0);
  const saldo = totalBayarAll - totalKeluarAll;

  const allPatungan = state.pembayaran.filter(p => p.keterangan && p.keterangan.startsWith('[PATUNGAN]'));
  const totalPatunganAll = allPatungan.reduce((s, p) => s + p.jumlah_bayar, 0);
  const allMesinExp = state.pengeluaran.filter(k => k.kategori === 'Perbaikan Mesin (Patungan)');
  const totalMesinExpAll = allMesinExp.reduce((s, k) => s + k.jumlah, 0);
  const saldoPatungan = totalPatunganAll - totalMesinExpAll;

  const sumMasukCash = masuk;
  const sumKeluarCash = keluar;
  
  // Robust cash flow calculations using cycle dates
  const { start: cycleStartStr } = getCycleDateRange(b, t);
  const prevMasuk = state.pembayaran.filter(p => {
    const tgl = (p.tanggal_bayar || '').split('T')[0];
    return tgl && tgl < cycleStartStr;
  }).reduce((s, p) => s + p.jumlah_bayar, 0);

  const prevKeluar = state.pengeluaran.filter(k => {
    const tgl = (k.tanggal || '').split('T')[0];
    return tgl && tgl < cycleStartStr;
  }).reduce((s, k) => s + k.jumlah, 0);
  
  const saldoAwalCash = prevMasuk - prevKeluar;
  const saldoAkhirCash = saldoAwalCash + sumMasukCash - sumKeluarCash;

  // --- YEARLY DATA PREPARATION ---
  // Get all months in which transactions exist for this specific year
  const activeMonths = Array.from({ length: 12 }, (_, i) => i + 1);

  const summaryData = activeMonths.map(m => {
    const mBln = state.meteran.filter(x => {
      const w = state.warga.find(wg => wg.id === x.warga_id);
      return x.bulan === m && x.tahun === t && w && w.alamat !== 'SISTEM';
    });
    // Kembalikan ke filter bulan asli
    const pBln = state.pembayaran.filter(p => p.bulan === m && p.tahun === t);
    const kBln = filterKlrBySiklus(state.pengeluaran, m, t);

    const mBlnTagihan = mBln.reduce((s, x) => {
      const w = state.warga.find(wg => wg.id === x.warga_id);
      if (w && w.adalah_pengelola) {
        const sudah = pBln.filter(p => p.meteran_id === x.id).reduce((sum, p) => sum + p.jumlah_bayar, 0);
        return s + sudah;
      }
      return s + x.total_tagihan;
    }, 0);

    const waterPayments = pBln.filter(p => {
      const mt = state.meteran.find(x => x.id === p.meteran_id);
      if (!mt) return false;
      const w = state.warga.find(wg => wg.id === mt.warga_id);
      return w && w.alamat !== 'SISTEM';
    });
    const totalBayarWater = waterPayments.reduce((s, p) => s + p.jumlah_bayar, 0);

    const allNonAirPayments = pBln.filter(p => {
      const mt = state.meteran.find(x => x.id === p.meteran_id);
      if (!mt) return true;
      const w = state.warga.find(wg => wg.id === mt.warga_id);
      return w && w.alamat === 'SISTEM';
    });

    const kasLainBln = allNonAirPayments.filter(p => !p.keterangan || !p.keterangan.startsWith('[PATUNGAN]'));
    const totalKasLain = kasLainBln.reduce((s, p) => s + p.jumlah_bayar, 0);

    const totalPemasukan = pBln.reduce((s, p) => s + p.jumlah_bayar, 0);
    const totalPengeluaran = kBln.reduce((s, k) => s + k.jumlah, 0);
    const saldoBersih = totalPemasukan - totalPengeluaran;

    const patunganBln = allNonAirPayments.filter(p => p.keterangan && p.keterangan.startsWith('[PATUNGAN]'));
    const totalPatungan = patunganBln.reduce((s, p) => s + p.jumlah_bayar, 0);

    const kPatungan = kBln.filter(k => k.kategori === 'Perbaikan Mesin (Patungan)');
    const totalKlrPatungan = kPatungan.reduce((s, k) => s + k.jumlah, 0);

    return {
      bulan: m,
      bulanNama: MONTHS[m],
      totalTagihan: mBlnTagihan,
      totalBayarWater,
      totalKasLain,
      totalPemasukan,
      totalPengeluaran,
      saldoBersih,
      totalPatungan,
      totalKlrPatungan
    };
  });

  const grandTagihan = summaryData.reduce((s, d) => s + d.totalTagihan, 0);
  const grandBayarWater = summaryData.reduce((s, d) => s + d.totalBayarWater, 0);
  const grandKasLain = summaryData.reduce((s, d) => s + d.totalKasLain, 0);
  const grandPemasukan = summaryData.reduce((s, d) => s + d.totalPemasukan, 0);
  const grandPengeluaran = summaryData.reduce((s, d) => s + d.totalPengeluaran, 0);
  const grandSaldo = grandPemasukan - grandPengeluaran;
  const grandPatungan = summaryData.reduce((s, d) => s + d.totalPatungan, 0);
  const grandPengeluaranPatungan = summaryData.reduce((s, d) => s + d.totalKlrPatungan, 0);

  // Trigger browser print
  const handlePrint = () => {
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
      document.documentElement.classList.remove('dark');
    }
    setTimeout(() => {
      window.print();
      if (isDark) {
        document.documentElement.classList.add('dark');
      }
    }, 150);
  };

  // --- CSV EXPORTERS ---
  const downloadCSV = (csvContent, filename) => {
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const escapeCsv = (value) => {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
  };

  // CSV Bulanan — Rincian transaksi per bulan
  const handleExportMonthlyCSV = () => {
    const items = [
      ...byrSiklus.map(p => ({
        tanggal: p.tanggal_bayar,
        tipe: p.keterangan && p.keterangan.startsWith('[PATUNGAN]') ? 'Patungan Warga' : 'Pemasukan Air',
        warga: state.warga.find(x => x.id === p.warga_id)?.nama || 'Sistem',
        ket: p.keterangan || 'Iuran air bersih',
        masuk: p.jumlah_bayar,
        keluar: 0
      })),
      ...klrBln.map(k => ({
        tanggal: k.tanggal,
        tipe: k.kategori === 'Perbaikan Mesin (Patungan)' ? 'Pengeluaran Patungan' : 'Pengeluaran Kas',
        warga: 'Kas Pengeluaran',
        ket: `[${k.kategori}] ${k.keterangan}`,
        masuk: 0,
        keluar: k.jumlah
      }))
    ].sort((x, y) => new Date(x.tanggal) - new Date(y.tanggal));

    if (items.length === 0) return;

    const rtName = state.settings?.nama_rt || 'RT / RW';
    const pengelola = state.settings?.pengelola || state.settings?.nama_pengelola || 'Pengelola';
    const alamatRt = state.settings?.alamat_rt || 'Alamat RT tidak tersedia';

    let csv = `LAPORAN BULANAN KEUANGAN;;;;;;\r\n`;
    csv += `RT / RW;${escapeCsv(rtName)};;;;;\r\n`;
    csv += `Periode;${escapeCsv(`${MONTHS[b]} ${t}`)};;;;;\r\n`;
    csv += `Nama Pengelola;${escapeCsv(pengelola)};;;;;\r\n`;
    csv += `Alamat;${escapeCsv(alamatRt)};;;;;\r\n`;
    csv += '\r\n';
    csv += 'No;Tanggal;Jenis Transaksi;Warga / Sumber;Keterangan;Pemasukan (Rp);Pengeluaran (Rp)\r\n';

    items.forEach((item, index) => {
      const dateStr = new Date(item.tanggal).toLocaleDateString('id-ID');
      csv += `${index + 1};${escapeCsv(dateStr)};${escapeCsv(item.tipe)};${escapeCsv(item.warga)};${escapeCsv(item.ket)};${item.masuk};${item.keluar}\r\n`;
    });

    csv += `;;;;"Total Pemasukan";${masuk};0\r\n`;
    csv += `;;;;"Total Pengeluaran";0;${keluar}\r\n`;
    csv += `;;;;"Saldo Bersih";${masuk - keluar};0\r\n`;

    // Signature lines for Ketua RT and Pengelola
    csv += '\r\n\r\n';
    csv += 'Mengetahui;;;;;;\r\n';
    csv += `Ketua RT;${rtName};;;;;\r\n`;
    csv += '\r\n';
    csv += `Pengelola;${pengelola};;;;;\r\n`;

    downloadCSV(csv, `Laporan_Bulanan_${MONTHS[b]}_${t}.csv`);
  };

  // CSV Tahunan — Rekapitulasi per bulan
  const handleExportYearlyCSV = () => {
    const rtName = state.settings?.nama_rt || 'RT / RW';
    const pengelola = state.settings?.pengelola || state.settings?.nama_pengelola || 'Pengelola';
    const alamatRt = state.settings?.alamat_rt || 'Alamat RT tidak tersedia';

    let csv = `REKAP TAHUNAN KEUANGAN;${escapeCsv(rtName)};${escapeCsv(t)};;;;;;;\r\n`;
    csv += `Nama Pengelola;${escapeCsv(pengelola)};Alamat;${escapeCsv(alamatRt)};;;;;;\r\n`;
    csv += 'No;Bulan;Tagihan Air (Rp);Pendapatan Air (Rp);Kas Lain (Rp);Total Pemasukan (Rp);Pengeluaran Kas (Rp);Saldo Bersih (Rp);Iuran Patungan (Rp);Pengeluaran Patungan (Rp)\r\n';

    summaryData.forEach((d, index) => {
      csv += `${index + 1};"${d.bulanNama}";${d.totalTagihan};${d.totalBayarWater};${d.totalKasLain};${d.totalPemasukan};${d.totalPengeluaran};${d.saldoBersih};${d.totalPatungan};${d.totalKlrPatungan}\r\n`;
    });

    csv += `"TOTAL JALUR";${grandTagihan};${grandBayarWater};${grandKasLain};${grandPemasukan};${grandPengeluaran};${grandSaldo};${grandPatungan};${grandPengeluaranPatungan}\r\n`;

    // Signature lines for Ketua RT and Pengelola (yearly)
    csv += '\r\n\r\n';
    csv += 'Mengetahui;;;;;;;;;\r\n';
    csv += `Ketua RT;${rtName};;;;;;;;\r\n`;
    csv += `Pengelola;${pengelola};;;;;;;;\r\n`;

    downloadCSV(csv, `Rekapitulasi_Tahunan_Kas_Air_${t}.csv`);
  };

  // --- WHATSAPP SHARE ---
  const openWhatsApp = (text) => {
    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  // Share WA Bulanan
  const handleShareWABulanan = () => {
    const rtName = state.settings?.nama_rt || 'RT 01 / RW 03';
    const pengelola = state.settings?.pengelola || 'Slamet Susanto';
    const alamatRt = state.settings?.alamat_rt || 'Jln.sekar jaya';

    const cleanBawaan = (saldoAwalCash < 0 ? '-' : '') + fmtRp(Math.abs(saldoAwalCash)).replace('Rp', '').trim();
    const cleanPemasukan = fmtRp(sumMasukCash).replace('Rp', '').trim();
    const cleanPengeluaran = fmtRp(sumKeluarCash).replace('Rp', '').trim();
    const cleanAkhir = (saldoAkhirCash < 0 ? '-' : '') + fmtRp(Math.abs(saldoAkhirCash)).replace('Rp', '').trim();

    const lines = [
      `*💧 LAPORAN KEUANGAN KAS AIR ${rtName.toUpperCase()} 💧*`,
      `*Periode: ${MONTHS[b].toUpperCase()} ${t}*`,
      `_${alamatRt}_`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `📊 *RINCIAN SALDO KAS RT*`,
      `\`\`\``,
      `Saldo Bawaan : Rp ${cleanBawaan}`,
      `Pemasukan    : Rp ${cleanPemasukan}`,
      `Pengeluaran  : Rp ${cleanPengeluaran}`,
      `--------------------------`,
      `Saldo Akhir  : Rp ${cleanAkhir}`,
      `\`\`\``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
    ];

    // Get active residents list sorted by no_urut
    const wargaActiveSorted = state.warga
      .filter(w => w.aktif && w.alamat !== 'SISTEM')
      .sort((a, b) => (a.no_urut || 999) - (b.no_urut || 999));

    const lunasList = [];
    const belumList = [];

    wargaActiveSorted.forEach(w => {
      const m = mtrBln.find(x => x.warga_id === w.id);
      const tagihanVal = w.adalah_pengelola ? 0 : (m ? m.total_tagihan : 0);
      const bayarVal = m ? byrBln.filter(p => p.meteran_id === m.id).reduce((s, p) => s + p.jumlah_bayar, 0) : 0;
      const dep = getWargaDeposit(w.id, targetB, targetT, state);
      const tunggakanLalu = getWargaTunggakanLalu(w.id, targetB, targetT, state);
      
      const kewajiban = tagihanVal + tunggakanLalu;
      const sisa = kewajiban - bayarVal - dep;

      if (w.adalah_pengelola) {
        lunasList.push(`${w.nama} (Pengelola)`);
      } else if (sisa <= 0) {
        if (sisa < 0) {
          const cleanLebih = fmtRp(Math.abs(sisa)).replace('Rp', '').trim();
          lunasList.push(`${w.nama} (Lebih Rp ${cleanLebih})`);
        } else {
          lunasList.push(w.nama);
        }
      } else {
        const cleanSisa = fmtRp(sisa).replace('Rp', '').trim();
        belumList.push(`${w.nama} (Sisa Rp ${cleanSisa})`);
      }
    });

    lines.push(`✅ *SUDAH LUNAS / BAYAR:*`);
    if (lunasList.length > 0) {
      lunasList.forEach((item, index) => {
        lines.push(`${index + 1}. ${item}`);
      });
    } else {
      lines.push(`-`);
    }

    lines.push(``);
    lines.push(`❌ *BELUM LUNAS:*`);
    if (belumList.length > 0) {
      belumList.forEach((item, index) => {
        lines.push(`${index + 1}. ${item}`);
      });
    } else {
      lines.push(`-`);
    }
    lines.push(``);

    // Patungan detail
    const patunganBulanIni = byrBln.filter(p => p.keterangan && p.keterangan.startsWith('[PATUNGAN]'));
    if (patunganBulanIni.length > 0) {
      // Find unique patungan descriptions
      const uniqueProjects = Array.from(new Set(patunganBulanIni.map(p => p.keterangan)));
      
      uniqueProjects.forEach(proj => {
        const cleanProjName = proj.replace('[PATUNGAN] ', '').trim();
        lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        lines.push(`💰 *PATUNGAN: ${cleanProjName.toUpperCase()}*`);
        lines.push(``);
        
        const paymentsForProj = patunganBulanIni.filter(p => p.keterangan === proj);
        const paidWargaIds = paymentsForProj.map(p => p.warga_id);
        
        const sudahPatungan = state.warga
          .filter(w => w.aktif && w.alamat !== 'SISTEM' && paidWargaIds.includes(w.id))
          .sort((a, b) => (a.no_urut || 999) - (b.no_urut || 999));
          
        const belumPatungan = state.warga
          .filter(w => w.aktif && w.alamat !== 'SISTEM' && !w.adalah_pengelola && !paidWargaIds.includes(w.id))
          .sort((a, b) => (a.no_urut || 999) - (b.no_urut || 999));
          
        lines.push(`✅ *SUDAH BAYAR PATUNGAN:*`);
        if (sudahPatungan.length > 0) {
          sudahPatungan.forEach((w, index) => {
            const pay = paymentsForProj.find(p => p.warga_id === w.id);
            const amountStr = pay ? ` (Rp ${fmtRp(pay.jumlah_bayar).replace('Rp', '').trim()})` : '';
            lines.push(`${index + 1}. ${w.nama}${amountStr}`);
          });
        } else {
          lines.push(`-`);
        }
        
        lines.push(``);
        lines.push(`❌ *BELUM BAYAR PATUNGAN:*`);
        if (belumPatungan.length > 0) {
          belumPatungan.forEach((w, index) => {
            lines.push(`${index + 1}. ${w.nama}`);
          });
        } else {
          lines.push(`-`);
        }
        lines.push(``);
      });
    }

    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`🙏 _Laporan dibuat secara transparan untuk kenyamanan bersama seluruh warga._`);
    lines.push(``);
    lines.push(`_Pengelola Kas Air: *${pengelola}*_`);

    openWhatsApp(lines.join('\n'));
  };

  // Share WA Tahunan
  const handleShareWATahunan = () => {
    const rtName = state.settings?.nama_rt || 'RT 01 / RW 03';
    const activeData = summaryData.filter(d => d.totalPemasukan > 0 || d.totalPengeluaran > 0);

    const lines = [
      `${EMOJIS.chart()} *REKAPITULASI LAPORAN TAHUNAN*`,
      `${EMOJIS.water()} Kas Air ${rtName}`,
      `${EMOJIS.calendar()} Tahun Buku: *${t}*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
    ];

    // Per-bulan ringkasan (hanya bulan yang ada transaksi)
    if (activeData.length > 0) {
      activeData.forEach(d => {
        lines.push(`${EMOJIS.pin()} *${d.bulanNama}*:`);
        lines.push(`   \`Masuk ${fmtRp(d.totalPemasukan)} | Keluar ${fmtRp(d.totalPengeluaran)} ➔ Saldo ${fmtRp(d.saldoBersih)}\``);
      });
      lines.push(``);
    }

    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`${EMOJIS.clipboard()} *RINGKASAN TOTAL TAHUNAN*`);
    lines.push(`\`\`\``);
    lines.push(`Tagihan Air  : ${fmtRp(grandTagihan)}`);
    lines.push(`Pemasukan    : ${fmtRp(grandPemasukan)}`);
    lines.push(`Pengeluaran  : ${fmtRp(grandPengeluaran)}`);
    lines.push(`Saldo Bersih : ${fmtRp(grandSaldo)}`);
    lines.push(`Patungan In  : ${fmtRp(grandPatungan)}`);
    lines.push(`Patungan Out : ${fmtRp(grandPengeluaranPatungan)}`);
    lines.push(`\`\`\``);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(``);
    lines.push(`${EMOJIS.globe()} Detail lengkap: https://airkas-rt.vercel.app`);
    lines.push(`_Dikirim otomatis oleh AirKas RT_`);

    openWhatsApp(lines.join('\n'));
  };

  // Share WA as high-resolution PNG with optional summary capture
  const handleShareImage = async () => {
    // Activate temporary summary capture view
    setCaptureMode(true);
    // Wait for DOM update
    await new Promise((res) => setTimeout(res, 200));
    const captureId = 'share-summary-capture';
    const el = document.getElementById(captureId);
    if (!el) {
      setCaptureMode(false);
      return;
    }

    setSharingImg(true);
    try {
      const html2canvas = (await import('html2canvas-pro')).default;
      const canvas = await html2canvas(el, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#f8fafc',
        logging: false,
        onclone: (clonedDoc) => {
          // Ensure tables are fully expanded
          const tables = clonedDoc.querySelectorAll('table');
          tables.forEach(t => t.style.overflow = 'visible');
        },
      });

      // Generate caption text (same as before)
      let captionText = '';
      const rtName = state.settings?.nama_rt || 'RT 01 / RW 03';
      if (reportType === 'bulanan') {
        const cleanTagihan = fmtRp(tagihan).replace('Rp', '').trim();
        const cleanPemasukan = fmtRp(pendapatanAir).replace('Rp', '').trim();
        const cleanPengeluaran = fmtRp(keluarAir).replace('Rp', '').trim();
        const cleanSaldo = fmtRp(kasBersihMeteran).replace('Rp', '').trim();
        captionText = [
          `*${EMOJIS.water()} LAPORAN KEUANGAN KAS AIR ${rtName} ${EMOJIS.water()}*`,
          `*Periode: ${MONTHS[b].toUpperCase()} ${t}*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `📊 *RINGKASAN KAS BULAN INI*`,
          `• Total Tagihan : Rp ${cleanTagihan}`,
          `• Pemasukan     : Rp ${cleanPemasukan}`,
          `• Pengeluaran   : Rp ${cleanPengeluaran}`,
          `• Saldo Bersih  : *Rp ${cleanSaldo}*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `Detail lebih lengkap dapat dilihat pada gambar di atas.`,
          `🌐 Detail: https://airkas-rt.vercel.app`,
        ].join('\n');
      } else {
        captionText = [
          `*${EMOJIS.chart()} REKAPITULASI LAPORAN KEUANGAN TAHUNAN*`,
          `*Kas Air ${rtName} - Tahun Buku ${t}*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `📊 *RINGKASAN TAHUNAN*`,
          `• Tagihan Air  : ${fmtRp(grandTagihan)}`,
          `• Pemasukan    : ${fmtRp(grandPemasukan)}`,
          `• Pengeluaran  : ${fmtRp(grandPengeluaran)}`,
          `• Saldo Bersih : *${fmtRp(grandSaldo)}*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `Detail lengkap dapat dilihat pada gambar di atas.`,
          `🌐 Detail: https://airkas-rt.vercel.app`,
        ].join('\n');
      }

      canvas.toBlob(async (blob) => {
        if (!blob) throw new Error('Gagal menghasilkan file gambar.');
        const fileName = `Laporan_${reportType === 'bulanan' ? MONTHS[b] : 'Tahunan'}_${t}.png`;
        const file = new File([blob], fileName, { type: 'image/png' });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: `Laporan Kas Air`, text: captionText });
          } catch (shareErr) {
            fallbackImageAction(blob, fileName);
          }
        } else {
          fallbackImageAction(blob, fileName);
        }
      }, 'image/png');
    } catch (err) {
      console.error(err);
      alert('Gagal memproses gambar: ' + err.message);
    } finally {
      setSharingImg(false);
      setCaptureMode(false);
    }
  };

  const fallbackImageAction = async (blob, fileName) => {
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const item = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
        alert('Gambar Laporan berhasil disalin ke Clipboard!\n\nSilakan buka chat WhatsApp dan tekan Ctrl+V (Paste) untuk mengirim.');
      } else {
        throw new Error('ClipboardItem not supported');
      }
    } catch (clipErr) {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
      alert('Gambar Laporan otomatis diunduh!\n\nSilakan bagikan file gambar yang terunduh tersebut ke WhatsApp warga.');
    }
  };

  return (
    <div className="space-y-6">
      {/* SELECTION TABS & PERIODS */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50 no-print space-y-3">
        {/* Row 1: Tabs + Period Selectors */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-slate-900/60 rounded-xl">
            <button
              onClick={() => setReportType('bulanan')}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                reportType === 'bulanan' 
                  ? 'bg-teal-600 text-white shadow-sm' 
                  : 'text-slate-600 dark:text-slate-350 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
              }`}
            >
              Bulanan
            </button>
            <button
              onClick={() => setReportType('tahunan')}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                reportType === 'tahunan' 
                  ? 'bg-teal-600 text-white shadow-sm' 
                  : 'text-slate-600 dark:text-slate-350 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
              }`}
            >
              Tahunan
            </button>
          </div>

          <div className="flex items-center gap-2">
            {reportType === 'bulanan' && (
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-2 py-1.5 rounded-lg text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                {MONTHS.map((m, idx) => idx > 0 && <option key={idx} value={idx}>{m} (15 {idx === 1 ? 'Des' : MONTHS[idx-1]} - 14 {m})</option>)}
              </select>
            )}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-2 py-1.5 rounded-lg text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none"
            >
              {[2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* Row 2: Action Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            onClick={handlePrint}
            className="py-2 px-2 rounded-xl text-[11px] font-bold text-white bg-teal-600 hover:bg-teal-500 shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1.5"
          >
            <Printer size={13} />
            Cetak PDF
          </button>

          <button
            onClick={reportType === 'bulanan' ? handleExportMonthlyCSV : handleExportYearlyCSV}
            className="py-2 px-2 rounded-xl text-[11px] font-bold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5"
          >
            <Download size={13} />
            Unduh CSV
          </button>

          <button
            onClick={reportType === 'bulanan' ? handleShareWABulanan : handleShareWATahunan}
            className="py-2 px-2 rounded-xl text-[11px] font-bold text-white bg-green-600 hover:bg-green-500 shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1.5"
          >
            <MessageCircle size={13} />
            Share Teks
          </button>

          <button
            onClick={handleShareImage}
            disabled={sharingImg}
            className="py-2 px-2 rounded-xl text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-75 disabled:pointer-events-none"
          >
            {sharingImg ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Image size={13} />
            )}
            {sharingImg ? 'Memproses...' : 'Bagi Gambar'}
          </button>
        </div>
      </div>

      {/* --- BULANAN SCREEN VIEW --- */}
      {reportType === 'bulanan' && (
        <div id="report-bulanan-capture" className="space-y-6 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-3xl border border-slate-200/50 dark:border-slate-700/50 print:p-0 print:bg-transparent print:border-none">
          {/* PRINT HEADER FOR BULANAN */}
          <div className="print-header text-center py-6 border-b-4 double border-slate-900/60">
            <h2 className="text-xl font-bold text-slate-900 uppercase">Laporan Keuangan Bulanan Air Bersih</h2>
            <h3 className="text-md font-bold text-teal-800 uppercase mt-1">{state.settings?.nama_rt || 'KAS AIR RT / RW'}</h3>
            <p className="text-xs text-slate-600 mt-0.5">Periode: {MONTHS[b]} {t} (Siklus {cycleRange.start.split('-').reverse().join('/')} s/d {cycleRange.end.split('-').reverse().join('/')})</p>
            <p className="text-xs text-slate-600 mt-1">Pengelola: {state.settings?.pengelola || 'Nama Pengelola'}</p>
            <p className="text-xs text-slate-600 mt-0.5">Alamat: {state.settings?.alamat_rt || 'Alamat RT tidak tersedia'}</p>
          </div>

          {/* 8 CARDS GRID */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 print-card">
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Warga Aktif</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{wargaAktif.length}</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 print-card">
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Tagihan Air</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{fmtRp(tagihan)}</p>
            </div>
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 dark:bg-emerald-950/10 print-card">
              <p className="text-[10px] font-bold text-emerald-600">Pendapatan Meteran</p>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">{fmtRp(pendapatanAir)}</p>
            </div>
            <div className="p-4 rounded-xl border border-cyan-200 bg-cyan-50/20 dark:bg-cyan-950/10 print-card">
              <p className="text-[10px] font-bold text-cyan-600">Kas Bersih Meteran</p>
              <p className="text-xl font-bold text-cyan-700 dark:text-cyan-400 mt-1">{fmtRp(kasBersihMeteran)}</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 print-card">
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Total Pemasukan</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{fmtRp(masuk)}</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 print-card">
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Pengeluaran Kas RT</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{fmtRp(keluar)}</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 print-card">
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Saldo Kas RT</p>
              <p className={`text-xl font-bold mt-1 ${saldo >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{fmtRp(saldo)}</p>
            </div>
            <div className="p-4 rounded-xl border border-amber-250 bg-amber-50/20 dark:bg-amber-950/10 print-card">
              <p className="text-[10px] font-bold text-amber-600">Kas Patungan</p>
              <p className="text-xl font-bold text-amber-700 dark:text-amber-400 mt-1">{fmtRp(saldoPatungan)}</p>
            </div>
          </div>

          {/* Hidden summary capture for image sharing */}
          {captureMode && (
            <div id="share-summary-capture" className="fixed inset-0 bg-white dark:bg-slate-800 z-50 p-6 overflow-auto">
              {/* Header */}
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">LAPORAN KEUANGAN KAS AIR {state.settings?.nama_rt || 'RT 01 / RW'}</h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">Periode: {reportType === 'bulanan' ? `${MONTHS[b]} ${t}` : `Tahun ${t}`}</p>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 rounded-xl border bg-white dark:bg-slate-800 text-center shadow-sm">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Total Pemasukan</p>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{fmtRp(sumMasukCash)}</p>
                </div>
                <div className="p-4 rounded-xl border bg-white dark:bg-slate-800 text-center shadow-sm">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Pengeluaran Kas RT</p>
                  <p className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">{fmtRp(sumKeluarCash)}</p>
                </div>
                <div className="p-4 rounded-xl border bg-white dark:bg-slate-800 text-center shadow-sm">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Saldo Kas RT</p>
                  <p className={`text-xl font-bold mt-1 ${saldoAkhirCash >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{fmtRp(saldoAkhirCash)}</p>
                </div>
                <div className="p-4 rounded-xl border bg-amber-50 dark:bg-amber-950/10 text-center shadow-sm">
                  <p className="text-xs font-bold text-amber-600">Kas Patungan</p>
                  <p className="text-xl font-bold text-amber-700 dark:text-amber-400 mt-1">{fmtRp(saldoPatungan)}</p>
                </div>
              </div>

              {/* ENRICHED CONTENT: Payment Pills and Math Proof */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Math Proof */}
                <div className="border border-slate-300 dark:border-slate-600 rounded-xl p-4 bg-slate-50 dark:bg-slate-800/50 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-3 text-center border-b pb-2">Rincian Perhitungan Matematis Saldo Akhir</h3>
                  <div className="space-y-1.5 text-xs font-mono text-slate-700 dark:text-slate-300">
                    <div className="flex justify-between">
                      <span>Saldo Bawaan (Awal)</span>
                      <span>{fmtRp(saldoAwalCash)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                      <span>Total Pemasukan</span>
                      <span>+ {fmtRp(sumMasukCash)}</span>
                    </div>
                    <div className="flex justify-between text-rose-600 dark:text-rose-400">
                      <span>Total Pengeluaran</span>
                      <span>- {fmtRp(sumKeluarCash)}</span>
                    </div>
                    <div className="border-t border-slate-400 dark:border-slate-500 mt-2 pt-2 flex justify-between font-bold text-sm">
                      <span>Saldo Akhir Kas RT</span>
                      <span className={saldoAkhirCash < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>
                        = {fmtRp(saldoAkhirCash)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Pembayaran Warga */}
                <div className="border border-slate-300 dark:border-slate-600 rounded-xl p-4 bg-slate-50 dark:bg-slate-800/50 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-3 text-center border-b pb-2">Ringkasan Pembayaran Warga</h3>
                  {(() => {
                    let countLunas = 0, countBelum = 0;
                    let totalTunggakan = 0, totalDepositAll = 0;
                    state.warga.filter(w => w.aktif && w.alamat !== 'SISTEM').forEach(w => {
                      const m = mtrBln.find(x => x.warga_id === w.id);
                      const tagihanVal = w.adalah_pengelola ? 0 : (m ? m.total_tagihan : 0);
                      const bayarVal = m ? byrBln.filter(p => p.meteran_id === m.id).reduce((s, p) => s + p.jumlah_bayar, 0) : 0;
                      const depMasuk = getWargaDeposit(w.id, targetB, targetT, state);
                      const tunggakanLalu = getWargaTunggakanLalu(w.id, targetB, targetT, state);
                      const kewajiban = tagihanVal + tunggakanLalu;
                      const sisa = kewajiban - bayarVal - depMasuk;
                      
                      totalDepositAll += getWargaDeposit(w.id, b, t, state);
                      totalTunggakan += tunggakanLalu;
                      
                      if (w.adalah_pengelola || sisa <= 0) countLunas++;
                      else countBelum++;
                    });
                    return (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">🟢 Sudah Lunas / Lebih Bayar</span>
                          <span className="font-bold bg-emerald-100 dark:bg-emerald-900 px-2 py-0.5 rounded text-emerald-800 dark:text-emerald-100">{countLunas} Warga</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-rose-700 dark:text-rose-400">🔴 Belum Lunas / Kurang Bayar</span>
                          <span className="font-bold bg-rose-100 dark:bg-rose-900 px-2 py-0.5 rounded text-rose-800 dark:text-rose-100">{countBelum} Warga</span>
                        </div>
                        <div className="mt-3 pt-3 border-t border-slate-300 dark:border-slate-600 text-xs text-slate-600 dark:text-slate-400">
                          Total Kas Tunggakan: <span className="font-bold text-slate-800 dark:text-slate-200">{fmtRp(totalTunggakan)}</span>
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">
                          Total Titipan Uang (Lebih Bayar): <span className="font-bold text-slate-800 dark:text-slate-200">{fmtRp(totalDepositAll)}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

            </div>
          )}

          <div className="rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50 p-5 space-y-4 print:overflow-visible print:border-none print:shadow-none">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <span>👥</span> Detail Tagihan & Pembayaran Warga
            </h3>

            {/* Payment Status Summary Pills */}
            {(() => {
              let countLunas = 0, countSebagian = 0, countBelum = 0, totalPemakaian = 0;
              let totalTagihanAll = 0, totalBayarAll = 0, totalTunggakan = 0, totalDepositAll = 0;
              const wargaActiveSorted = state.warga.filter(w => w.aktif && w.alamat !== 'SISTEM').sort((a, b) => (a.no_urut || 999) - (b.no_urut || 999));
              
              wargaActiveSorted.forEach(w => {
                const m = mtrBln.find(x => x.warga_id === w.id);
                const tagihanVal = w.adalah_pengelola ? 0 : (m ? m.total_tagihan : 0);
                const bayarVal = m ? byrBln.filter(p => p.meteran_id === m.id).reduce((s, p) => s + p.jumlah_bayar, 0) : 0;
                const depMasuk = getWargaDeposit(w.id, targetB, targetT, state);
                const tunggakanLalu = getWargaTunggakanLalu(w.id, targetB, targetT, state);
                const kewajiban = tagihanVal + tunggakanLalu;
                const sisa = kewajiban - bayarVal - depMasuk;
                // Deposit setelah bulan ini = deposit untuk bulan depan
                const depositSetelah = getWargaDeposit(w.id, b, t, state);
                
                totalPemakaian += (m ? (m.pemakaian_m3 || m.pemakaian || 0) : 0);
                totalTagihanAll += kewajiban;
                totalBayarAll += bayarVal;
                totalTunggakan += tunggakanLalu;
                totalDepositAll += depositSetelah;
                
                if (w.adalah_pengelola || sisa <= 0) countLunas++;
                else if (bayarVal > 0 || depMasuk > 0) countSebagian++;
                else countBelum++;
              });
              return (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                      🟢 Lunas: {countLunas} warga
                    </span>
                    <span className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
                      🟡 Sebagian: {countSebagian} warga
                    </span>
                    <span className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300">
                      🔴 Belum Bayar: {countBelum} warga
                    </span>
                    <span className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-teal-100 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300">
                      💧 Total Pemakaian: {totalPemakaian} m³
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700/40">
                      <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Total Kewajiban</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{fmtRp(totalTagihanAll)}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
                      <p className="text-[9px] font-bold text-emerald-600 uppercase">Total Terbayar</p>
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">{fmtRp(totalBayarAll)}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
                      <p className="text-[9px] font-bold text-amber-600 uppercase">Tunggakan Lalu</p>
                      <p className="text-sm font-bold text-amber-700 dark:text-amber-400 mt-0.5">{fmtRp(totalTunggakan)}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-100 dark:border-cyan-900/30">
                      <p className="text-[9px] font-bold text-cyan-600 uppercase">Total Lebih Bayar</p>
                      <p className="text-sm font-bold text-cyan-700 dark:text-cyan-400 mt-0.5">{fmtRp(totalDepositAll)}</p>
                    </div>
                  </div>
                </div>
              );
            })()}
            
            <div className="overflow-x-auto print:overflow-visible pb-2">
              <div className="min-w-[1100px] space-y-2">
                {/* Header Row */}
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

                {/* Data Rows */}
                {(() => {
                  const wargaActiveSorted = state.warga.filter(w => w.aktif && w.alamat !== 'SISTEM').sort((a, b) => (a.no_urut || 999) - (b.no_urut || 999));
                  return wargaActiveSorted.map((w, idx) => {
                    const m = mtrBln.find(x => x.warga_id === w.id);
                    const tagihanVal = w.adalah_pengelola ? 0 : (m ? m.total_tagihan : 0);
                    const bayarVal = m ? byrBln.filter(p => p.meteran_id === m.id).reduce((s, p) => s + p.jumlah_bayar, 0) : 0;
                    const depMasuk = getWargaDeposit(w.id, targetB, targetT, state);
                    const tunggakanLalu = getWargaTunggakanLalu(w.id, targetB, targetT, state);
                    const kewajiban = tagihanVal + tunggakanLalu;
                    const sisa = kewajiban - bayarVal - depMasuk;
                    const depositSetelah = getWargaDeposit(w.id, b, t, state);

                    let statusText = 'Lunas';
                    let statusColor = 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-750 dark:text-emerald-300';
                    
                    if (w.adalah_pengelola) {
                      statusText = 'Pengelola';
                    } else if (sisa <= 0) {
                      if (sisa < 0) {
                        statusText = `Lunas (+${fmtRp(Math.abs(sisa)).replace('Rp', '').trim()})`;
                      } else {
                        statusText = 'Lunas';
                      }
                    } else {
                      statusText = `Sisa ${fmtRp(sisa)}`;
                      statusColor = (bayarVal > 0 || depMasuk > 0)
                        ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-750 dark:text-amber-300'
                        : 'bg-rose-100 dark:bg-rose-950/60 text-rose-755 dark:text-rose-350';
                    }

                    return (
                      <div key={w.id} className="grid grid-cols-10 gap-1.5 text-center text-[11px] font-semibold items-center">
                        <div className="p-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 rounded-xl font-mono">
                          {w.no_meter || '-'}
                        </div>
                        <div className="p-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/60 text-slate-900 dark:text-slate-100 rounded-xl text-left pl-3 font-bold truncate">
                          {idx + 1}. {w.nama}
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
                          {fmtRp(tagihanVal)}
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
                        <div className={`p-2 rounded-xl font-bold text-[10px] truncate ${statusColor}`}>
                          {statusText}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>

          {/* RINCIAN PENGELUARAN PER KATEGORI */}
          {klrBln.length > 0 && (
            <div className="rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50 p-5 space-y-4 print:overflow-visible print:border-none print:shadow-none">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span>📤</span> Rincian Pengeluaran Per Kategori
              </h3>
              
              {/* Category Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {(() => {
                  const cats = {};
                  klrBln.forEach(k => { cats[k.kategori] = (cats[k.kategori] || 0) + k.jumlah; });
                  return Object.entries(cats).map(([cat, total]) => {
                    const pct = keluar > 0 ? ((total / keluar) * 100).toFixed(0) : 0;
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
                  });
                })()}
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
                      {fmtRp(keluar)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TABLE OF TRANSACTION LIST (INFOGRAPHIC GRID STYLE) */}
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
                {[
                  ...byrSiklus.map(p => ({
                    tanggal: p.tanggal_bayar,
                    tipe: p.keterangan && p.keterangan.startsWith('[PATUNGAN]') ? 'PATUNGAN' : 'PEMASUKAN',
                    warga: state.warga.find(x => x.id === p.warga_id)?.nama || 'Sistem',
                    ket: p.keterangan || 'Iuran air bersih',
                    masuk: p.jumlah_bayar,
                    keluar: 0
                  })),
                  ...klrBln.map(k => ({
                    tanggal: k.tanggal,
                    tipe: k.kategori === 'Perbaikan Mesin (Patungan)' ? 'MESIN_KELUAR' : 'PENGELUARAN',
                    warga: 'Kas Pengeluaran',
                    ket: `[${k.kategori}] ${k.keterangan}`,
                    masuk: 0,
                    keluar: k.jumlah
                  }))
                ]
                  .sort((x, y) => new Date(x.tanggal) - new Date(y.tanggal))
                  .map((item, idx) => {
                    let typeBg = 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-350';
                    if (item.tipe === 'PATUNGAN') typeBg = 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300';
                    else if (item.tipe === 'PEMASUKAN') typeBg = 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-750 dark:text-emerald-300';
                    else if (item.tipe === 'MESIN_KELUAR' || item.tipe === 'PENGELUARAN') typeBg = 'bg-rose-100 dark:bg-rose-950/60 text-rose-755 dark:text-rose-350';

                    return (
                      <div key={idx} className="grid grid-cols-6 gap-2 text-center text-xs font-semibold items-center">
                        {/* Col 1: Tanggal */}
                        <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 rounded-xl font-mono">
                          {fmtDate(item.tanggal)}
                        </div>

                        {/* Col 2: Tipe */}
                        <div className={`p-2.5 rounded-xl font-bold ${typeBg}`}>
                          {item.tipe}
                        </div>

                        {/* Col 3: Warga */}
                        <div className="p-2.5 bg-sky-50/40 dark:bg-sky-950/15 text-sky-850 dark:text-sky-300 rounded-xl truncate font-bold">
                          {item.warga}
                        </div>

                        {/* Col 4: Keterangan */}
                        <div className="p-2.5 bg-slate-50/50 dark:bg-slate-800/30 text-slate-600 dark:text-slate-400 rounded-xl text-left pl-3 truncate whitespace-pre-wrap">
                          {item.ket}
                        </div>

                        {/* Col 5: Pemasukan */}
                        <div className="p-2.5 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-750 dark:text-emerald-300 rounded-xl font-mono font-bold">
                          {item.masuk > 0 ? fmtRp(item.masuk) : '—'}
                        </div>

                        {/* Col 6: Pengeluaran */}
                        <div className="p-2.5 bg-rose-50/40 dark:bg-rose-950/20 text-rose-755 dark:text-rose-350 rounded-xl font-mono font-bold">
                          {item.keluar > 0 ? fmtRp(item.keluar) : '—'}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Rincian Perhitungan & Tanda Tangan Wrapper (Menghindari Pemisahan Halaman) */}
          <div className="print-avoid-break mt-6">
            {/* Rincian Perhitungan Matematis Saldo Akhir */}
            <div className="mx-auto w-full max-w-md print:max-w-lg">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm print:border-slate-400 print:shadow-none">
                <h4 className="text-center font-bold text-sm text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2.5 mb-3">
                  Rincian Perhitungan Matematis Saldo Akhir
                </h4>
                <div className="space-y-2 font-mono text-xs text-slate-700 dark:text-slate-350">
                  <div className="flex justify-between">
                    <span>Saldo Bawaan (Awal)</span>
                    <span className="font-bold">{saldoAwalCash < 0 ? '-' : ''}{fmtRp(Math.abs(saldoAwalCash))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Pemasukan</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">+ {fmtRp(masuk)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Pengeluaran</span>
                    <span className="text-rose-600 dark:text-rose-450 font-bold">- {fmtRp(keluar)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2 font-bold text-slate-900 dark:text-white">
                    <span>Saldo Akhir Kas RT</span>
                    <span>= {saldoAkhirCash < 0 ? '-' : ''}{fmtRp(Math.abs(saldoAkhirCash))}</span>
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
      )}

      {/* --- TAHUNAN STANDALONE TABULAR REPORT --- */}
      {reportType === 'tahunan' && (
        <div id="report-tahunan-capture" className="space-y-6 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-3xl border border-slate-200/50 dark:border-slate-700/50 print:p-0 print:bg-transparent print:border-none">
          {/* HEADER CETAK TAHUNAN */}
          <div className="print-header text-center py-6 border-b-4 double border-slate-900/60">
            <h2 className="text-lg font-bold text-slate-900 uppercase">REKAPITULASI LAPORAN KEUANGAN TAHUNAN</h2>
            <h3 className="text-sm font-bold text-teal-800 uppercase mt-0.5">{state.settings?.nama_rt || 'KAS AIR RT / RW'}</h3>
            <h4 className="text-xs font-bold mt-1 text-slate-700">Tahun Buku: {t}</h4>
            <p className="text-xs text-slate-600 mt-1">Pengelola: {state.settings?.pengelola || 'Nama Pengelola'}</p>
            <p className="text-xs text-slate-600 mt-0.5">Alamat: {state.settings?.alamat_rt || 'Alamat RT tidak tersedia'}</p>
          </div>

          {/* Hidden summary capture for image sharing (Tahunan) */}
          {captureMode && (
            <div id="share-summary-capture" className="fixed inset-0 bg-white dark:bg-slate-800 z-50 p-6 overflow-auto flex flex-col items-center">
              <div className="w-full max-w-4xl">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white uppercase">REKAPITULASI LAPORAN KEUANGAN TAHUNAN</h2>
                  <h3 className="text-lg font-bold text-teal-800 dark:text-teal-400 uppercase mt-1">{state.settings?.nama_rt || 'KAS AIR RT / RW'}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Tahun Buku: {t}</p>
                </div>
                
                <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-200 dark:bg-slate-700">
                        <th className="p-3 text-slate-900 dark:text-white">Bulan</th>
                        <th className="p-3 text-right text-slate-900 dark:text-white">Tagihan Air</th>
                        <th className="p-3 text-right text-slate-900 dark:text-white">Total Masuk</th>
                        <th className="p-3 text-right text-slate-900 dark:text-white">Pengeluaran Kas</th>
                        <th className="p-3 text-right text-slate-900 dark:text-white">Saldo Bersih</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                      {summaryData.map(d => (
                        <tr key={d.bulan}>
                          <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{d.bulanNama}</td>
                          <td className="p-3 text-right font-mono">{fmtRp(d.totalTagihan)}</td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-600">{fmtRp(d.totalPemasukan)}</td>
                          <td className="p-3 text-right font-mono text-rose-600">{fmtRp(d.totalPengeluaran)}</td>
                          <td className={`p-3 text-right font-mono font-bold ${d.saldoBersih >= 0 ? 'text-emerald-650' : 'text-rose-600'}`}>{fmtRp(d.saldoBersih)}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-300 dark:bg-slate-800 font-bold">
                        <td className="p-3 text-slate-900 dark:text-white">TOTAL</td>
                        <td className="p-3 text-right font-mono text-slate-900 dark:text-white">{fmtRp(grandTagihan)}</td>
                        <td className="p-3 text-right font-mono text-emerald-600">{fmtRp(grandPemasukan)}</td>
                        <td className="p-3 text-right font-mono text-rose-600">{fmtRp(grandPengeluaran)}</td>
                        <td className={`p-3 text-right font-mono font-bold ${grandSaldo >= 0 ? 'text-emerald-650' : 'text-rose-600'}`}>{fmtRp(grandSaldo)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TABLE YEAR SUMMARY (INFOGRAPHIC GRID STYLE) */}
          <div className="rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50 p-5 print:overflow-visible print:border-none print:shadow-none">
            <div className="overflow-x-auto pb-2">
              <div className="min-w-[950px] space-y-2">
                {/* Header Row */}
                <div className="grid grid-cols-9 gap-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-white">
                  <div className="p-3 bg-slate-700 dark:bg-slate-600 rounded-xl">Bulan</div>
                  <div className="p-3 bg-slate-700 dark:bg-slate-600 rounded-xl">Tagihan Air</div>
                  <div className="p-3 bg-emerald-700 rounded-xl">Pendapatan Air</div>
                  <div className="p-3 bg-slate-700 dark:bg-slate-600 rounded-xl">Kas Lain</div>
                  <div className="p-3 bg-emerald-700 rounded-xl">Total Masuk</div>
                  <div className="p-3 bg-rose-700 rounded-xl">Pengeluaran Kas</div>
                  <div className="p-3 bg-indigo-700 rounded-xl">Saldo Bersih</div>
                  <div className="p-3 bg-amber-700 rounded-xl">Iuran Patungan</div>
                  <div className="p-3 bg-rose-700 rounded-xl">Klr Patungan</div>
                </div>

                {/* Data Rows */}
                {summaryData.map(d => (
                  <div key={d.bulan} className="grid grid-cols-9 gap-1.5 text-center text-xs font-semibold items-center">
                    <div className="p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200/40 dark:border-slate-700/40 text-slate-900 dark:text-slate-100 rounded-xl font-bold">
                      {d.bulanNama}
                    </div>
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 text-slate-750 dark:text-slate-200 rounded-xl font-mono">
                      {fmtRp(d.totalTagihan)}
                    </div>
                    <div className="p-2.5 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-750 dark:text-emerald-300 rounded-xl font-mono">
                      {fmtRp(d.totalBayarWater)}
                    </div>
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 text-slate-750 dark:text-slate-200 rounded-xl font-mono">
                      {fmtRp(d.totalKasLain)}
                    </div>
                    <div className="p-2.5 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-750 dark:text-emerald-300 rounded-xl font-mono font-bold">
                      {fmtRp(d.totalPemasukan)}
                    </div>
                    <div className="p-2.5 bg-rose-50/40 dark:bg-rose-950/20 text-rose-755 dark:text-rose-350 rounded-xl font-mono">
                      {fmtRp(d.totalPengeluaran)}
                    </div>
                    <div className={`p-2.5 rounded-xl font-mono font-bold ${
                      d.saldoBersih >= 0 
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-750' 
                        : 'bg-rose-100 dark:bg-rose-950/60 text-rose-755'
                    }`}>
                      {fmtRp(d.saldoBersih)}
                    </div>
                    <div className="p-2.5 bg-amber-50/45 dark:bg-amber-950/20 text-amber-700 dark:text-amber-305 rounded-xl font-mono">
                      {fmtRp(d.totalPatungan)}
                    </div>
                    <div className="p-2.5 bg-rose-50/40 dark:bg-rose-950/20 text-rose-755 dark:text-rose-350 rounded-xl font-mono">
                      {fmtRp(d.totalKlrPatungan)}
                    </div>
                  </div>
                ))}

                {/* Total Row */}
                <div className="grid grid-cols-9 gap-1.5 text-center text-xs font-bold items-center">
                  <div className="p-3 bg-slate-200 dark:bg-slate-900 text-slate-955 dark:text-white rounded-xl font-bold">TOTAL</div>
                  <div className="p-3 bg-slate-200 dark:bg-slate-900 text-slate-955 dark:text-white rounded-xl font-mono">{fmtRp(grandTagihan)}</div>
                  <div className="p-3 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-350 rounded-xl font-mono">{fmtRp(grandBayarWater)}</div>
                  <div className="p-3 bg-slate-200 dark:bg-slate-900 text-slate-955 dark:text-white rounded-xl font-mono">{fmtRp(grandKasLain)}</div>
                  <div className="p-3 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-350 rounded-xl font-mono">{fmtRp(grandPemasukan)}</div>
                  <div className="p-3 bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-350 rounded-xl font-mono">{fmtRp(grandPengeluaran)}</div>
                  <div className={`p-3 rounded-xl font-mono ${
                    grandSaldo >= 0 
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-350' 
                      : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-350'
                  }`}>{fmtRp(grandSaldo)}</div>
                  <div className="p-3 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-350 rounded-xl font-mono">{fmtRp(grandPatungan)}</div>
                  <div className="p-3 bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-350 rounded-xl font-mono">{fmtRp(grandPengeluaranPatungan)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Tanda Tangan Wrapper (Menghindari Pemisahan Halaman) */}
          <div className="print-avoid-break mt-6">
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
      )}
    </div>
  );
};

export default LaporanKeuangan;
