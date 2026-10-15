// src/utils/billing.js
//
// ⚠️ Berkas ini TIDAK lagi memuat logika perhitungan.
//
// Sebelumnya di sini ada salinan identik dari getWargaDeposit dan
// getWargaTunggakanLalu yang juga hidup di billingEngine.js. Akibatnya,
// perbaikan rumus di satu berkas tidak terbawa ke halaman yang mengimpor
// berkas lainnya — Dashboard dan Pembayaran bisa menampilkan angka berbeda
// untuk warga yang sama.
//
// Sekarang satu-satunya sumber rumus adalah billingEngine.js (+ cycleEngine.js).
// Berkas ini dibiarkan ada semata sebagai jalur impor lama, agar 7 berkas
// pemanggil tidak perlu disentuh.

export {
  getCycleMonthYear,
  getCycleDateRange,
  filterByrBySiklus,
  filterKlrBySiklus,
  getWargaDeposit,
  getWargaTunggakanLalu,
} from './billingEngine.js';
