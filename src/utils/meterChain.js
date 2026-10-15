// src/utils/meterChain.js
//
// Menentukan angka "meter lalu" sebuah warga pada satu siklus, dengan
// memperhitungkan penggantian meteran fisik.
//
// Masalah yang diselesaikan: saat meteran rusak diganti, meteran baru mulai
// dari 0 (atau angka kecil). Kalau "meter lalu" tetap diambil dari angka
// meteran lama, pemakaian jadi negatif dan pencatatan ditolak.
//
// Aturan tunggal yang berlaku untuk semua warga, berapa kali pun berganti:
//
//   barisTerakhir = baris meteran warga terbaru dengan periode < periode ini
//   eventTerakhir = penggantian warga terbaru dengan periode <= periode ini
//
//   jika eventTerakhir ada DAN lebih baru dari barisTerakhir
//        -> meter lalu = eventTerakhir.meter_awal_baru   (rantai baru)
//   selain itu
//        -> meter lalu = barisTerakhir.meter_sekarang    (rantai berjalan)
//
// Baris meteran periode lampau tidak pernah disentuh, sehingga riwayat
// tagihan dan laporan lama tetap utuh (terarsip dengan sendirinya).

import { getCycleTarget } from './cycleEngine.js';

/** Mengubah (bulan, tahun) jadi satu angka agar bisa dibandingkan dan diurutkan. */
export const periodKey = (bulan, tahun) => Number(tahun) * 12 + Number(bulan);

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Siklus sesudahnya, dengan pergantian tahun. */
export const periodeBerikutnya = (bulan, tahun) => (
  bulan === 12 ? { bulan: 1, tahun: tahun + 1 } : { bulan: bulan + 1, tahun }
);

/**
 * Menentukan siklus tempat sebuah penggantian meteran mulai berlaku.
 *
 * Dasarnya siklus tempat tanggal penggantian jatuh. Tetapi bila pencatatan
 * siklus itu SUDAH dilakukan, berarti meteran lama sempat dibaca untuk
 * terakhir kalinya dan tagihannya sudah terbit; meteran baru baru akan
 * terbaca pada pembacaan berikutnya. Dalam hal itu penggantian berlaku
 * mulai siklus sesudahnya.
 *
 * Contoh nyata (Sukiono): meteran dibaca 15 Okt (114 -> 123, siklus Oktober,
 * sudah ditagih), lalu meteran fisik diganti pada hari yang sama. Pembacaan
 * meteran baru baru terjadi 14 Nov, sehingga penggantian berlaku mulai
 * siklus November — bukan Oktober yang angkanya sudah final.
 */
export const siklusEfektifPenggantian = (wargaId, tanggal, meteran = []) => {
  const { month, year } = getCycleTarget(tanggal);
  const sudahDicatat = meteran.some(
    m => m.warga_id === wargaId && m.bulan === month && m.tahun === year
  );
  return sudahDicatat ? periodeBerikutnya(month, year) : { bulan: month, tahun: year };
};

/** Baris meteran warga terbaru SEBELUM periode yang diminta. */
export const findBarisTerakhir = (wargaId, bulan, tahun, meteran = []) => {
  const batas = periodKey(bulan, tahun);
  let hasil = null;
  let hasilKey = -Infinity;

  for (const m of meteran) {
    if (m.warga_id !== wargaId) continue;
    const key = periodKey(m.bulan, m.tahun);
    if (key >= batas) continue;
    if (key > hasilKey) {
      hasil = m;
      hasilKey = key;
    }
  }
  return hasil;
};

/**
 * Event penggantian warga terbaru sampai dengan periode yang diminta.
 * Dipakai "sampai dengan", bukan "sebelum", supaya penggantian yang terjadi
 * pada siklus ini sendiri langsung berlaku.
 */
export const findPenggantianTerakhir = (wargaId, bulan, tahun, penggantian = []) => {
  const batas = periodKey(bulan, tahun);
  let hasil = null;
  let hasilKey = -Infinity;

  for (const g of penggantian) {
    if (g.warga_id !== wargaId) continue;
    const key = periodKey(g.bulan, g.tahun);
    if (key > batas) continue;
    // Bila ada dua event pada siklus yang sama, yang terakhir dibuat menang.
    if (key > hasilKey || (key === hasilKey && toNum(g.id) > toNum(hasil?.id))) {
      hasil = g;
      hasilKey = key;
    }
  }
  return hasil;
};

/**
 * Menghitung dasar perhitungan satu baris pencatatan meteran.
 *
 * @returns {{
 *   meterLalu: number,            angka pembanding untuk meter sekarang
 *   meterSebelumGanti: number,    angka terakhir meteran LAMA yang tercatat
 *   penggantian: object|null,     event yang berlaku DI siklus ini saja
 *   pemakaianMeterLama: number,   sisa pemakaian meteran lama yang ikut ditagih
 *   isRantaiBaru: boolean         true jika siklus ini memulai meteran baru
 * }}
 */
export const resolveMeterLalu = (wargaId, bulan, tahun, { meteran = [], penggantian = [] } = {}) => {
  const barisTerakhir = findBarisTerakhir(wargaId, bulan, tahun, meteran);
  const eventTerakhir = findPenggantianTerakhir(wargaId, bulan, tahun, penggantian);

  const meterSebelumGanti = barisTerakhir ? toNum(barisTerakhir.meter_sekarang) : 0;

  const eventLebihBaru =
    eventTerakhir &&
    (!barisTerakhir ||
      periodKey(eventTerakhir.bulan, eventTerakhir.tahun) > periodKey(barisTerakhir.bulan, barisTerakhir.tahun));

  if (!eventLebihBaru) {
    // Siklus normal: lanjutkan rantai meteran yang sedang berjalan.
    return {
      meterLalu: meterSebelumGanti,
      meterSebelumGanti,
      penggantian: null,
      pemakaianMeterLama: 0,
      isRantaiBaru: false
    };
  }

  // Event hanya "milik" siklus ini bila periodenya memang siklus ini.
  // Untuk siklus-siklus sesudahnya, rantai baru sudah berjalan normal dan
  // sisa pemakaian meteran lama tidak boleh ditagih dua kali.
  const eventDiSiklusIni = periodKey(eventTerakhir.bulan, eventTerakhir.tahun) === periodKey(bulan, tahun);

  // Sisa pemakaian meteran lama hanya dihitung bila angka akhirnya dicatat.
  // Dikosongkan = diabaikan, sesuai pilihan admin saat mengisi form.
  const adaAngkaAkhir =
    eventDiSiklusIni &&
    eventTerakhir.meter_akhir_lama !== null &&
    eventTerakhir.meter_akhir_lama !== undefined &&
    eventTerakhir.meter_akhir_lama !== '';

  const pemakaianMeterLama = adaAngkaAkhir
    ? Math.max(0, toNum(eventTerakhir.meter_akhir_lama) - meterSebelumGanti)
    : 0;

  return {
    meterLalu: toNum(eventTerakhir.meter_awal_baru),
    meterSebelumGanti,
    penggantian: eventDiSiklusIni ? eventTerakhir : null,
    pemakaianMeterLama,
    isRantaiBaru: eventDiSiklusIni
  };
};

/**
 * Total pemakaian yang ditagih pada satu siklus.
 * Pada siklus normal sama dengan (sekarang - lalu); pada siklus penggantian
 * ditambah sisa pemakaian meteran lama bila angkanya dicatat.
 */
export const hitungPemakaian = (meterSekarang, meterLalu, pemakaianMeterLama = 0) =>
  Math.max(0, toNum(meterSekarang) - toNum(meterLalu)) + Math.max(0, toNum(pemakaianMeterLama));
