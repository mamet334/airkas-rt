// src/utils/format.js
//
// Hanya berisi pemformatan tampilan (uang & tanggal).
// MONTHS dan getCycleMonthYear sengaja TIDAK didefinisikan ulang di sini —
// dulu berkas ini memuat salinan ketiga dari rumus siklus 15-14, di samping
// billing.js dan cycleEngine.js. Sekarang keduanya diteruskan dari
// cycleEngine.js agar hanya ada satu sumber kebenaran.

export { MONTHS, getCycleMonthYear } from './cycleEngine.js';

// Satu instance dipakai berulang; membuat Intl.NumberFormat itu mahal.
const numberId = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

/**
 * Memformat angka menjadi rupiah dengan titik ribuan: 1000 -> "Rp 1.000".
 * Spasi setelah "Rp" dipakai agar Rp 1.000 dan Rp 10.000 mudah dibedakan
 * sekilas, termasuk saat teks laporan dikirim lewat WhatsApp.
 */
export const fmtRp = (num) => {
  if (num === undefined || num === null) return 'Rp 0';
  const n = Number(num);
  if (!Number.isFinite(n)) return 'Rp 0';
  // Tanda minus ditaruh di depan "Rp" agar saldo negatif terbaca -Rp 15.000
  const sign = n < 0 ? '-' : '';
  return `${sign}Rp ${numberId.format(Math.abs(n))}`;
};

export const fmtDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

export const fmtDateTime = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
};
