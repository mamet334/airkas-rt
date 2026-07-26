// src/features/laporan-keuangan/hooks/useReportActions.js
import { useState } from 'react';
import { generateMonthlyPDF, generateYearlyPDF } from '../services/reportExporter';
import { fmtRp, MONTHS } from '../../../utils/format';
import { getWargaBillingSummary } from '../../../utils/billingEngine'; 

export const useReportActions = (data, reportType, selectedMonth, selectedYear, state) => {
  const [isSharing, setIsSharing] = useState(false);

  const handlePrint = () => {
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) document.documentElement.classList.remove('dark');
    setTimeout(() => {
      window.print();
      if (isDark) document.documentElement.classList.add('dark');
    }, 150);
  };

  const handleExportPDF = () => {
    try {
      if (reportType === 'bulanan') {
        generateMonthlyPDF({ ...data, b: selectedMonth, t: selectedYear }, state.settings, state);
      } else {
        generateYearlyPDF(data, state.settings, selectedYear);
      }
    } catch (error) {
      console.error("❌ Error saat membuat PDF:", error);
      alert("Gagal membuat PDF: " + error.message);
    }
  };

  // ✅ FITUR EXPORT CSV LENGKAP & RAPI (HANYA 1x DEKLARASI)
  const handleExportCSV = () => {
    try {
      const rtName = state.settings?.nama_rt || 'RT / RW';
      const periode = `${MONTHS[selectedMonth]} ${selectedYear}`;
      const filename = `Laporan_Keuangan_${MONTHS[selectedMonth]}_${selectedYear}.csv`;

      const escapeCsv = (value) => {
        const text = String(value ?? '');
        return `"${text.replace(/"/g, '""')}"`;
      };

      const formatTanggal = (dateStr) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
      };

      let csv = `\uFEFF`; // UTF-8 BOM untuk Excel
      
      // 1. HEADER
      csv += `LAPORAN KEUANGAN BULANAN;${escapeCsv(rtName)}\n`;
      csv += `Periode;${escapeCsv(periode)}\n\n`;
    
      // 2. RINGKASAN KEUANGAN
      csv += `RINGKASAN KEUANGAN\n`;
      csv += `Keterangan;Jumlah (Rp)\n`;
      csv += `Total Tagihan;${data.tagihan || 0}\n`;
      csv += `Total Pemasukan;${data.masuk || 0}\n`;
      csv += `Total Pengeluaran;${data.keluar || 0}\n`;
      csv += `Saldo Kas RT;${data.saldoAkhirCash || 0}\n\n`;

      // 3. DETAIL TAGIHAN WARGA
      csv += `DETAIL TAGIHAN WARGA\n`;
      csv += `No;Nama;No Meter;Pakai (m3);Tagihan;Bayar;Status\n`;
    
      const wargaActiveSorted = (state.warga || [])
        .filter(w => w.aktif && w.alamat !== 'SISTEM')
        .sort((a, b) => (a.no_urut || 999) - (b.no_urut || 999));

      wargaActiveSorted.forEach((w, idx) => {
        const m = data.mtrBln?.find(x => x.warga_id === w.id);
        const bayarVal = m ? (data.byrBln?.filter(p => p.meteran_id === m.id).reduce((s, p) => s + p.jumlah_bayar, 0) || 0) : 0;
        const sisa = bayarVal - (m?.total_tagihan || 0);
        let status = 'Belum Lunas';
        if (w.adalah_pengelola) status = 'Pengelola';
        else if (sisa >= 0) status = 'Lunas';

        csv += `${idx + 1};${escapeCsv(w.nama)};${w.no_meter || '-'};${m?.pemakaian_m3 || 0};${m?.total_tagihan || 0};${bayarVal};${status}\n`;
      });
      csv += `\n`;

      // 4. LOG TRANSAKSI (JURNAL UMUM)
      csv += `LOG TRANSAKSI (JURNAL UMUM)\n`;
      csv += `Tanggal;Tipe;Warga;Keterangan;Pemasukan;Pengeluaran\n`;

      const transactions = [
        ...(data.byrSiklus || []).map(p => ({
          tanggal: p.tanggal_bayar,
          tipe: p.keterangan?.startsWith('[PATUNGAN]') ? 'Patungan' : 'Pemasukan',
          warga: state.warga?.find(x => x.id === p.warga_id)?.nama || 'Sistem',
          ket: p.keterangan || 'Iuran air bersih',
          masuk: p.jumlah_bayar,
          keluar: 0
        })),
        ...(data.klrBln || []).map(k => ({
          tanggal: k.tanggal,
          tipe: 'Pengeluaran',
          warga: '-',
          ket: `[${k.kategori}] ${k.keterangan}`,
          masuk: 0,
          keluar: k.jumlah
        }))
      ].sort((x, y) => new Date(x.tanggal) - new Date(y.tanggal));

      transactions.forEach(t => {
        const tgl = formatTanggal(t.tanggal); // Format DD/MM/YYYY agar tidak ##### di Excel
        csv += `${tgl};${t.tipe};${escapeCsv(t.warga)};${escapeCsv(t.ket)};${t.masuk};${t.keluar}\n`;
      });

      // 5. TRIGGER DOWNLOAD
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
    
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    
      console.log('✅ File CSV berhasil diunduh');
    } catch (error) {
      console.error('❌ Error membuat CSV:', error);
      alert('Gagal membuat file CSV: ' + error.message);
    }
  };

  const handleShareWA = () => {
    try {
      const rtName = state.settings?.nama_rt || 'RT 01 / RW 03';
      const alamatRt = state.settings?.alamat_rt || 'Jln.sekar jaya';
      const pengelola = state.settings?.pengelola || 'Slamet Susanto';
      
      const { 
        saldoAwalCash, 
        masuk, 
        keluar, 
        saldoAkhirCash,
        byrBln, 
        mtrBln,
        targetB,
        targetT
      } = data;

      const wargaActiveSorted = (state.warga || [])
        .filter(w => w.aktif && w.alamat !== 'SISTEM')
        .sort((a, b) => (a.no_urut || 999) - (b.no_urut || 999));

      const lunasList = [];
      const belumList = [];

      wargaActiveSorted.forEach(w => {
        const m = mtrBln?.find(x => x.warga_id === w.id);
        const rawTagihan = m ? m.total_tagihan : 0;
        const bayarVal = m ? (byrBln?.filter(p => p.meteran_id === m.id).reduce((s, p) => s + p.jumlah_bayar, 0) || 0) : 0;
        
        const { sisa } = getWargaBillingSummary(w.id, rawTagihan, bayarVal, targetB, targetT, state);

        if (w.adalah_pengelola) {
          lunasList.push(`${w.nama} (Pengelola)`);
        } else if (sisa <= 0) { 
          if (sisa < 0) {
            lunasList.push(`${w.nama} (Lebih ${fmtRp(Math.abs(sisa))})`);
          } else {
            lunasList.push(w.nama);
          }
        } else {
          belumList.push(`${w.nama} (Tagihan ${fmtRp(sisa)})`);
        }
      });

      const patunganBulanIni = (byrBln || []).filter(p => 
        p.keterangan && p.keterangan.startsWith('[PATUNGAN]')
      );
      
      let patunganText = '';
      if (patunganBulanIni.length > 0) {
        const uniqueProjects = [...new Set(patunganBulanIni.map(p => p.keterangan))];
        
        uniqueProjects.forEach(proj => {
          const cleanProjName = proj.replace('[PATUNGAN] ', '').trim();
          const paymentsForProj = patunganBulanIni.filter(p => p.keterangan === proj);
          const paidWargaIds = paymentsForProj.map(p => p.warga_id);
          
          const belumPatungan = wargaActiveSorted
            .filter(w => !w.adalah_pengelola && !paidWargaIds.includes(w.id));
          
          if (belumPatungan.length > 0) {
            patunganText += `\n❌ *"YANG BELUM BAYAR ${cleanProjName.toUpperCase()}"*\n`;
            belumPatungan.forEach((w, idx) => {
              patunganText += `${idx + 1}. ${w.nama}\n`;
            });
          }
        });
      }

      const lines = [
        `*💧 LAPORAN KEUANGAN KAS AIR ${rtName.toUpperCase()} 💧*`,
        `*Periode: ${MONTHS[selectedMonth].toUpperCase()} ${selectedYear}*`,
        `_${alamatRt}_`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `📊 *RINCIAN SALDO KAS RT*`,
        `\`\`\``,
        `Saldo Bawaan : ${fmtRp(saldoAwalCash)}`,
        `Pemasukan    : ${fmtRp(masuk)}`,
        `Pengeluaran  : ${fmtRp(keluar)}`,
        `--------------------------`,
        `Saldo Akhir  : ${fmtRp(saldoAkhirCash)}`,
        `\`\`\``,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `✅ *SUDAH LUNAS / BAYAR:*`,
      ];

      if (lunasList.length > 0) {
        lunasList.forEach((item, index) => lines.push(`${index + 1}. ${item}`));
      } else {
        lines.push(`-`);
      }

      lines.push(``);
      lines.push(`❌ *BELUM LUNAS:*`);
      
      if (belumList.length > 0) {
        belumList.forEach((item, index) => lines.push(`${index + 1}. ${item}`));
      } else {
        lines.push(`-`);
      }
      
      lines.push(``);

      if (patunganText) {
        lines.push(patunganText);
      }

      lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      lines.push(`🙏 _Laporan dibuat secara transparan untuk kenyamanan bersama seluruh warga._`);
      lines.push(``);
      lines.push(`_Pengelola Kas Air: *${pengelola}*_`);

      const message = lines.join('\n');
      const encoded = encodeURIComponent(message);
      window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
      
      console.log('✅ Pesan WhatsApp berhasil dibuat');
    } catch (error) {
      console.error('❌ Error membuat pesan WhatsApp:', error);
      alert('Gagal membuat pesan WhatsApp: ' + error.message);
    }
  };

  const handleShareImage = async () => {
    setIsSharing(true);
    try {
      const html2canvas = (await import('html2canvas-pro')).default;
      const element = document.getElementById(`report-${reportType}-capture`);
      if (!element) throw new Error('Element tidak ditemukan');

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });

      canvas.toBlob((blob) => {
        if (navigator.share && navigator.canShare({ files: [new File([blob], 'laporan.png', { type: 'image/png' })] })) {
          navigator.share({
            files: [new File([blob], `Laporan_${reportType}_${selectedYear}.png`, { type: 'image/png' })],
            title: 'Laporan Keuangan'
          });
        } else {
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `Laporan_${reportType}_${selectedYear}.png`;
          link.click();
        }
      });
    } catch (err) {
      console.error('Gagal generate gambar:', err);
      alert('Gagal membuat gambar laporan');
    } finally {
      setIsSharing(false);
    }
  };

  return {
    handlePrint,
    handleExportPDF,
    handleExportCSV,
    handleShareWA,
    handleShareImage,
    isSharing
  };
};