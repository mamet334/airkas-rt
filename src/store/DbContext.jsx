/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useNotification } from './NotificationContext';

const DbContext = createContext(null);

const SUPABASE_URL = "https://psfrkevdcuuyyefeuhps.supabase.co";
const SUPABASE_KEY = "sb_publishable_drceoz8eAEPpECcxMWx8mg_ElVgUMU2";
const ADMIN_PIN_HASH_KEY = 'airkas_admin_pin_hash';
const LEGACY_ADMIN_PIN_KEY = 'airkas_admin_pin';
const DEFAULT_ADMIN_PIN = "slamet2026";
const SCREEN_LOCKED_KEY = 'airkasrt_screen_locked';

const encodeText = (text) => new TextEncoder().encode(text);
const hashText = async (text) => {
  const buffer = await crypto.subtle.digest('SHA-256', encodeText(text));
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
};

const getStoredAdminPinHash = async () => {
  const storedHash = localStorage.getItem(ADMIN_PIN_HASH_KEY);
  if (storedHash) return storedHash;

  const legacyPin = localStorage.getItem(LEGACY_ADMIN_PIN_KEY);
  if (legacyPin) {
    const converted = await hashText(legacyPin);
    localStorage.setItem(ADMIN_PIN_HASH_KEY, converted);
    localStorage.removeItem(LEGACY_ADMIN_PIN_KEY);
    return converted;
  }

  return hashText(DEFAULT_ADMIN_PIN);
};

export const useDb = () => {
  const context = useContext(DbContext);
  if (!context) throw new Error('useDb must be used within a DbProvider');
  return context;
};

export const DbProvider = ({ children }) => {
  const { showToast, showAlert } = useNotification();

  const [supabase] = useState(() => createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    }
  }));

  // Core Data States
  const [state, setState] = useState({
    settings: { tarif_per_m3: 8000, biaya_admin: 0 },
    warga: [],
    meteran: [],
    pembayaran: [],
    pengeluaran: [],
    audit: [],
    rekap: null
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(window.navigator.onLine);

  // Auth state — null = belum login, object = sudah login
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Screen lock — PIN quick-lock, hanya berlaku jika sudah login
  const [isScreenLocked, setIsScreenLocked] = useState(
    () => sessionStorage.getItem(SCREEN_LOCKED_KEY) === 'true'
  );

  // isAdminUnlocked = true hanya jika: sudah login DAN layar tidak terkunci
  const isAdminUnlocked = !!authUser && !isScreenLocked;

  // ─── Supabase Auth Listener ───────────────────────────────────────────────
  useEffect(() => {
    // Cek session awal
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null);
      setAuthLoading(false);
    });

    // Dengarkan perubahan auth (login / logout / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
      // Jika logout, pastikan screen lock juga di-reset
      if (!session) {
        setIsScreenLocked(false);
        sessionStorage.removeItem(SCREEN_LOCKED_KEY);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // ─── Fetch Data ───────────────────────────────────────────────────────────
  const fetchData = useCallback(async (silent = false) => {
    if (!window.navigator.onLine) {
      setIsLoading(false);
      return;
    }
    if (!silent) setIsLoading(true);

    try {
      const [s, w, m, p, k, a, rpc] = await Promise.all([
        supabase.from('settings').select('*').single(),
        supabase.from('warga').select('*').order('nama'),
        supabase.from('meteran').select('*').order('tahun', { ascending: false }).order('bulan', { ascending: false }).limit(2000),
        supabase.from('pembayaran').select('*').order('tanggal_bayar', { ascending: false }).limit(2000),
        supabase.from('pengeluaran').select('*').order('tanggal', { ascending: false }).limit(2000),
        supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.rpc('get_rekap_kas_total')
      ]);

      if (s.error && s.error.code !== 'PGRST116') throw s.error;
      if (w.error) throw w.error;
      if (m.error) throw m.error;
      if (p.error) throw p.error;
      if (k.error) throw k.error;
      if (a.error) throw a.error;

      // Auto update setting legacy
      let activeSettings = s.data || { id: 1, tarif_per_m3: 8000, biaya_admin: 0 };
      if (activeSettings.tarif_per_m3 === 5000 && activeSettings.biaya_admin === 3000) {
        activeSettings.tarif_per_m3 = 8000;
        activeSettings.biaya_admin = 0;
        await supabase.from('settings').update({ tarif_per_m3: 8000, biaya_admin: 0 }).eq('id', 1);
      }

      setState({
        settings: activeSettings,
        warga: w.data || [],
        meteran: m.data || [],
        pembayaran: p.data || [],
        pengeluaran: k.data || [],
        audit: a.data || [],
        rekap: rpc.data || null
      });
    } catch (e) {
      console.warn('Gagal sinkron cloud:', e.message);
      showToast('Gagal memuat data Cloud.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [supabase, showToast]);

  // ─── Online / Offline Listeners ───────────────────────────────────────────
  const isFirstRender = useRef(true);
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast('Koneksi internet terhubung!', 'success');
      fetchData(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
      showToast('Koneksi internet terputus.', 'warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (isFirstRender.current) {
      isFirstRender.current = false;
      fetchData();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchData, showToast]);

  // ─── Auth Operations ──────────────────────────────────────────────────────

  /** Login dengan email + password via Supabase Auth */
  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      showToast('Login gagal: ' + error.message, 'error');
      return false;
    }
    // Buka layar jika sebelumnya terkunci
    setIsScreenLocked(false);
    sessionStorage.removeItem(SCREEN_LOCKED_KEY);
    showToast('Selamat datang, Admin!', 'success');
    return true;
  }, [supabase, showToast]);

  /** Logout — hapus session Supabase */
  const signOut = useCallback(() => {
    showAlert({
      title: 'Keluar dari Admin',
      message: 'Anda akan keluar dari sesi admin. Untuk masuk kembali diperlukan email dan password.',
      type: 'warning',
      onConfirm: async () => {
        await supabase.auth.signOut();
        setIsScreenLocked(false);
        sessionStorage.removeItem(SCREEN_LOCKED_KEY);
        showToast('Sesi admin telah ditutup.', 'info');
      }
    });
  }, [supabase, showAlert, showToast]);

  /** Kunci layar dengan PIN — hanya berlaku jika sudah login */
  const lockScreen = useCallback(() => {
    if (!authUser) return;
    showAlert({
      title: 'Kunci Layar',
      message: 'Layar akan dikunci. Masukkan PIN untuk membuka kembali tanpa harus login ulang.',
      type: 'warning',
      onConfirm: () => {
        setIsScreenLocked(true);
        sessionStorage.setItem(SCREEN_LOCKED_KEY, 'true');
        showToast('Layar terkunci. Masukkan PIN untuk melanjutkan.', 'info');
      }
    });
  }, [authUser, showAlert, showToast]);

  /** Buka layar dengan PIN (quick-lock) — hanya jika sudah login tapi layar terkunci */
  const unlockScreen = useCallback(async (pin) => {
    const activeHash = await getStoredAdminPinHash();
    const inputHash = await hashText(pin);
    if (inputHash === activeHash) {
      setIsScreenLocked(false);
      sessionStorage.removeItem(SCREEN_LOCKED_KEY);
      showToast('Layar berhasil dibuka!', 'success');
      return true;
    }
    showToast('PIN salah! Akses ditolak.', 'error');
    return false;
  }, [showToast]);

  /** Ubah PIN quick-lock */
  const updateAdminPin = useCallback(async (oldPin, newPin) => {
    const currentHash = await getStoredAdminPinHash();
    const oldHash = await hashText(oldPin);
    if (oldHash !== currentHash) return false;
    const newHash = await hashText(newPin);
    localStorage.setItem(ADMIN_PIN_HASH_KEY, newHash);
    localStorage.removeItem(LEGACY_ADMIN_PIN_KEY);
    return true;
  }, []);

  // ─── Write Operations ──────────────────────────────────────────────────────
  const executeWrite = useCallback(async ({ table, action, data, id, logMsg }) => {
    if (!window.navigator.onLine) {
      showToast('Aksi gagal: Tidak ada koneksi internet. Silakan hubungkan perangkat Anda.', 'error');
      return;
    }

    // 1. Create audit log record
    const auditRecord = {
      username: isAdminUnlocked ? `Admin (${authUser?.email || 'Admin RT'})` : 'Sistem/Warga',
      aksi: action.toUpperCase(),
      detail: logMsg,
      created_at: new Date().toISOString()
    };

    // ✅ ANTI DUPLIKAT SERVER-SIDE: Cek Supabase sebelum insert pembayaran PATUNGAN
    if (table === 'pembayaran' && action === 'insert' && data?.keterangan?.includes('[PATUNGAN]')) {
      try {
        const { data: existing } = await supabase
          .from('pembayaran')
          .select('id')
          .eq('warga_id', data.warga_id)
          .eq('bulan', data.bulan)
          .eq('tahun', data.tahun)
          .ilike('keterangan', '%[PATUNGAN]%')
          .limit(1);

        if (existing && existing.length > 0) {
          const dupDetail = `⛔ DUPLIKAT SERVER DITOLAK: Patungan warga_id ${data.warga_id} periode ${data.bulan}/${data.tahun} sudah ada (existing id: ${existing[0].id}). Insert dibatalkan.`;
          showToast('⛔ Duplikat terdeteksi di server! Patungan warga ini sudah tercatat di periode yang sama. Transaksi dibatalkan.', 'error');
          await supabase.from('audit_log').insert({ aksi: 'BLOCKED', detail: dupDetail, created_at: new Date().toISOString() });
          return data.id;
        }
      } catch (dupErr) {
        console.warn('Gagal cek duplikat patungan, lanjutkan insert:', dupErr);
      }
    }

    // 2. Perform optimistic state update
    setState(prev => {
      const nextState = { ...prev };
      nextState.audit = [auditRecord, ...nextState.audit].slice(0, 100);

      if (table === 'warga') {
        if (action === 'insert') nextState.warga = [...nextState.warga, data].sort((a,b) => a.nama.localeCompare(b.nama));
        if (action === 'update') nextState.warga = nextState.warga.map(w => w.id === id ? { ...w, ...data } : w);
        if (action === 'delete') nextState.warga = nextState.warga.filter(w => w.id !== id);
      } else if (table === 'meteran') {
        if (action === 'insert') nextState.meteran = [data, ...nextState.meteran];
        if (action === 'update') nextState.meteran = nextState.meteran.map(m => m.id === id ? { ...m, ...data } : m);
        if (action === 'delete') nextState.meteran = nextState.meteran.filter(m => m.id !== id);
      } else if (table === 'pembayaran') {
        if (action === 'insert') nextState.pembayaran = [data, ...nextState.pembayaran];
        if (action === 'update') nextState.pembayaran = nextState.pembayaran.map(p => p.id === id ? { ...p, ...data } : p);
        if (action === 'delete') nextState.pembayaran = nextState.pembayaran.filter(p => p.id !== id);
      } else if (table === 'pengeluaran') {
        if (action === 'insert') nextState.pengeluaran = [data, ...nextState.pengeluaran];
        if (action === 'update') nextState.pengeluaran = nextState.pengeluaran.map(k => k.id === id ? { ...k, ...data } : k);
        if (action === 'delete') nextState.pengeluaran = nextState.pengeluaran.filter(k => k.id !== id);
      } else if (table === 'settings') {
        if (action === 'update') nextState.settings = { ...nextState.settings, ...data };
      } else if (table === 'audit') {
        if (action === 'delete') {
          if (id) {
            nextState.audit = nextState.audit.filter(log => log.id !== id);
          } else {
            nextState.audit = [];
          }
        }
      }

      return nextState;
    });

    let returnedId = (data && data.id) ? data.id : id;

    // 3. Write to Supabase
    try {
      let dbErr = null;
      const dbTable = table === 'audit' ? 'audit_log' : table;
      const sanitizeData = (d) => {
        if (!d) return d;
        const next = { ...d };
        delete next.id;
        return next;
      };
      const payload = sanitizeData(data);

      if (action === 'insert') {
        const { data: insertedData, error } = await supabase.from(dbTable).insert(payload).select().single();
        dbErr = error;

        if (insertedData && insertedData.id && data.id) {
          returnedId = insertedData.id;
          setState(prev => {
            const nextState = { ...prev };
            if (table === 'warga') nextState.warga = nextState.warga.map(w => w.id === data.id ? { ...w, id: insertedData.id } : w);
            if (table === 'meteran') nextState.meteran = nextState.meteran.map(m => m.id === data.id ? { ...m, id: insertedData.id } : m);
            if (table === 'pembayaran') nextState.pembayaran = nextState.pembayaran.map(p => p.id === data.id ? { ...p, id: insertedData.id } : p);
            if (table === 'pengeluaran') nextState.pengeluaran = nextState.pengeluaran.map(k => k.id === data.id ? { ...k, id: insertedData.id } : k);
            return nextState;
          });
        }
      } else if (action === 'update' || action === 'delete') {
        // RLS yang menolak UPDATE/DELETE tidak mengembalikan error, hanya 0 baris.
        // .select() mengembalikan baris yang benar-benar berubah agar penolakan terdeteksi.
        const query = action === 'update'
          ? supabase.from(dbTable).update(payload).eq('id', id)
          : supabase.from(dbTable).delete().eq('id', id);
        const { data: affected, error } = await query.select('id');
        dbErr = error;
        if (!dbErr && (!affected || affected.length === 0)) {
          dbErr = new Error('Perubahan ditolak server (0 baris). Sesi admin mungkin sudah habis — silakan login ulang.');
        }
      }

      if (dbErr) throw dbErr;

      // Push audit log to cloud (hanya setelah penulisan utama benar-benar berhasil)
      const dbAuditRecord = { ...auditRecord };
      delete dbAuditRecord.username;
      const { error: auditErr } = await supabase.from('audit_log').insert(dbAuditRecord);
      if (auditErr) console.warn('Gagal mencatat audit log:', auditErr);
      showToast('Data berhasil disimpan ke Cloud', 'success');
      fetchData(true);

      return returnedId;
    } catch (err) {
      console.warn('Gagal nulis ke Supabase:', err);
      showToast(`Gagal menyimpan data ke server: ${err.message || 'periksa koneksi internet.'}`, 'error');
      fetchData(true);
      throw err;
    }
  }, [supabase, isAdminUnlocked, authUser, showToast, fetchData]);

  const putusKoneksi = useCallback(() => {
    showAlert({
      title: 'Muat Ulang Aplikasi',
      message: 'Muat ulang aplikasi untuk memuat data terbaru dari Cloud?',
      type: 'info',
      onConfirm: () => {
        window.location.reload();
      }
    });
  }, [showAlert]);

  return (
    <DbContext.Provider value={{
      state,
      isLoading,
      authLoading,
      isOnline,
      authUser,
      isAdminUnlocked,
      isScreenLocked,
      signIn,
      signOut,
      lockScreen,
      unlockScreen,
      updateAdminPin,
      executeWrite,
      putusKoneksi,
      refreshData: fetchData
    }}>
      {children}
    </DbContext.Provider>
  );
};
