// src/features/laporan-keuangan/services/reportExporter.js
import { MONTHS } from '../../../utils/format';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Generate PDF Bulanan yang Profesional
 */
export const generateMonthlyPDF = (data, settings, state) => {
  // Buat instance PDF
  const doc = new jsPDF();
  
  // ✅ PERBAIKAN: Tambahkan klrBln dan byrSiklus di sini
  const { 
    b, t, cycleRange, tagihan, pendapatanAir, 
    masuk, keluar, saldo, saldoPatungan,
    mtrBln, byrBln, klrBln, byrSiklus 
  } = data;

  const rtName = settings?.nama_rt || 'RT / RW';
  const pengelola = settings?.pengelola || 'Pengelola';

  // 1. HEADER
  doc.setFontSize(14);
  doc.text('LAPORAN KEUANGAN BULANAN', 105, 15, { align: 'center' });
  doc.setFontSize(12);
  doc.text(`KAS AIR ${rtName}`, 105, 22, { align: 'center' });
  doc.setFontSize(10);
  doc.text(`Periode: ${MONTHS[b]} ${t}`, 105, 28, { align: 'center' });
  
  if (cycleRange) {
    doc.text(`Siklus: ${cycleRange.start?.split('-').reverse().join('/')} s/d ${cycleRange.end?.split('-').reverse().join('/')}`, 105, 33, { align: 'center' });
  }

  // 2. SUMMARY BOX
  let yPos = 45;
  
  const summaryData = [
    ['Total Tagihan', `Rp ${Number(tagihan || 0).toLocaleString('id-ID')}`],
    ['Pendapatan Air', `Rp ${Number(pendapatanAir || 0).toLocaleString('id-ID')}`],
    ['Total Pemasukan', `Rp ${Number(masuk || 0).toLocaleString('id-ID')}`],
    ['Total Pengeluaran', `Rp ${Number(keluar || 0).toLocaleString('id-ID')}`],
    ['Saldo Kas RT', `Rp ${Number(saldo || 0).toLocaleString('id-ID')}`],
    ['Saldo Patungan', `Rp ${Number(saldoPatungan || 0).toLocaleString('id-ID')}`],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [['Keterangan', 'Jumlah']],
    body: summaryData,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], textColor: 255 },
    styles: { fontSize: 10 },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 80, halign: 'right' }
    }
  });

  // 3. TABEL WARGA
  yPos = doc.lastAutoTable.finalY + 10;
  doc.text('Detail Pembayaran Warga:', 14, yPos);
  
  const wargaData = (state?.warga || [])
    .filter(w => w.aktif && w.alamat !== 'SISTEM')
    .sort((a, b) => (a.no_urut || 999) - (b.no_urut || 999))
    .map((w, idx) => {
      const m = mtrBln?.find(x => x.warga_id === w.id);
      const bayarVal = m ? (byrBln?.filter(p => p.meteran_id === m.id).reduce((s, p) => s + p.jumlah_bayar, 0) || 0) : 0;
      
      return [
        idx + 1,
        w.nama,
        w.no_meter || '-',
        m ? (m.pemakaian_m3 || m.pemakaian || 0) : 0,
        `Rp ${Number(m?.total_tagihan || 0).toLocaleString('id-ID')}`,
        `Rp ${Number(bayarVal).toLocaleString('id-ID')}`,
        bayarVal >= (m?.total_tagihan || 0) ? 'Lunas' : 'Belum Lunas'
      ];
    });

  autoTable(doc, {
    startY: yPos + 5,
    head: [['No', 'Nama', 'No Meter', 'Pakai (m³)', 'Tagihan', 'Bayar', 'Status']],
    body: wargaData,
    theme: 'striped',
    headStyles: { fillColor: [51, 65, 85], textColor: 255 },
    styles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 40 },
      2: { cellWidth: 20 },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 25, halign: 'right' },
      5: { cellWidth: 25, halign: 'right' },
      6: { cellWidth: 25, halign: 'center' }
    }
  });

  // 4. TABEL PENGELUARAN
  if (klrBln && klrBln.length > 0) {
    yPos = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(11);
    doc.text('Rincian Pengeluaran:', 14, yPos);
  
    const pengeluaranData = klrBln
      .sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal))
      .map((k, idx) => [
        idx + 1,
        k.tanggal?.split('T')[0] || '-',
        k.kategori,
        (k.keterangan || '').substring(0, 30),
        `Rp ${Number(k.jumlah || 0).toLocaleString('id-ID')}`
      ]);

    autoTable(doc, {
      startY: yPos + 5,
      head: [['No', 'Tanggal', 'Kategori', 'Keterangan', 'Jumlah']],
      body: pengeluaranData,
      theme: 'striped',
      headStyles: { fillColor: [220, 38, 38], textColor: 255 },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 25 },
        2: { cellWidth: 35 },
        3: { cellWidth: 60 },
        4: { cellWidth: 30, halign: 'right' }
      }
    });
  }

  // 5. LOG TRANSAKSI GABUNGAN
  const allTransactions = [
    ...(byrSiklus || []).map(p => ({
      tanggal: p.tanggal_bayar,
      tipe: p.keterangan && p.keterangan.startsWith('[PATUNGAN]') ? 'Patungan' : 'Pemasukan',
      warga: state?.warga?.find(x => x.id === p.warga_id)?.nama || 'Sistem',
      ket: p.keterangan || 'Iuran air bersih',
      masuk: p.jumlah_bayar,
      keluar: 0
    })),
    ...(klrBln || []).map(k => ({
      tanggal: k.tanggal,
      tipe: 'Pengeluaran',
      warga: '-',
      ket: `[${k.kategori}] ${k.keterangan}`,
      masuk: 0,
      keluar: k.jumlah
    }))
  ].sort((x, y) => new Date(x.tanggal) - new Date(y.tanggal));

  if (allTransactions.length > 0) {
    yPos = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(11);
    doc.text('Log Transaksi:', 14, yPos);
  
    const logData = allTransactions.map((item, idx) => [
      idx + 1,
      item.tanggal?.split('T')[0] || '-',
      item.tipe,
      (item.warga || '').substring(0, 20),
      (item.ket || '').substring(0, 25),
      item.masuk > 0 ? `Rp ${Number(item.masuk).toLocaleString('id-ID')}` : '-',
      item.keluar > 0 ? `Rp ${Number(item.keluar).toLocaleString('id-ID')}` : '-'
    ]);

    autoTable(doc, {
      startY: yPos + 5,
      head: [['No', 'Tanggal', 'Tipe', 'Warga', 'Keterangan', 'Masuk', 'Keluar']],
      body: logData,
      theme: 'striped',
      headStyles: { fillColor: [51, 65, 85], textColor: 255 },
      styles: { fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 20 },
        2: { cellWidth: 20 },
        3: { cellWidth: 25 },
        4: { cellWidth: 35 },
        5: { cellWidth: 25, halign: 'right' },
        6: { cellWidth: 25, halign: 'right' }
      }
    });
  }

  // 6. TANDA TANGAN
  const finalY = doc.lastAutoTable.finalY + 20;
  doc.text('Mengetahui,', 14, finalY);
  doc.text('Pengelola Kas,', 140, finalY);
  doc.text(rtName, 14, finalY + 25);
  doc.text(pengelola, 140, finalY + 25);

  // 7. SAVE
  doc.save(`Laporan_Bulanan_${MONTHS[b] || 'Bulan'}_${t || 'Tahun'}.pdf`);
};

/**
 * Generate PDF Tahunan
 */
export const generateYearlyPDF = (data, settings, selectedYear) => {
  const doc = new jsPDF();
  const { summaryData, grandTotals } = data;

  const rtName = settings?.nama_rt || 'RT / RW';
  const pengelola = settings?.pengelola || 'Pengelola';

  // 1. HEADER
  doc.setFontSize(14);
  doc.text('REKAPITULASI LAPORAN TAHUNAN', 105, 15, { align: 'center' });
  doc.setFontSize(12);
  doc.text(`KAS AIR ${rtName}`, 105, 22, { align: 'center' });
  doc.setFontSize(10);
  doc.text(`Tahun Buku: ${selectedYear}`, 105, 28, { align: 'center' });

  // 2. TABEL REKAP
  const tableData = (summaryData || [])
    .filter(d => d.totalPemasukan > 0 || d.totalPengeluaran > 0)
    .map(d => [
      d.bulanNama,
      `Rp ${Number(d.totalTagihan || 0).toLocaleString('id-ID')}`,
      `Rp ${Number(d.totalPemasukan || 0).toLocaleString('id-ID')}`,
      `Rp ${Number(d.totalPengeluaran || 0).toLocaleString('id-ID')}`,
      `Rp ${Number(d.saldoBersih || 0).toLocaleString('id-ID')}`
    ]);

  autoTable(doc, {
    startY: 40,
    head: [['Bulan', 'Tagihan Air', 'Total Pemasukan', 'Pengeluaran', 'Saldo Bersih']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], textColor: 255 },
    styles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 35, halign: 'right' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 35, halign: 'right' },
      4: { cellWidth: 35, halign: 'right' }
    }
  });

  // 3. GRAND TOTAL
  const finalY = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(11);
  doc.text('TOTAL TAHUNAN:', 14, finalY);
  doc.text(`Rp ${Number(grandTotals?.pemasukan || 0).toLocaleString('id-ID')}`, 140, finalY, { align: 'right' });

  // 4. SAVE
  doc.save(`Rekap_Tahunan_${selectedYear}.pdf`);
};