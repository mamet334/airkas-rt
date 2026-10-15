// src/utils/gantiMeterText.js
//
// Kalimat bantuan di bawah kolom "Angka Akhir Meteran Lama" pada form
// penggantian meteran. Dipisahkan dari komponennya agar tiap kondisi bisa
// diuji — termasuk kondisi salah ketik, yang paling mudah terlewat.

/**
 * @param {string|number} nilai isi kolom angka akhir meteran lama
 * @param {number} catatanTerakhir angka meteran terakhir yang tercatat
 * @returns {{ teks: string, peringatan: boolean, sisa: number }}
 */
export const keteranganAkhirMeterLama = (nilai, catatanTerakhir = 0) => {
  const terisi = String(nilai ?? '').trim() !== '';

  if (!terisi) {
    return {
      teks: 'Dikosongkan: sisa pemakaian meteran lama diabaikan, warga hanya ditagih pemakaian meteran baru.',
      peringatan: false,
      sisa: 0
    };
  }

  const angka = Number(nilai);

  if (!Number.isFinite(angka)) {
    return {
      teks: 'Angka tidak valid. Isi dengan angka meteran, atau kosongkan untuk mengabaikan.',
      peringatan: true,
      sisa: 0
    };
  }

  // Meteran air tidak bisa mundur, jadi angka yang lebih kecil dari catatan
  // terakhir hampir pasti salah ketik. Sisanya tetap dihitung 0, tetapi admin
  // perlu diberi tahu alih-alih mengira angkanya diterima apa adanya.
  if (angka < catatanTerakhir) {
    return {
      teks: `Angka ini lebih kecil dari catatan terakhir (${catatanTerakhir}) — sisa pemakaian dihitung 0. Periksa kembali angkanya.`,
      peringatan: true,
      sisa: 0
    };
  }

  const sisa = angka - catatanTerakhir;

  if (sisa === 0) {
    return {
      teks: `Sama dengan catatan terakhir (${catatanTerakhir}), jadi tidak ada tambahan pemakaian dari meteran lama.`,
      peringatan: false,
      sisa: 0
    };
  }

  return {
    teks: `Meteran lama terbaca sekali lagi: ${catatanTerakhir} → ${angka}. Sisa ${sisa} m³ ikut ditagih pada siklus ini.`,
    peringatan: false,
    sisa
  };
};
