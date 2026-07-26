// src/features/laporan-keuangan/services/reportExporter.js
import { MONTHS } from '../../../utils/format';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ==========================================
// FUNGSI HELPER: Tambah Footer & Nomor Halaman ke SEMUA halaman
// ==========================================
const addFootersToAllPages = (doc, rtName, periodeText) => {
  const totalPages = doc.internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    
    // Footer: Nomor Halaman
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.setFont('helvetica', 'italic');
    doc.text(
      `Halaman ${i} dari ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );

    // Header kecil di halaman 2 dst
    if (i > 1) {
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Laporan Keuangan ${rtName} - ${periodeText}`,
        pageWidth / 2,
        8,
        { align: 'center' }
      );
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.2);
      doc.line(14, 10, pageWidth - 14, 10);
    }
  }
};

// ==========================================
// FUNGSI HELPER: Pastikan ada ruang untuk tanda tangan
// ==========================================
const ensureSpaceForSignature = (doc, requiredSpace = 50) => {
  const pageHeight = doc.internal.pageSize.getHeight();
  const currentY = doc.lastAutoTable?.finalY || doc.internal.pageSize.getHeight() - 20;
  
  if (pageHeight - currentY < requiredSpace) {
    doc.addPage();
    return 20;
  }
  return currentY + 15;
};

/**
 * Generate PDF Bulanan yang Profesional
 */
export const generateMonthlyPDF = (data, settings, state) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  
  const { 
    b, t, cycleRange, tagihan, pendapatanAir, 
    masuk, keluar, saldo, saldoPatungan,
    mtrBln, byrBln, klrBln, byrSiklus 
  } = data;

  const rtName = settings?.nama_rt || 'RT / RW';
  const pengelola = settings?.pengelola || 'Pengelola';
  const periodeText = `${MONTHS[b]} ${t}`;

  // ==========================================
  // 1. HEADER UTAMA
  // ==========================================
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 138);
  doc.text('LAPORAN KEUANGAN BULANAN', pageWidth / 2, 15, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(`KAS AIR ${rtName}`, pageWidth / 2, 22, { align: 'center' });
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Periode: ${periodeText}`, pageWidth / 2, 28, { align: 'center' });
  
  if (cycleRange) {
    doc.text(
      `Siklus: ${cycleRange.start?.split('-').reverse().join('/')} s/d ${cycleRange.end?.split('-').reverse().join('/')}`, 
      pageWidth / 2, 33, { align: 'center' }
    );
  }

  // ==========================================
  // 2. RINGKASAN KEUANGAN
  // ==========================================
  let yPos = 42;
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
    margin: { left: 14, right: 14 },
    headStyles: { 
      fillColor: [30, 58, 138],
      textColor: 255, 
      fontStyle: 'bold',
      halign: 'center'
    },
    styles: { fontSize: 9, cellPadding: 3, lineColor: [200, 200, 200] },
    columnStyles: {
      0: { cellWidth: 80, fontStyle: 'bold' },
      1: { cellWidth: 80, halign: 'right', fontStyle: 'bold' }
    }
  });

  // ==========================================
  // 3. DETAIL TAGIHAN WARGA
  // ==========================================
  yPos = doc.lastAutoTable.finalY + 12;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
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
        Number(m?.total_tagihan || 0),
        Number(bayarVal),
        bayarVal >= (m?.total_tagihan || 0) ? 'Lunas' : 'Belum Lunas'
      ];
    });

  autoTable(doc, {
    startY: yPos + 4,
    head: [['No', 'Nama Warga', 'No Meter', 'Pakai', 'Tagihan', 'Bayar', 'Status']],
    body: wargaData,
    theme: 'striped',
    margin: { left: 14, right: 14 },
    headStyles: { 
      fillColor: [51, 65, 85],
      textColor: 255, 
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 8
    },
    styles: { 
      fontSize: 8, 
      cellPadding: 2,
      lineColor: [220, 220, 220]
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 40 },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 15, halign: 'center' },
      4: { cellWidth: 25, halign: 'right' },
      5: { cellWidth: 25, halign: 'right' },
      6: { cellWidth: 25, halign: 'center', fontStyle: 'bold' }
    }
  });

  // ==========================================
  // 4. RINCIAN PENGELUARAN
  // ==========================================
  if (klrBln && klrBln.length > 0) {
    yPos = doc.lastAutoTable.finalY + 12;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Rincian Pengeluaran:', 14, yPos);
  
    const pengeluaranData = klrBln
      .sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal))
      .map((k, idx) => [
        idx + 1,
        k.tanggal?.split('T')[0] || '-',
        k.kategori,
        k.keterangan || '-',
        Number(k.jumlah || 0)
      ]);

    autoTable(doc, {
      startY: yPos + 4,
      head: [['No', 'Tanggal', 'Kategori', 'Keterangan', 'Jumlah (Rp)']],
      body: pengeluaranData,
      theme: 'striped',
      margin: { left: 14, right: 14 },
      headStyles: { 
        fillColor: [153, 27, 27], 
        textColor: 255, 
        fontStyle: 'bold', 
        halign: 'center', 
        fontSize: 8 
      },
      styles: { 
        fontSize: 8, 
        cellPadding: 2, 
        lineColor: [220, 220, 220],
        overflow: 'linebreak'
      },
      alternateRowStyles: { fillColor: [254, 242, 242] },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 22, halign: 'center' },
        2: { cellWidth: 30 },
        3: { cellWidth: 'auto', overflow: 'linebreak' },
        4: { cellWidth: 28, halign: 'right', fontStyle: 'bold' }
      }
    });
  }

  // ==========================================
  // 5. LOG TRANSAKSI GABUNGAN
  // ==========================================
  const allTransactions = [
    ...(byrSiklus || []).map(p => ({
      tanggal: p.tanggal_bayar,
      tipe: p.keterangan && p.keterangan.startsWith('[PATUNGAN]') ? 'Patungan' : 'Pemasukan',
      warga: state?.warga?.find(x => x.id === p.warga_id)?.nama || 'Sistem',
      ket: p.keterangan || 'Iuran air bersih',
      masuk: Number(p.jumlah_bayar || 0),
      keluar: 0
    })),
    ...(klrBln || []).map(k => ({
      tanggal: k.tanggal,
      tipe: 'Pengeluaran',
      warga: '-',
      ket: `[${k.kategori}] ${k.keterangan}`,
      masuk: 0,
      keluar: Number(k.jumlah || 0)
    }))
  ].sort((x, y) => new Date(x.tanggal) - new Date(y.tanggal));

  if (allTransactions.length > 0) {
    yPos = doc.lastAutoTable.finalY + 12;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Log Transaksi (Jurnal Umum):', 14, yPos);
  
    const logData = allTransactions.map((item, idx) => [
      idx + 1,
      item.tanggal?.split('T')[0] || '-',
      item.tipe,
      item.warga || '-',
      item.ket || '-',
      item.masuk,
      item.keluar
    ]);

    autoTable(doc, {
      startY: yPos + 4,
      head: [['No', 'Tgl', 'Tipe', 'Warga', 'Keterangan', 'Masuk', 'Keluar']],
      body: logData,
      theme: 'striped',
      margin: { left: 14, right: 14 },
      headStyles: { 
        fillColor: [51, 65, 85], 
        textColor: 255, 
        fontStyle: 'bold', 
        halign: 'center', 
        fontSize: 7 
      },
      styles: { 
        fontSize: 7, 
        cellPadding: 1.5, 
        lineColor: [220, 220, 220],
        overflow: 'linebreak'
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 25 },
        4: { cellWidth: 'auto', overflow: 'linebreak' },
        5: { cellWidth: 22, halign: 'right' },
        6: { cellWidth: 22, halign: 'right' }
      }
    });
  }

  // ==========================================
  // 6. TANDA TANGAN
  // ==========================================
  const signatureY = ensureSpaceForSignature(doc, 60);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  
  doc.text('Mengetahui,', 14, signatureY);
  doc.text('Pengelola Kas,', 140, signatureY);
  
  doc.setFont('helvetica', 'bold');
  doc.text(rtName, 14, signatureY + 20);
  doc.text(pengelola, 140, signatureY + 20);
  
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.line(14, signatureY + 22, 54, signatureY + 22);
  doc.line(140, signatureY + 22, 180, signatureY + 22);

  // ==========================================
  // 7. TAMBAHKAN FOOTER & NOMOR HALAMAN
  // ==========================================
  addFootersToAllPages(doc, rtName, periodeText);

  // ==========================================
  // 8. SIMPAN FILE
  // ==========================================
  doc.save(`Laporan_Bulanan_${MONTHS[b] || 'Bulan'}_${t || 'Tahun'}.pdf`);
};

/**
 * Generate PDF Tahunan
 */
export const generateYearlyPDF = (data, settings, selectedYear) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  
  const { summaryData, grandTotals } = data;
  const rtName = settings?.nama_rt || 'RT / RW';
  const periodeText = `Tahun ${selectedYear}`;

  // HEADER
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 138);
  doc.text('REKAPITULASI LAPORAN TAHUNAN', pageWidth / 2, 15, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(`KAS AIR ${rtName}`, pageWidth / 2, 22, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Tahun Buku: ${selectedYear}`, pageWidth / 2, 28, { align: 'center' });

  // TABEL REKAP
  const tableData = (summaryData || [])
    .filter(d => d.totalPemasukan > 0 || d.totalPengeluaran > 0)
    .map(d => [
      d.bulanNama,
      Number(d.totalTagihan || 0),
      Number(d.totalPemasukan || 0),
      Number(d.totalPengeluaran || 0),
      Number(d.saldoBersih || 0)
    ]);

  autoTable(doc, {
    startY: 38,
    head: [['Bulan', 'Tagihan Air', 'Total Pemasukan', 'Pengeluaran', 'Saldo Bersih']],
    body: tableData,
    theme: 'grid',
    margin: { left: 14, right: 14 },
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold', halign: 'center' },
    styles: { fontSize: 9, cellPadding: 3, lineColor: [200, 200, 200] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 35, halign: 'left', fontStyle: 'bold' },
      1: { cellWidth: 35, halign: 'right' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 35, halign: 'right' },
      4: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }
    }
  });

  // GRAND TOTAL
  const finalY = doc.lastAutoTable.finalY + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text('TOTAL TAHUNAN:', 14, finalY);
  doc.text(`Rp ${Number(grandTotals?.pemasukan || 0).toLocaleString('id-ID')}`, 140, finalY, { align: 'right' });

  // TAMBAHKAN FOOTER & NOMOR HALAMAN
  addFootersToAllPages(doc, rtName, periodeText);

  doc.save(`Rekap_Tahunan_${selectedYear}.pdf`);
};