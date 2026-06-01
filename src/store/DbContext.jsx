/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useNotification } from './NotificationContext';

const DbContext = createContext(null);

const SUPABASE_URL = "https://psfrkevdcuuyyefeuhps.supabase.co";
const SUPABASE_KEY = "sb_publishable_drceoz8eAEPpECcxMWx8mg_ElVgUMU2";
const CACHE_KEY = "airkasrt_pwa_cache_v1";
const QUEUE_KEY = "airkasrt_sync_queue_v1";
const MAX_QUEUE_ATTEMPTS = 4;
const BASE_RETRY_DELAY_MS = 1500;
const MAX_RETRY_DELAY_MS = 30000;
const DEFAULT_ADMIN_PIN = "slamet2026";
const ADMIN_PIN_HASH_KEY = 'airkas_admin_pin_hash';
const LEGACY_ADMIN_PIN_KEY = 'airkas_admin_pin';

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
  const [supabase] = useState(() => createClient(SUPABASE_URL, SUPABASE_KEY));

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
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(
    () => sessionStorage.getItem('airkasrt_admin_unlocked') === 'true'
  );
  const [queueLength, setQueueLength] = useState(() => {
    try {
      const q = localStorage.getItem(QUEUE_KEY);
      return q ? JSON.parse(q).length : 0;
    } catch {
      return 0;
    }
  });
  const retryTimerRef = useRef(null);
  const isSyncingRef = useRef(false);

  // Load offline cache
  const loadOfflineCache = useCallback(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        setState(prev => ({
          ...prev,
          ...cached
        }));
      }
    } catch (e) {
      console.error('Gagal membaca cache offline:', e);
    }
  }, []);

  // Save offline cache
  const saveOfflineCache = useCallback((newData) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        settings: newData.settings,
        warga: newData.warga,
        meteran: newData.meteran,
        pembayaran: newData.pembayaran,
        pengeluaran: newData.pengeluaran,
        audit: newData.audit,
        rekap: newData.rekap
      }));
    } catch (e) {
      console.error('Gagal menulis cache offline:', e);
    }
  }, []);

  // Fetch data from cloud
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

      const freshState = {
        settings: activeSettings,
        warga: w.data || [],
        meteran: m.data || [],
        pembayaran: p.data || [],
        pengeluaran: k.data || [],
        audit: a.data || [],
        rekap: rpc.data || null
      };

      setState(freshState);
      saveOfflineCache(freshState);
    } catch (e) {
      console.warn('Gagal sinkron cloud:', e.message);
      showToast('Gagal memuat data Cloud. Menggunakan cache lokal.', 'warning');
    } finally {
      setIsLoading(false);
    }
  }, [supabase, saveOfflineCache, showToast]);

  // Handle Offline Queue
  const getQueue = useCallback(() => {
    try {
      const q = localStorage.getItem(QUEUE_KEY);
      return q ? JSON.parse(q) : [];
    } catch {
      return [];
    }
  }, []);

  const saveQueue = useCallback((q) => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
    setQueueLength(q.length);
  }, []);

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const queueAction = useCallback((action) => {
    const q = getQueue();
    q.push({
      ...action,
      timestamp: Date.now(),
      attempts: 0,
      lastError: null
    });
    saveQueue(q);
    showToast('Tersimpan secara Luring (Offline)', 'info');
  }, [getQueue, saveQueue, showToast]);

  const clearQueue = useCallback(() => {
    saveQueue([]);
    clearRetryTimer();
    showToast('Antrean sinkron offline telah dibersihkan.', 'success');
  }, [saveQueue, clearRetryTimer, showToast]);

  // Sync Offline Queue to Supabase
  const syncQueue = useCallback(async function syncQueueFn() {
    if (!window.navigator.onLine || isSyncingRef.current) return;
    const q = getQueue();
    if (q.length === 0) {
      clearRetryTimer();
      return;
    }

    isSyncingRef.current = true;
    showToast('Menyinkronkan data luring ke Cloud...', 'info');

    let successCount = 0;
    let discardedCount = 0;
    const retryable = [];

    const sanitizeData = (d, t) => {
      if (!d) return d;
      const next = { ...d };
      // Map foreign keys if they were temporary UUIDs
      if (next.warga_id && idMapping[next.warga_id]) next.warga_id = idMapping[next.warga_id];
      if (next.meteran_id && idMapping[next.meteran_id]) next.meteran_id = idMapping[next.meteran_id];
      
      delete next.id;
      return next;
    };
    const PERMANENT_ERROR_CODES = ['23505', '23503', '23502', '23514', '22P02', '42P01', '42703', 'PGRST204'];

    const idMapping = {};

    for (const item of q) {
      try {
        const dbTable = item.table === 'audit' ? 'audit_log' : item.table;
        const payload = sanitizeData(item.data, dbTable);
        const mappedId = idMapping[item.id] || item.id;

        if (item.action === 'insert') {
          const { data: insertedData, error } = await supabase.from(dbTable).insert(payload).select().single();
          if (error) throw error;
          
          if (item.data.id && insertedData && insertedData.id) {
            idMapping[item.data.id] = insertedData.id;
          }
        } else if (item.action === 'update') {
          const { error } = await supabase.from(dbTable).update(payload).eq('id', mappedId);
          if (error) throw error;
        } else if (item.action === 'delete') {
          const { error } = await supabase.from(dbTable).delete().eq('id', mappedId);
          if (error) throw error;
        }
        successCount++;
      } catch (err) {
        console.error('Gagal menyinkronkan item queue:', item, err);
        const code = err?.code || err?.status || '';
        const isPermanent = PERMANENT_ERROR_CODES.includes(code);

        if (isPermanent || (item.attempts >= MAX_QUEUE_ATTEMPTS)) {
          console.warn(`Item queue dibuang (error permanen atau usaha maksimal):`, item);
          discardedCount++;
        } else {
          retryable.push({
            ...item,
            attempts: (item.attempts || 0) + 1,
            lastError: err?.message || String(err)
          });
        }
      }
    }

    saveQueue(retryable);
    clearRetryTimer();

    const retryCount = retryable.length;
    if (retryCount > 0) {
      const averageAttempts = retryable.reduce((sum, item) => sum + (item.attempts || 0), 0) / retryCount;
      const nextDelay = Math.min(BASE_RETRY_DELAY_MS * 2 ** Math.floor(averageAttempts), MAX_RETRY_DELAY_MS);
      retryTimerRef.current = setTimeout(() => {
        if (window.navigator.onLine) syncQueueFn();
      }, nextDelay);
    }

    if (successCount === q.length) {
      showToast(`Sinkronisasi berhasil! ${successCount} data diunggah.`, 'success');
    } else if (successCount > 0 || discardedCount > 0) {
      let msg = `Sinkronisasi: ${successCount} berhasil`;
      if (discardedCount > 0) msg += `, ${discardedCount} dibuang`;
      if (retryCount > 0) msg += `, ${retryCount} menunggu retry`; 
      showToast(msg, retryCount > 0 ? 'warning' : 'success');
    } else {
      showToast(`Sinkronisasi gagal. ${retryCount} data menunggu retry.`, 'warning');
    }

    if (successCount > 0) fetchData(true);
    isSyncingRef.current = false;
  }, [getQueue, saveQueue, supabase, showToast, fetchData, clearRetryTimer]);

  // Listeners for Online/Offline
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast('Koneksi internet terhubung!', 'success');
      syncQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
      showToast('Koneksi internet terputus. Aplikasi berjalan Luring.', 'warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial load
    loadOfflineCache();
    fetchData().then(() => {
      syncQueue();
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearRetryTimer();
    };
  }, [loadOfflineCache, fetchData, syncQueue, showToast, clearRetryTimer]);

  // Auth Operations
  const unlockAdmin = useCallback(async (pin) => {
    const activeHash = await getStoredAdminPinHash();
    const inputHash = await hashText(pin);
    if (inputHash === activeHash) {
      sessionStorage.setItem('airkasrt_admin_unlocked', 'true');
      setIsAdminUnlocked(true);
      showToast('Akses Admin Terbuka! Selamat bekerja.', 'success');
      return true;
    }

    showToast('PIN Salah! Akses ditolak.', 'error');
    return false;
  }, [showToast]);

  const updateAdminPin = useCallback(async (oldPin, newPin) => {
    const currentHash = await getStoredAdminPinHash();
    const oldHash = await hashText(oldPin);

    if (oldHash !== currentHash) {
      return false;
    }

    const newHash = await hashText(newPin);
    localStorage.setItem(ADMIN_PIN_HASH_KEY, newHash);
    localStorage.removeItem(LEGACY_ADMIN_PIN_KEY);
    return true;
  }, []);

  const lockAdmin = useCallback(() => {
    showAlert({
      title: 'Keluar Admin',
      message: 'Keluar dari mode Admin? Halaman akan kembali ke mode Lihat-Saja (Public View).',
      type: 'warning',
      onConfirm: () => {
        sessionStorage.removeItem('airkasrt_admin_unlocked');
        setIsAdminUnlocked(false);
        showToast('Mode Admin Ditutup', 'info');
      }
    });
  }, [showAlert, showToast]);

  // Write Operations Helper with offline fallback and auto audit log
  const executeWrite = useCallback(async ({ table, action, data, id, logMsg }) => {
    // 1. Create audit log record
    const auditRecord = {
      username: isAdminUnlocked ? 'Admin RT (Slamet)' : 'Sistem/Warga',
      aksi: action.toUpperCase(),
      detail: logMsg,
      created_at: new Date().toISOString()
    };

    // 2. Perform optimistic state update
    setState(prev => {
      const nextState = { ...prev };
      // Update Audit Logs locally
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
      
      saveOfflineCache(nextState);
      return nextState;
    });

    let returnedId = (data && data.id) ? data.id : id;

    // 3. Write to Supabase or push to Sync Queue
    if (window.navigator.onLine) {
      try {
        let dbErr = null;
        const dbTable = table === 'audit' ? 'audit_log' : table;
        const sanitizeData = (d, t) => {
          if (!d) return d;
          const next = { ...d };
          delete next.id;
          return next;
        };
        const payload = sanitizeData(data, dbTable);
        
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
              saveOfflineCache(nextState);
              return nextState;
            });
          }
        } else if (action === 'update') {
          const { error } = await supabase.from(dbTable).update(payload).eq('id', id);
          dbErr = error;
        } else if (action === 'delete') {
          const { error } = await supabase.from(dbTable).delete().eq('id', id);
          dbErr = error;
        }
        
        // Push audit log to cloud
        const dbAuditRecord = { ...auditRecord };
        delete dbAuditRecord.username; // Remove because column doesn't exist in DB
        await supabase.from('audit_log').insert(dbAuditRecord);

        if (dbErr) throw dbErr;
        showToast('Data berhasil disimpan ke Cloud', 'success');
        fetchData(true); // silent pull to keep ids/dates in perfect sync
        
        return returnedId;
      } catch (err) {
        console.warn('Gagal nulis ke Supabase, masuk antrean luring:', err);
        queueAction({ table, action, data, id });
        return returnedId;
      }
    } else {
      queueAction({ table, action, data, id });
      return returnedId;
    }
  }, [supabase, isAdminUnlocked, saveOfflineCache, showToast, queueAction, fetchData]);

  const putusKoneksi = useCallback(() => {
    showAlert({
      title: 'Hapus Cache & Reset',
      message: 'Bersihkan cache offline dan sinkronisasikan ulang data segar dari Cloud?',
      type: 'danger',
      onConfirm: () => {
        localStorage.removeItem(CACHE_KEY);
        localStorage.removeItem(QUEUE_KEY);
        window.location.reload();
      }
    });
  }, [showAlert]);

  const pendingWritesCount = queueLength;

  return (
    <DbContext.Provider value={{
      state,
      isLoading,
      isOnline,
      isAdminUnlocked,
      pendingWritesCount,
      queueLength,
      syncQueue,
      clearQueue,
      unlockAdmin,
      lockAdmin,
      updateAdminPin,
      executeWrite,
      putusKoneksi,
      refreshData: fetchData
    }}>
      {children}
    </DbContext.Provider>
  );
};
