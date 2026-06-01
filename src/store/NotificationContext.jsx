/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const NotificationContext = createContext(null);

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotification must be used within a NotificationProvider');
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [toast, setToast] = useState(null);
  const [alert, setAlert] = useState(null);

  const showToast = useCallback((message, type = 'info', duration = 3000) => {
    setToast({ message, type });
    const timer = setTimeout(() => {
      setToast(null);
    }, duration);
    return () => clearTimeout(timer);
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      showToast('Browser Anda tidak mendukung notifikasi.', 'error');
      return false;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      showToast('Notifikasi browser diaktifkan.', 'success');
      return true;
    }

    if (permission === 'denied') {
      showToast('Notifikasi diblokir. Silakan aktifkan di pengaturan browser.', 'warning');
      return false;
    }

    showToast('Izin notifikasi tidak diaktifkan.', 'info');
    return false;
  }, [showToast]);

  const [pushSubscription, setPushSubscription] = useState(null);
  const [pushSupported, setPushSupported] = useState(false);

  useEffect(() => {
    const checkPushSupport = async () => {
      const supported = ('serviceWorker' in navigator) && ('PushManager' in window);
      setPushSupported(supported);
      if (!supported) return;

      try {
        const registration = await navigator.serviceWorker.ready;
        const existingSub = await registration.pushManager.getSubscription();
        setPushSubscription(existingSub);
      } catch (err) {
        console.warn('Gagal memeriksa status push subscription:', err);
      }
    };

    checkPushSupport();
  }, []);

  const subscribeToPushNotifications = useCallback(async () => {
    if (!pushSupported) {
      showToast('Push notification tidak didukung oleh browser ini.', 'warning');
      return false;
    }

    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || import.meta.env.VITE_PUBLIC_VAPID_KEY;
    if (!vapidKey) {
      showToast('Public VAPID key belum dikonfigurasi di environment.', 'error');
      return false;
    }

    try {
      const permissionGranted = await Notification.requestPermission();
      if (permissionGranted !== 'granted') {
        showToast('Izin notifikasi harus diberikan terlebih dahulu.', 'warning');
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      });

      setPushSubscription(subscription);
      localStorage.setItem('airkas_push_subscription', JSON.stringify(subscription.toJSON()));
      showToast('Push notification berhasil didaftarkan.', 'success');
      return true;
    } catch (err) {
      console.error('Gagal mendaftar push notification:', err);
      showToast('Gagal mendaftar push notification. Periksa kembali konfigurasi VAPID key.', 'error');
      return false;
    }
  }, [pushSupported, showToast]);

  const unsubscribePushNotifications = useCallback(async () => {
    if (!pushSupported) {
      showToast('Push notification tidak didukung oleh browser ini.', 'warning');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const existingSub = await registration.pushManager.getSubscription();
      if (!existingSub) {
        showToast('Tidak ada langganan push yang aktif.', 'info');
        return false;
      }

      const success = await existingSub.unsubscribe();
      if (success) {
        localStorage.removeItem('airkas_push_subscription');
        setPushSubscription(null);
        showToast('Push notification berhasil dibatalkan.', 'success');
      }
      return success;
    } catch (err) {
      console.error('Gagal batalkan push notification:', err);
      showToast('Gagal membatalkan langganan push notification.', 'error');
      return false;
    }
  }, [pushSupported, showToast]);

  const showBrowserNotification = useCallback(async ({ title, body, tag }) => {
    if (!('Notification' in window)) {
      showToast('Browser Anda tidak mendukung notifikasi.', 'error');
      return false;
    }

    if (Notification.permission !== 'granted') {
      showToast('Izinkan notifikasi terlebih dahulu.', 'warning');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration && registration.showNotification) {
        registration.showNotification(title, {
          body,
          tag,
          icon: '/favicon.svg',
          badge: '/favicon.svg'
        });
        return true;
      }
    } catch (err) {
      console.warn('Gagal tampilkan notifikasi lewat service worker:', err);
    }

    try {
      new Notification(title, {
        body,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        tag
      });
      return true;
    } catch (err) {
      console.error('Gagal tampilkan notifikasi:', err);
      showToast('Notifikasi gagal ditampilkan.', 'error');
      return false;
    }
  }, [showToast]);

  const showAlert = useCallback(({ title, message, type = 'info', onConfirm }) => {
    setAlert({ title, message, type, onConfirm });
  }, []);

  const closeAlert = useCallback(() => {
    setAlert(null);
  }, []);

  const handleConfirmAlert = useCallback(() => {
    if (alert?.onConfirm) {
      alert.onConfirm();
    }
    setAlert(null);
  }, [alert]);

  const getIcon = (type, size = 24) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={size} className="text-emerald-500" />;
      case 'error':
        return <XCircle size={size} className="text-rose-500" />;
      case 'warning':
        return <AlertTriangle size={size} className="text-amber-500" />;
      default:
        return <Info size={size} className="text-cyan-500" />;
    }
  };

  const getAlertColor = (type) => {
    switch (type) {
      case 'success': return 'border-emerald-500/30 bg-emerald-50/90 dark:bg-emerald-950/20';
      case 'error': return 'border-rose-500/30 bg-rose-50/90 dark:bg-rose-950/20';
      case 'warning': return 'border-amber-500/30 bg-amber-50/90 dark:bg-amber-950/20';
      default: return 'border-cyan-500/30 bg-cyan-50/90 dark:bg-cyan-950/20';
    }
  };

  return (
    <NotificationContext.Provider value={{ showToast, showAlert, requestNotificationPermission, showBrowserNotification, subscribeToPushNotifications, unsubscribePushNotifications, pushSubscription, pushSupported }}>
      {children}

      {/* TOAST SYSTEM */}
      {toast && (
        <div className="fixed top-6 right-6 z-[9999] max-w-sm w-full animate-slide-in" role="status" aria-live="polite">
          <div className="flex items-center gap-3 p-4 rounded-xl shadow-lg border border-slate-200/50 dark:border-slate-800/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
            {getIcon(toast.type, 20)}
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 flex-1">{toast.message}</p>
            <button 
              onClick={() => setToast(null)}
              className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 transition-colors"
              aria-label="Tutup notifikasi"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* MODAL ALERT SYSTEM */}
      {alert && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true">
          <div className={`max-w-md w-full rounded-2xl border p-6 shadow-2xl backdrop-blur-lg ${getAlertColor(alert.type)}`}>
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-xl bg-white/50 dark:bg-slate-800/50 shadow-sm">
                {getIcon(alert.type, 28)}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{alert.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{alert.message}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              {alert.onConfirm && (
                <button
                  onClick={closeAlert}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  Batal
                </button>
              )}
              <button
                onClick={handleConfirmAlert}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-teal-600 hover:bg-teal-500 shadow-md shadow-teal-600/25 active:scale-95 transition-all"
              >
                {alert.onConfirm ? 'Ya, Lanjutkan' : 'Ok'}
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};
