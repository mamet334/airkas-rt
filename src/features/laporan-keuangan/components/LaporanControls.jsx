// src/features/laporan-keuangan/components/LaporanControls.jsx
import { Printer, Download, MessageCircle, Image, Loader2, FileText } from 'lucide-react';
import { MONTHS } from '../../../utils/format';

const LaporanControls = ({
  reportType,
  setReportType,
  selectedMonth,
  setSelectedMonth,
  selectedYear,
  setSelectedYear,
  onPrint,
  onExportPDF,      // ✅ Ditambahkan
  onExportCSV,
  onShareWA,
  onShareImage,
  isSharing
}) => {
  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50 no-print space-y-3">
      {/* Row 1: Tabs + Period Selectors */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-slate-900/60 rounded-xl">
          <button
            onClick={() => setReportType('bulanan')}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
              reportType === 'bulanan' 
                ? 'bg-teal-600 text-white shadow-sm' 
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
            }`}
          >
            Bulanan
          </button>
          <button
            onClick={() => setReportType('tahunan')}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
              reportType === 'tahunan' 
                ? 'bg-teal-600 text-white shadow-sm' 
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
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
              {MONTHS.map((m, idx) => idx > 0 && (
                <option key={idx} value={idx}>
                  {m} (15 {idx === 1 ? 'Des' : MONTHS[idx-1]} - 14 {m})
                </option>
              ))}
            </select>
          )}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-2 py-1.5 rounded-lg text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            {[2025, 2026, 2027, 2028].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2: Action Buttons (✅ Diperbaiki: Grid 5 kolom & tombol PDF di dalam grid) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <ActionButton icon={Printer} label="Cetak" onClick={onPrint} variant="primary" />
        
        {/* ✅ Tombol Export PDF Asli */}
        <ActionButton icon={FileText} label="Export PDF" onClick={onExportPDF} variant="blue" />
        
        <ActionButton icon={Download} label="Unduh CSV" onClick={onExportCSV} variant="secondary" />
        <ActionButton icon={MessageCircle} label="Share Teks" onClick={onShareWA} variant="success" />
        <ActionButton 
          icon={isSharing ? Loader2 : Image} 
          label={isSharing ? 'Proses...' : 'Bagi Gambar'} 
          onClick={onShareImage} 
          variant="info"
          disabled={isSharing}
          iconProps={isSharing ? { className: "animate-spin" } : {}}
        />
      </div>
    </div>
  );
};

const ActionButton = ({ icon: Icon, label, onClick, variant = 'primary', disabled = false, iconProps = {} }) => {
  const variants = {
    primary: 'bg-teal-600 hover:bg-teal-500 text-white',
    blue: 'bg-blue-600 hover:bg-blue-500 text-white', // ✅ Varian baru untuk PDF
    secondary: 'border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200',
    success: 'bg-green-600 hover:bg-green-500 text-white',
    info: 'bg-indigo-600 hover:bg-indigo-500 text-white'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`py-2 px-2 rounded-xl text-[11px] font-bold shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-75 disabled:pointer-events-none ${variants[variant]}`}
    >
      <Icon size={13} {...iconProps} />
      {label}
    </button>
  );
};

export default LaporanControls;