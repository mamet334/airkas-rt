// src/utils/rupiahInput.js
//
// Logika kolom input nominal rupiah. Dipisahkan dari komponennya agar bisa
// diuji tanpa DOM (test berjalan di environment 'node').
//
// Aturan dasar: yang DISIMPAN selalu digit murni ("150000"), titik pemisah
// hanya hiasan tampilan. Dengan begitu Number(nilai) di tempat penyimpanan
// tetap bekerja seperti saat kolomnya masih type="number".

const grouper = new Intl.NumberFormat('id-ID');

/** Menyisakan hanya angka: "Rp 150.000" -> "150000" */
export const digitsOnly = (val) => String(val ?? '').replace(/\D/g, '');

/**
 * Membuang nol di depan, tetapi menyisakan satu nol jika memang bernilai nol.
 * "0150000" -> "150000", "0" -> "0", "000" -> "0", "" -> ""
 */
export const normalizeDigits = (val) => {
  const digits = digitsOnly(val);
  if (digits === '') return '';
  const trimmed = digits.replace(/^0+/, '');
  return trimmed === '' ? '0' : trimmed;
};

/** Menyisipkan titik ribuan untuk ditampilkan: "150000" -> "150.000" */
export const formatRibuan = (val) => {
  const digits = digitsOnly(val);
  if (digits === '') return '';
  return grouper.format(Number(digits));
};

/**
 * Menghitung posisi kursor yang benar setelah teks diformat ulang.
 *
 * Tanpa ini, menyisipkan angka di tengah ("1|5000" lalu ketik 2) akan
 * melemparkan kursor ke ujung kanan karena nilai input ditulis ulang oleh
 * React. Jadi kita tidak menyimpan posisi karakter, melainkan "kursor ada
 * setelah digit ke-N", lalu mencari ulang posisi itu di teks yang baru.
 *
 * @param {string} formatted teks hasil formatRibuan
 * @param {number} digitsBeforeCaret jumlah digit di sebelah kiri kursor
 * @returns {number} indeks karakter untuk setSelectionRange
 */
export const caretAfterDigits = (formatted, digitsBeforeCaret) => {
  if (digitsBeforeCaret <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) {
      seen++;
      if (seen === digitsBeforeCaret) return i + 1;
    }
  }
  return formatted.length;
};
