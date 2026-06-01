import React, { Suspense, lazy, useState } from 'react'
import { useDb } from './store/DbContext';
import { useNotification } from './store/NotificationContext';
const Dashboard = lazy(() => import('./views/Dashboard'));
const DataWarga = lazy(() => import('./views/DataWarga'));
const PencatatanMeteran = lazy(() => import('./views/PencatatanMeteran'));
const Pembayaran = lazy(() => import('./views/Pembayaran'));
const Pengeluaran = lazy(() => import('./views/Pengeluaran'));
const LaporanKeuangan = lazy(() => import('./views/LaporanKeuangan'));
const AuditLog = lazy(() => import('./views/AuditLog'));
const Pengaturan = lazy(() => import('./views/Pengaturan'));

// Icons
import {
  LayoutDashboard,
  Users,
  Gauge,
  CircleDollarSign,
  TrendingDown,
  FileText,
  History,
  Settings,
  Lock,
  Unlock,
  Wifi,
  WifiOff,
  Sun,
  Moon,
  Menu,
  X,
  Droplet
} from 'lucide-react';

const App = () => {
  const { 
    state, 
    isOnline, 
    isAdminUnlocked, 
    unlockAdmin, 
    lockAdmin, 
    pendingWritesCount 
  } = useDb();
  
  const { showToast } = useNotification();

  // Navigation state
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Theme state — read from localStorage, fallback to system preference
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('airkasrt_theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Apply dark class on mount and when isDarkMode changes
  React.useEffect(() => {
    const root = document.documentElement;
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (isDarkMode) {
      root.classList.add('dark');
      if (metaThemeColor) metaThemeColor.setAttribute('content', '#0f172a');
    } else {
      root.classList.remove('dark');
      if (metaThemeColor) metaThemeColor.setAttribute('content', '#0f766e');
    }
  }, [isDarkMode]);

  // Mobile sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // PIN modal state
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');

  const toggleTheme = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    localStorage.setItem('airkasrt_theme', nextDark ? 'dark' : 'light');
  };

  // Auto-redirect to dashboard if admin locks while on pengaturan
  React.useEffect(() => {
    if (!isAdminUnlocked && activeTab === 'pengaturan') {
      setActiveTab('dashboard');
    }
  }, [isAdminUnlocked, activeTab]);

  const handleAdminLockToggle = () => {
    if (isAdminUnlocked) {
      lockAdmin();
      showToast('Kunci Admin berhasil ditutup.', 'info');
    } else {
      setPinInput('');
      setIsPinModalOpen(true);
    }
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    const success = unlockAdmin(pinInput);
    if (success) {
      setIsPinModalOpen(false);
      showToast('Kunci Admin berhasil dibuka!', 'success');
    } else {
      showToast('PIN salah. Silakan coba lagi.', 'error');
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, view: Dashboard },
    { id: 'warga', label: 'Data Warga', icon: Users, view: DataWarga },
    { id: 'meteran', label: 'Catat Meteran', icon: Gauge, view: PencatatanMeteran },
    { id: 'pembayaran', label: 'Terima Bayar', icon: CircleDollarSign, view: Pembayaran },
    { id: 'pengeluaran', label: 'Pengeluaran', icon: TrendingDown, view: Pengeluaran },
    { id: 'laporan', label: 'Laporan Keuangan', icon: FileText, view: LaporanKeuangan },
    { id: 'audit', label: 'Audit Log', icon: History, view: AuditLog },
    { id: 'pengaturan', label: 'Pengaturan', icon: Settings, view: Pengaturan, adminOnly: true }
  ];

  const ActiveView = navItems.find(item => item.id === activeTab)?.view || Dashboard;
  const rtName = state.settings?.nama_rt || 'RT 01 / RW 05';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex transition-colors duration-200">
      
      {/* SIDEBAR (Desktop) */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-100 border-r border-slate-800/80 transform lg:translate-x-0 transition-transform duration-305 ease-out flex flex-col no-print ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Brand */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold">
              <Droplet size={18} className="fill-teal-400/30" />
            </span>
            <div>
              <h1 className="font-extrabold text-sm tracking-wide bg-gradient-to-r from-teal-400 to-cyan-300 bg-clip-text text-transparent">
                AirKas RT
              </h1>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{rtName}</p>
            </div>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.filter(item => !item.adminOnly || isAdminUnlocked).map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsSidebarOpen(false);
                }}
                className={`w-full px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all ${
                  isActive
                    ? 'bg-teal-600/90 text-white shadow-md shadow-teal-650/15'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-white' : 'text-slate-400'} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer / Connection & Lock state */}
        <div className="p-4 border-t border-slate-850 bg-slate-950/20 space-y-2">
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
            <span className="flex items-center gap-1">
              {isOnline ? (
                <>
                  <Wifi size={12} className="text-emerald-500 animate-pulse" />
                  Cloud Terhubung
                </>
              ) : (
                <>
                  <WifiOff size={12} className="text-amber-500" />
                  Mode Offline
                </>
              )}
            </span>
            {pendingWritesCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold">
                {pendingWritesCount} pending sync
              </span>
            )}
          </div>
        </div>
      </aside>

      {/* OVERLAY for Mobile Sidebar */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-xs lg:hidden no-print"
        ></div>
      )}

      {/* MAIN VIEWPORT LAYOUT */}
      <div className="flex-1 lg:pl-64 print:pl-0 flex flex-col min-w-0">
        
        {/* HEADER BAR */}
        <header className="sticky top-0 z-20 h-16 bg-white dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-700/40 flex items-center justify-between px-6 no-print">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-sm font-bold text-slate-805 dark:text-white hidden md:block">
              {navItems.find(item => item.id === activeTab)?.label}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            {/* Admin Lock Button */}
            <button
              onClick={handleAdminLockToggle}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all flex items-center gap-1.5 shadow-sm active:scale-95 ${
                isAdminUnlocked
                  ? 'border-emerald-250 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                  : 'border-amber-250 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
              }`}
            >
              {isAdminUnlocked ? (
                <>
                  <Unlock size={12} />
                  Kunci Terbuka
                </>
              ) : (
                <>
                  <Lock size={12} />
                  Buka Kunci Admin
                </>
              )}
            </button>

            {/* Dark Mode toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-slate-205 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
            >
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>

        {/* CONTAINER VIEWPORT */}
        <main className="flex-1 p-6 print:p-0 overflow-y-auto print:overflow-visible pb-24">
          <Suspense fallback={<div className="p-6 rounded-3xl bg-white dark:bg-slate-800 shadow-sm text-slate-700 dark:text-slate-200">Memuat halaman...</div>}>
            <ActiveView />
          </Suspense>
        </main>

        {/* MOBILE BOTTOM NAV */}
        {isAdminUnlocked && (
          <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 border-t border-slate-800 px-2 py-2 backdrop-blur-md no-print">
            <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar">
              {navItems.filter(item => !item.adminOnly || isAdminUnlocked).slice(0, 6).map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex-1 min-w-[80px] rounded-2xl px-3 py-2 text-[10px] font-semibold transition-colors ${isActive ? 'bg-teal-500 text-white' : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700/80'}`}
                    aria-label={`Buka ${item.label}`}
                  >
                    <Icon size={16} className="mx-auto" />
                    <span className="block mt-1">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        )}
      </div>

      {/* ADMIN PIN CONFIRMATION MODAL */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in no-print">
          <form 
            onSubmit={handlePinSubmit}
            className="max-w-sm w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-2xl space-y-4"
          >
            <div className="text-center">
              <span className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-3">
                <Lock size={20} />
              </span>
              <h3 className="text-md font-bold text-slate-900 dark:text-white">Buka Kunci Akses Admin</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Masukkan PIN keamanan Anda untuk mengedit data transaksi dan database.
              </p>
            </div>

            <div>
              <input
                type="password"
                required
                autoFocus
                placeholder="Masukkan PIN Admin..."
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="px-3 py-2.5 w-full rounded-xl text-center font-mono font-bold text-lg tracking-widest border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsPinModalOpen(false)}
                className="px-4 py-2 w-1/2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 w-1/2 rounded-xl text-xs font-bold text-white bg-teal-605 hover:bg-teal-500 shadow-md active:scale-95 transition-all"
              >
                Buka Kunci
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

export default App;
