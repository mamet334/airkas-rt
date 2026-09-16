/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from 'react';
import { useDb } from '../store/DbContext';
import { useNotification } from '../store/NotificationContext';
import { fmtRp, fmtDateTime } from '../utils/format';
import { Save, Lock, Download, Upload, RotateCcw, Bell, BellOff, Key, Database, UserPlus, Shield, CheckCircle2, Trash2 } from 'lucide-react';

const Pengaturan = () => {
  const { supabase, state, isAdminUnlocked, authUser, executeWrite, updateAdminPin, hasPin, refreshData } = useDb();
  const { showToast, showAlert, requestNotificationPermission, showBrowserNotification, subscribeToPushNotifications, unsubscribePushNotifications, pushSubscription, pushSupported } = useNotification();

  // General Profile State
  const [profileForm, setProfileForm] = useState({
    nama_rt: '',
    alamat: '',
    pengelola: ''
  });

  // Tariff State
  const [tariffForm, setTariffForm] = useState({
    tarif_per_m3: '',
    biaya_admin: ''
  });

  // PIN State
  const [pinForm, setPinForm] = useState({
    oldPin: '',
    newPin: '',
    confirmNewPin: ''
  });

  // Kelola Admin State
  const [admins, setAdmins] = useState([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [newAdminForm, setNewAdminForm] = useState({ email: '', password: '' });
  const [pendingAdminAction, setPendingAdminAction] = useState(null); // { type: 'create'|'delete', email, password?, user_id? }
  const [adminOtp, setAdminOtp] = useState('');
  const [adminBusy, setAdminBusy] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });
  const [passwordBusy, setPasswordBusy] = useState(false);

  // Load current settings from state
  useEffect(() => {
    if (state.settings) {
      setProfileForm({
        nama_rt: state.settings.nama_rt || '',
        alamat: state.settings.alamat || '',
        pengelola: state.settings.pengelola || ''
      });
      setTariffForm({
        tarif_per_m3: (state.settings.tarif_per_m3 || 8000).toString(),
        biaya_admin: (state.settings.biaya_admin || 0).toString()
      });
    }
  }, [state.settings]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profileForm.nama_rt.trim() || !profileForm.alamat.trim() || !profileForm.pengelola.trim()) {
      showToast('Harap lengkapi semua isian profil RT.', 'warning');
      return;
    }

    await executeWrite({
      table: 'settings',
      action: 'update',
      id: 1,
      data: {
        nama_rt: profileForm.nama_rt.trim(),
        alamat: profileForm.alamat.trim(),
        pengelola: profileForm.pengelola.trim()
      },
      logMsg: `Mengubah profil RT: Nama RT menjadi "${profileForm.nama_rt}", Alamat, dan Pengelola`
    });
    showToast('Profil RT berhasil diperbarui!', 'success');
  };

  const handleSaveTariff = async (e) => {
    e.preventDefault();
    const tarif = Number(tariffForm.tarif_per_m3);
    const admin = Number(tariffForm.biaya_admin);

    if (isNaN(tarif) || tarif < 0 || isNaN(admin) || admin < 0) {
      showToast('Tarif air & biaya administrasi tidak valid.', 'error');
      return;
    }

    await executeWrite({
      table: 'settings',
      action: 'update',
      id: 1,
      data: {
        tarif_per_m3: tarif,
        biaya_admin: admin
      },
      logMsg: `Mengubah kebijakan tarif: Tarif/m³ menjadi ${fmtRp(tarif)}, Biaya Admin menjadi ${fmtRp(admin)}`
    });
    showToast('Kebijakan Tarif Air berhasil diperbarui!', 'success');
  };

  const handleSavePin = async (e) => {
    e.preventDefault();
    if (pinForm.newPin.length < 4) {
      showToast('PIN baru minimal harus 4 karakter.', 'warning');
      return;
    }
    if (pinForm.newPin !== pinForm.confirmNewPin) {
      showToast('Konfirmasi PIN baru tidak cocok.', 'error');
      return;
    }

    const success = await updateAdminPin(pinForm.oldPin, pinForm.newPin);
    if (!success) {
      if (hasPin) showToast('PIN keamanan lama tidak cocok.', 'error');
      return;
    }

    showToast(hasPin ? 'PIN Keamanan Admin berhasil diubah!' : 'PIN Keamanan Admin berhasil diatur!', 'success');
    setPinForm({ oldPin: '', newPin: '', confirmNewPin: '' });
  };

  // ─── Kelola Administrator ─────────────────────────────────────────────────
  // Tambah/hapus admin wajib OTP ke email admin yang sedang login. OTP dikirim & diverifikasi
  // oleh Supabase Auth; Edge Function create-admin menolak aksi jika sesi belum lolos OTP (≤ 10 menit).
  const callAdminFunction = useCallback(async (body) => {
    const { data, error } = await supabase.functions.invoke('create-admin', { body });
    if (error) {
      let message = error.message;
      try {
        message = (await error.context.json()).error || message;
      } catch {
        // respons bukan JSON — pakai pesan bawaan
      }
      throw new Error(message);
    }
    return data;
  }, [supabase]);

  const loadAdmins = useCallback(async () => {
    setAdminsLoading(true);
    try {
      const data = await callAdminFunction({ action: 'list_admins' });
      setAdmins(data?.admins || []);
    } catch (err) {
      showToast('Gagal memuat daftar admin: ' + err.message, 'error');
    } finally {
      setAdminsLoading(false);
    }
  }, [callAdminFunction, showToast]);

  useEffect(() => {
    if (isAdminUnlocked) loadAdmins();
  }, [isAdminUnlocked, loadAdmins]);

  const sendAdminOtp = async (action) => {
    setAdminBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: authUser.email,
        options: { shouldCreateUser: false }
      });
      if (error) throw error;
      setPendingAdminAction(action);
      setAdminOtp('');
      showToast(`Kode OTP dikirim ke ${authUser.email}. Periksa inbox atau folder spam.`, 'success');
    } catch (err) {
      showToast('Gagal mengirim OTP: ' + err.message, 'error');
    } finally {
      setAdminBusy(false);
    }
  };

  const handleStartCreateAdmin = (e) => {
    e.preventDefault();
    const email = newAdminForm.email.trim().toLowerCase();
    if (!email.includes('@')) {
      showToast('Masukkan email yang valid.', 'warning');
      return;
    }
    if (newAdminForm.password.length < 8) {
      showToast('Password awal minimal 8 karakter.', 'warning');
      return;
    }
    if (admins.some(a => (a.email || '').toLowerCase() === email)) {
      showToast('Email tersebut sudah terdaftar sebagai admin.', 'warning');
      return;
    }
    sendAdminOtp({ type: 'create', email, password: newAdminForm.password });
  };

  const handleStartDeleteAdmin = (target) => {
    showAlert({
      title: 'Hapus Administrator',
      message: `Akun ${target.email} akan dihapus dan tidak bisa login lagi. Kode OTP akan dikirim ke email Anda untuk verifikasi. Lanjutkan?`,
      type: 'danger',
      onConfirm: () => sendAdminOtp({ type: 'delete', user_id: target.user_id, email: target.email })
    });
  };

  const handleCancelAdminAction = () => {
    setPendingAdminAction(null);
    setAdminOtp('');
  };

  const handleConfirmAdminOtp = async (e) => {
    e.preventDefault();
    if (!adminOtp.trim()) {
      showToast('Masukkan kode OTP.', 'warning');
      return;
    }
    setAdminBusy(true);
    try {
      const { error: otpError } = await supabase.auth.verifyOtp({
        email: authUser.email,
        token: adminOtp.trim(),
        type: 'email'
      });
      if (otpError) throw new Error('Kode OTP salah atau sudah kedaluwarsa.');

      if (pendingAdminAction.type === 'create') {
        await callAdminFunction({
          action: 'create_admin',
          email: pendingAdminAction.email,
          password: pendingAdminAction.password
        });
        showToast(`Admin ${pendingAdminAction.email} berhasil ditambahkan. Sampaikan password awal secara langsung dan minta segera diganti.`, 'success');
        setNewAdminForm({ email: '', password: '' });
      } else {
        const result = await callAdminFunction({ action: 'delete_admin', user_id: pendingAdminAction.user_id });
        showToast(`Admin ${pendingAdminAction.email} berhasil dihapus.`, 'success');
        if (result?.self) {
          await supabase.auth.signOut();
          return;
        }
      }

      setPendingAdminAction(null);
      setAdminOtp('');
      loadAdmins();
      refreshData(true);
    } catch (err) {
      showToast('Gagal: ' + err.message, 'error');
    } finally {
      setAdminBusy(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword.length < 8) {
      showToast('Password baru minimal 8 karakter.', 'warning');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showToast('Konfirmasi password tidak cocok.', 'error');
      return;
    }
    setPasswordBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.newPassword });
      if (error) throw error;
      showToast('Password akun berhasil diganti.', 'success');
      setPasswordForm({ newPassword: '', confirmPassword: '' });
    } catch (err) {
      showToast('Gagal mengganti password: ' + err.message, 'error');
    } finally {
      setPasswordBusy(false);
    }
  };

  const handleRequestNotifications = async () => {
    await requestNotificationPermission();
  };

  const handleTestNotification = async () => {
    const granted = await showBrowserNotification({
      title: 'Notifikasi Uji AirKas RT',
      body: 'Notifikasi berhasil dikirim dari Pengaturan.',
      tag: 'test-notification'
    });
    if (granted) {
      showToast('Notifikasi uji terkirim.', 'success');
    }
  };

  const handleSubscribePush = async () => {
    const success = await subscribeToPushNotifications();
    if (success) {
      showToast('Langganan push aktif. Selanjutnya gunakan server untuk mengirim payload push.', 'success');
    }
  };

  const handleUnsubscribePush = async () => {
    const success = await unsubscribePushNotifications();
    if (success) {
      showToast('Langganan push dinonaktifkan.', 'info');
    }
  };

  // BACKUP DATABASE AS JSON
  const handleBackup = () => {
    const backupContent = {
      warga: state.warga,
      meteran: state.meteran,
      pembayaran: state.pembayaran,
      pengeluaran: state.pengeluaran,
      settings: state.settings,
      audit: state.audit
    };

    const jsonStr = JSON.stringify(backupContent, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AirKas_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('File JSON cadangan offline berhasil diunduh.', 'success');
  };

  // RESTORE DATABASE FROM JSON
  const handleRestore = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (!parsed.warga || !parsed.meteran || !parsed.pembayaran || !parsed.pengeluaran || !parsed.settings) {
          throw new Error('Struktur format file JSON backup tidak cocok!');
        }

        showAlert({
          title: 'Pulihkan Basis Data?',
          message: 'Tindakan ini akan MENGHAPUS seluruh data cloud saat ini dan menimpanya dengan isi berkas backup JSON ini. Lanjutkan?',
          type: 'danger',
          onConfirm: async () => {
            // Drop current data
            for (const table of ['pembayaran', 'meteran', 'warga', 'pengeluaran']) { // audit_log append-only, tidak dihapus
              const items = state[table] || [];
              for (const item of items) {
                await executeWrite({ table, action: 'delete', id: item.id, logMsg: 'Restore cleanup' });
              }
            }

            // Restore Settings
            await executeWrite({
              table: 'settings',
              action: 'update',
              id: 1,
              data: parsed.settings,
              logMsg: 'Memulihkan setelan RT dari backup JSON'
            });

            // Restore Warga
            for (const w of parsed.warga) {
              await executeWrite({ table: 'warga', action: 'insert', data: w, logMsg: 'Restore warga' });
            }
            // Restore Meteran
            for (const m of parsed.meteran) {
              await executeWrite({ table: 'meteran', action: 'insert', data: m, logMsg: 'Restore meteran' });
            }
            // Restore Pembayaran
            for (const p of parsed.pembayaran) {
              await executeWrite({ table: 'pembayaran', action: 'insert', data: p, logMsg: 'Restore pembayaran' });
            }
            // Restore Pengeluaran
            for (const k of parsed.pengeluaran) {
              await executeWrite({ table: 'pengeluaran', action: 'insert', data: k, logMsg: 'Restore pengeluaran' });
            }

            showToast('Seluruh basis data berhasil dipulihkan dari cadangan JSON!', 'success');
            window.location.reload();
          }
        });
      } catch (err) {
        showToast('Gagal memulihkan file: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input element
  };


  const handleResetData = () => {
    showAlert({
      title: 'Reset Total Database?',
      message: 'PERINGATAN! Tindakan ini akan menghapus permanen seluruh data warga, transaksi pembayaran, meteran bulanan, kas pengeluaran, dan audit log di Supabase Cloud. Anda wajib mencadangkannya dulu!',
      type: 'danger',
      onConfirm: async () => {
        // Drop all records sequentially to avoid FK violation issues
        for (const table of ['pembayaran', 'meteran', 'warga', 'pengeluaran']) { // audit_log append-only, tidak dihapus
          const items = state[table] || [];
          for (const item of items) {
            await executeWrite({ table, action: 'delete', id: item.id, logMsg: 'Reset database wipe' });
          }
        }

        // Re-upsert default settings
        await executeWrite({
          table: 'settings',
          action: 'update',
          id: 1,
          data: {
            nama_rt: 'RT 01 / RW 05',
            tarif_per_m3: 8000,
            biaya_admin: 0,
            alamat: 'Jl. Merdeka No. 10',
            pengelola: 'Ketua RT'
          },
          logMsg: 'Menginisialisasi profil RT bawaan pasca reset'
        });

        showToast('Basis data Cloud & Cache lokal berhasil di-reset total!', 'success');
        window.location.reload();
      }
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CARD 1: GENERAL RT PROFILE */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Profil Instansi RT</h3>
            {!isAdminUnlocked && <span className="text-[10px] text-amber-500 font-bold flex items-center gap-0.5"><Lock size={10} /> Terkunci</span>}
          </div>
          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Nama RT</label>
              <input
                type="text"
                disabled={!isAdminUnlocked}
                value={profileForm.nama_rt}
                onChange={(e) => setProfileForm({ ...profileForm, nama_rt: e.target.value })}
                className="px-3 py-2 w-full rounded-xl text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Alamat Lengkap RT</label>
              <input
                type="text"
                disabled={!isAdminUnlocked}
                value={profileForm.alamat}
                onChange={(e) => setProfileForm({ ...profileForm, alamat: e.target.value })}
                className="px-3 py-2 w-full rounded-xl text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Nama Pengelola / Ketua RT</label>
              <input
                type="text"
                disabled={!isAdminUnlocked}
                value={profileForm.pengelola}
                onChange={(e) => setProfileForm({ ...profileForm, pengelola: e.target.value })}
                className="px-3 py-2 w-full rounded-xl text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 disabled:opacity-60"
              />
            </div>
            {isAdminUnlocked && (
              <button
                type="submit"
                className="px-4 py-2 w-full rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-500 shadow-md active:scale-95 transition-all flex items-center justify-center gap-1"
              >
                <Save size={14} />
                Simpan Profil RT
              </button>
            )}
          </form>
        </div>

        {/* CARD 2: TARIFF POLICY */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Kebijakan Tarif Air</h3>
            {!isAdminUnlocked && <span className="text-[10px] text-amber-500 font-bold flex items-center gap-0.5"><Lock size={10} /> Terkunci</span>}
          </div>
          <form onSubmit={handleSaveTariff} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Tarif Air per m³ (Rp)</label>
              <input
                type="number"
                disabled={!isAdminUnlocked}
                value={tariffForm.tarif_per_m3}
                onChange={(e) => setTariffForm({ ...tariffForm, tarif_per_m3: e.target.value })}
                className="px-3 py-2 w-full rounded-xl text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Biaya Administrasi Bulanan (Rp)</label>
              <input
                type="number"
                disabled={!isAdminUnlocked}
                value={tariffForm.biaya_admin}
                onChange={(e) => setTariffForm({ ...tariffForm, biaya_admin: e.target.value })}
                className="px-3 py-2 w-full rounded-xl text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 disabled:opacity-60"
              />
            </div>
            {isAdminUnlocked && (
              <button
                type="submit"
                className="px-4 py-2 w-full rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-500 shadow-md active:scale-95 transition-all flex items-center justify-center gap-1"
              >
                <Save size={14} />
                Simpan Tarif Air
              </button>
            )}
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CARD 3: SECURITY PIN */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Key size={16} />
            {hasPin ? 'Ubah PIN Keamanan Admin' : 'Atur PIN Keamanan Admin'}
          </h3>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            PIN dipakai untuk kunci layar cepat saat sesi admin aktif, dan tersimpan
            di akun Anda (berlaku di semua perangkat).
            {!hasPin && ' Selama PIN belum diatur, fitur kunci layar tidak aktif.'}
          </p>
          <form onSubmit={handleSavePin} className="space-y-3">
            {hasPin && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">PIN Lama</label>
                <input
                  type="password"
                  required
                  value={pinForm.oldPin}
                  onChange={(e) => setPinForm({ ...pinForm, oldPin: e.target.value })}
                  className="px-3 py-2 w-full rounded-xl text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-805"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">PIN Baru (Minimal 4 Angka/Karakter)</label>
              <input
                type="password"
                required
                value={pinForm.newPin}
                onChange={(e) => setPinForm({ ...pinForm, newPin: e.target.value })}
                className="px-3 py-2 w-full rounded-xl text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-805"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Ulangi PIN Baru</label>
              <input
                type="password"
                required
                value={pinForm.confirmNewPin}
                onChange={(e) => setPinForm({ ...pinForm, confirmNewPin: e.target.value })}
                className="px-3 py-2 w-full rounded-xl text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-805"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 w-full rounded-xl text-xs font-bold text-white bg-slate-700 hover:bg-slate-600 active:scale-95 transition-all"
            >
              {hasPin ? 'Ubah PIN Sekarang' : 'Atur PIN Sekarang'}
            </button>
          </form>
        </div>

        {/* CARD 4: BACKUP & DATABASE MANAGEMENT */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Database size={16} />
            Pengelolaan & Pemulihan Data
          </h3>
          
          <div className="space-y-3 pt-2">
            {/* Backup */}
            <button
              onClick={handleBackup}
              className="px-4 py-2.5 w-full rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <Download size={14} />
              Unduh Backup Basis Data (.json)
            </button>

            {/* Restore */}
            {isAdminUnlocked ? (
              <label className="px-4 py-2.5 w-full rounded-xl text-xs font-bold text-slate-750 dark:text-slate-200 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
                <Upload size={14} />
                Pulihkan dari File Backup (.json)
                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestore}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="px-4 py-2.5 w-full rounded-xl text-xs font-semibold text-slate-400 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 flex items-center justify-center gap-1.5 cursor-not-allowed">
                <Lock size={14} />
                Buka Kunci Admin untuk memulihkan database
              </div>
            )}

            {/* Notification Settings */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Notifikasi Aplikasi</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{typeof Notification !== 'undefined' ? Notification.permission : 'tidak tersedia'}</p>
                </div>
                <div className="text-xs px-2 py-1 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                  {typeof Notification !== 'undefined' ? (Notification.permission === 'granted' ? 'Aktif' : Notification.permission === 'denied' ? 'Blokir' : 'Menunggu') : 'N/A'}
                </div>
              </div>
              <button
                type="button"
                onClick={handleRequestNotifications}
                className="px-4 py-2.5 w-full rounded-xl text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5"
                aria-label="Aktifkan notifikasi browser"
              >
                <Bell size={14} />
                Aktifkan Notifikasi
              </button>
              <button
                type="button"
                onClick={handleTestNotification}
                className="px-4 py-2.5 w-full rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-500 shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5"
                aria-label="Kirim notifikasi uji"
              >
                <BellOff size={14} />
                Kirim Notifikasi Uji
              </button>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center justify-between gap-2">
                  <span>Status Push</span>
                  <span className="font-semibold">{pushSupported ? (pushSubscription ? 'Langganan Aktif' : 'Tersedia') : 'Tidak Didukung'}</span>
                </div>
                <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                  Gunakan tombol di bawah untuk mendaftar atau membatalkan langganan push notification. Jika tidak memiliki public VAPID key, cukup aktifkan notifikasi browser saja.
                </p>
              </div>
              <button
                type="button"
                onClick={pushSubscription ? handleUnsubscribePush : handleSubscribePush}
                className="px-4 py-2.5 w-full rounded-xl text-xs font-bold text-white bg-slate-700 hover:bg-slate-600 shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5"
                aria-label={pushSubscription ? 'Batalkan langganan push' : 'Daftar push notification'}
              >
                {pushSubscription ? 'Batalkan Langganan Push' : 'Daftar Push Notification'}
              </button>
            </div>


            {/* Reset Database */}
            {isAdminUnlocked ? (
              <button
                onClick={handleResetData}
                className="px-4 py-2.5 w-full rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <RotateCcw size={14} />
                Reset Total Basis Data Cloud
              </button>
            ) : (
              <div className="px-4 py-2.5 w-full rounded-xl text-xs font-semibold text-slate-400 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 flex items-center justify-center gap-1.5 cursor-not-allowed">
                <Lock size={14} />
                Buka Kunci Admin untuk mereset database
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CARD 5: KELOLA ADMIN — hanya tampil jika sudah login */}
      {authUser && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-indigo-200/60 dark:border-indigo-700/40 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Shield size={16} className="text-indigo-500" />
            Kelola Administrator
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Admin saat ini: <span className="font-semibold text-slate-700 dark:text-slate-300">{authUser.email}</span>
          </p>

          {/* Daftar administrator */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Daftar Administrator</p>
              <button
                type="button"
                onClick={loadAdmins}
                disabled={adminsLoading}
                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
              >
                Muat ulang
              </button>
            </div>
            {adminsLoading ? (
              <p className="text-[11px] text-slate-400 dark:text-slate-500">Memuat daftar admin...</p>
            ) : (
              <ul className="rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/60">
                {admins.map((a) => (
                  <li key={a.user_id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate flex items-center gap-1">
                        {a.user_id === authUser.id && <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />}
                        {a.email}
                        {a.user_id === authUser.id && <span className="font-normal text-slate-400">(Anda)</span>}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">
                        Terakhir login: {a.last_sign_in_at ? fmtDateTime(a.last_sign_in_at) : 'belum pernah'}
                      </p>
                    </div>
                    {admins.length > 1 ? (
                      <button
                        type="button"
                        title="Hapus administrator"
                        onClick={() => handleStartDeleteAdmin(a)}
                        disabled={adminBusy || !!pendingAdminAction}
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-rose-600 border border-rose-300 dark:border-rose-800 hover:text-white hover:bg-rose-600 transition-colors disabled:opacity-40 flex items-center gap-1 shrink-0"
                      >
                        <Trash2 size={12} />
                        Hapus
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                        admin terakhir
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {pendingAdminAction ? (
            /* Verifikasi OTP untuk aksi tambah/hapus */
            <form onSubmit={handleConfirmAdminOtp} className="space-y-3 p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/40">
              <p className="text-xs text-slate-700 dark:text-slate-200">
                {pendingAdminAction.type === 'create' ? 'Tambah admin ' : 'Hapus admin '}
                <strong>{pendingAdminAction.email}</strong>
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Kode OTP telah dikirim ke <strong>{authUser.email}</strong>. Masukkan kode tersebut di bawah.
              </p>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                autoFocus
                maxLength={10}
                placeholder="123456"
                value={adminOtp}
                onChange={(e) => setAdminOtp(e.target.value.replace(/\D/g, ''))}
                className="px-3 py-2 w-full rounded-xl text-center font-mono font-bold text-lg tracking-widest border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCancelAdminAction}
                  disabled={adminBusy}
                  className="px-4 py-2 w-1/3 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-60"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={adminBusy}
                  className={`px-4 py-2 w-2/3 rounded-xl text-xs font-bold text-white shadow-md active:scale-95 transition-all disabled:opacity-60 ${pendingAdminAction.type === 'delete' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}
                >
                  {adminBusy ? 'Memproses...' : 'Verifikasi & Lanjutkan'}
                </button>
              </div>
            </form>
          ) : (
            /* Form tambah admin baru */
            <form onSubmit={handleStartCreateAdmin} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Email Admin Baru
                </label>
                <input
                  type="email"
                  required
                  autoComplete="off"
                  placeholder="admin-baru@example.com"
                  value={newAdminForm.email}
                  onChange={(e) => setNewAdminForm({ ...newAdminForm, email: e.target.value })}
                  className="px-3 py-2 w-full rounded-xl text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Password Awal (min. 8 karakter)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={newAdminForm.password}
                  onChange={(e) => setNewAdminForm({ ...newAdminForm, password: e.target.value })}
                  className="px-3 py-2 w-full rounded-xl text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Kode OTP akan dikirim ke email Anda (<strong>{authUser.email}</strong>) sebagai verifikasi.
                Sampaikan password awal langsung ke admin baru dan minta segera diganti.
              </p>
              <button
                type="submit"
                disabled={adminBusy}
                className="px-4 py-2 w-full rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                <UserPlus size={14} />
                {adminBusy ? 'Mengirim OTP...' : 'Tambah Admin Baru'}
              </button>
            </form>
          )}

          {/* Ganti password akun sendiri */}
          <form onSubmit={handleChangePassword} className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-700/60">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Key size={14} />
              Ganti Password Akun Anda
            </p>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Password baru (min. 8 karakter)"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              className="px-3 py-2 w-full rounded-xl text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Ulangi password baru"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              className="px-3 py-2 w-full rounded-xl text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={passwordBusy}
              className="px-4 py-2 w-full rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-60"
            >
              {passwordBusy ? 'Menyimpan...' : 'Simpan Password Baru'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default Pengaturan;