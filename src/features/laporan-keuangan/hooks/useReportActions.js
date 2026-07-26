// src/features/laporan-keuangan/hooks/useReportActions.js
import { useState } from 'react';
import { generateMonthlyPDF, generateYearlyPDF } from '../services/reportExporter';

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
    console.log("🚀 Tombol Export PDF diklik!");
    try {
      if (reportType === 'bulanan') {
        generateMonthlyPDF({ ...data, b: selectedMonth, t: selectedYear }, state.settings, state);
      } else {
        generateYearlyPDF(data, state.settings, selectedYear);
      }
      console.log("✅ PDF berhasil dibuat!");
    } catch (error) {
      console.error("❌ Error saat membuat PDF:", error);
      alert("Gagal membuat PDF: " + error.message);
    }
  };

  const handleExportCSV = () => {
    console.log('Export CSV dipicu', data);
    alert("Fitur Export CSV akan diaktifkan selanjutnya.");
  };

  const handleShareWA = () => {
    console.log('Share WA dipicu', data);
    alert("Fitur Share WA akan diaktifkan selanjutnya.");
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