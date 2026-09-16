// Mesin chatbot warga — berbasis kata kunci, tanpa AI dan tanpa akses tulis.
//
// Semua angka dihitung dari data yang sama dengan Dashboard/Laporan memakai util
// resmi (cycleEngine + billingEngine), supaya tidak ada "versi perhitungan kedua"
// yang hasilnya bisa berbeda dari laporan.
//
// Siklus tagihan mengikuti aturan aplikasi: 15 bulan lalu - 14 bulan ini.
// Untuk tagihan per warga, acuannya adalah halaman Pembayaran: meteran periode B
// adalah baris meteran dengan bulan = B (bukan B-1), dan tunggakan dihitung dari
// periode sebelum B — supaya tagihan periode berjalan tidak terhitung dua kali.

import { fmtRp, fmtDate } from '../../utils/format';
import { MONTHS, getCycleTarget, getCycleLabel } from '../../utils/cycleEngine';
import {
  getWargaBillingSummary,
  evaluatePaymentStatus,
  filterByrBySiklus,
  filterKlrBySiklus
} from '../../utils/billingEngine';

// Kata yang tidak boleh dianggap sebagai nama warga saat pencocokan
const KATA_UMUM = new Set([
  'pak', 'bapak', 'bu', 'ibu', 'mas', 'mbak', 'kang', 'om', 'tante', 'saudara',
  'saldo', 'kas', 'uang', 'duit', 'berapa', 'sisa', 'total', 'jumlah',
  'tagihan', 'bayar', 'bayaran', 'membayar', 'dibayar', 'lunas', 'nunggak',
  'tunggakan', 'utang', 'hutang', 'riwayat', 'histori', 'history', 'catatan',
  'siapa', 'saja', 'yang', 'belum', 'sudah', 'punya', 'masih', 'ada',
  'pengeluaran', 'keluar', 'pemasukan', 'masuk', 'biaya', 'dana',
  'bulan', 'tahun', 'ini', 'lalu', 'kemarin', 'sekarang', 'periode',
  'air', 'warga', 'data', 'info', 'tolong', 'mohon', 'apa', 'kah',
  'bantuan', 'help', 'menu', 'halo', 'hai', 'permisi',
  ...MONTHS.filter(Boolean).map(m => m.toLowerCase())
]);

export const normalize = (teks) =>
  String(teks || '').toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();

const mengandung = (teks, daftar) => daftar.some(k => teks.includes(k));

/** Tentukan maksud pertanyaan dari kata kunci */
export const detectIntent = (teks) => {
  const t = normalize(teks);
  if (!t) return 'tidak_paham';

  // Kata sapaan/bantuan dicek dengan batas kata, agar "siapa saja" tidak
  // tertangkap sebagai "apa saja"
  if (/\b(bantuan|help|menu|halo|hai|assalamualaikum)\b/.test(t)) return 'bantuan';
  if (mengandung(t, ['bisa apa', 'bisa bantu apa'])) return 'bantuan';

  if (mengandung(t, ['belum bayar', 'belum lunas', 'nunggak', 'menunggak', 'penunggak'])) return 'belum_bayar';
  if (mengandung(t, ['riwayat', 'histori', 'history', 'catatan bayar'])) return 'riwayat_bayar';
  if (mengandung(t, ['pengeluaran', 'uang keluar', 'belanja', 'biaya keluar'])) return 'total_pengeluaran';
  if (mengandung(t, ['pemasukan', 'uang masuk', 'pendapatan'])) return 'total_pemasukan';
  if (mengandung(t, ['saldo', 'kas berapa', 'uang kas', 'sisa kas', 'kas rt'])) return 'saldo_kas';
  if (mengandung(t, ['tagihan', 'bayar berapa', 'harus bayar', 'utang', 'hutang', 'tunggakan'])) return 'cek_tagihan';
  if (mengandung(t, ['kas'])) return 'saldo_kas';

  return 'tidak_paham';
};

/** Ambil periode (siklus) dari teks; default = siklus berjalan */
export const parsePeriod = (teks, hariIni = new Date()) => {
  const t = normalize(teks);
  const sekarang = getCycleTarget(hariIni);
  let { month, year } = sekarang;

  const namaBulan = MONTHS.findIndex((m, i) => i > 0 && t.includes(m.toLowerCase()));
  if (namaBulan > 0) month = namaBulan;

  const thn = t.match(/\b(20\d{2})\b/);
  if (thn) year = Number(thn[1]);

  if (namaBulan < 1 && mengandung(t, ['bulan lalu', 'bulan kemarin'])) {
    month = month === 1 ? 12 : month - 1;
    if (month === 12) year -= 1;
  }

  return { month, year };
};

/** Cari warga dari teks bebas (tidak peka huruf besar/kecil) */
export const findWarga = (teks, wargaList = []) => {
  const t = normalize(teks);
  const kandidat = (wargaList || []).filter(w => w && w.nama && w.alamat !== 'SISTEM');

  // 1. Nama lengkap muncul utuh di pertanyaan — ambil yang paling panjang
  const cocokPenuh = kandidat
    .filter(w => t.includes(normalize(w.nama)))
    .sort((a, b) => normalize(b.nama).length - normalize(a.nama).length);
  if (cocokPenuh.length > 0) return { match: cocokPenuh[0], candidates: [] };

  // 2. Cocokkan per kata (mis. "pak bowo" -> "bowo")
  const kataTanya = t.split(' ').filter(k => k.length >= 3 && !KATA_UMUM.has(k));
  const cocokSebagian = kandidat.filter(w =>
    normalize(w.nama).split(' ').some(kn => kn.length >= 3 && kataTanya.includes(kn))
  );

  if (cocokSebagian.length === 1) return { match: cocokSebagian[0], candidates: [] };
  if (cocokSebagian.length > 1) return { match: null, candidates: cocokSebagian };
  return { match: null, candidates: [] };
};

// ─── Jawaban per intent ─────────────────────────────────────────────────────

const jawabSaldoKas = (state) => {
  const rekap = state.rekap;
  const masuk = rekap ? rekap.total_bayar : state.pembayaran.reduce((s, p) => s + p.jumlah_bayar, 0);
  const keluar = rekap ? rekap.total_keluar : state.pengeluaran.reduce((s, k) => s + k.jumlah, 0);
  const saldo = rekap ? rekap.kas_rt_bersih : masuk - keluar;

  let teks = `Saldo kas RT saat ini: ${fmtRp(saldo)}\n` +
    `• Total uang masuk: ${fmtRp(masuk)}\n` +
    `• Total uang keluar: ${fmtRp(keluar)}`;

  if (rekap && rekap.saldo_awal) teks += `\n• Saldo awal: ${fmtRp(rekap.saldo_awal)}`;
  if (rekap && rekap.kas_patungan_bersih !== undefined) {
    teks += `\n\nKas patungan (perbaikan mesin): ${fmtRp(rekap.kas_patungan_bersih)}`;
  }
  return teks;
};

/** Hitung tagihan satu warga untuk satu periode — cara yang sama dengan halaman Pembayaran */
const hitungTagihanWarga = (wargaId, month, year, state) => {
  const meteran = state.meteran.find(m => m.warga_id === wargaId && m.bulan === month && m.tahun === year);
  const rawTagihan = meteran ? meteran.total_tagihan : 0;
  const sudahBayar = meteran
    ? state.pembayaran
      .filter(p => p.meteran_id === meteran.id && p.bulan === month && p.tahun === year)
      .reduce((s, p) => s + p.jumlah_bayar, 0)
    : 0;

  const ringkas = getWargaBillingSummary(wargaId, rawTagihan, sudahBayar, month, year, state);
  return { meteran, sudahBayar, ringkas };
};

const pesanNamaTidakJelas = (candidates, contoh) => {
  if (candidates.length > 0) {
    return `Ada beberapa nama yang cocok: ${candidates.map(w => w.nama).join(', ')}.\n` +
      'Sebutkan namanya lebih lengkap ya.';
  }
  return `Nama warganya belum saya kenali. Contoh: "${contoh}"`;
};

const jawabTagihan = (teks, state, hariIni) => {
  const { match, candidates } = findWarga(teks, state.warga);
  if (!match) return pesanNamaTidakJelas(candidates, 'tagihan Bowo berapa?');

  const { month, year } = parsePeriod(teks, hariIni);
  const { meteran, sudahBayar, ringkas } = hitungTagihanWarga(match.id, month, year, state);
  const status = evaluatePaymentStatus(ringkas.tagihan, sudahBayar, ringkas.deposit);
  const sisa = Math.max(0, ringkas.sisa);

  let hasil = `Tagihan ${match.nama} — periode ${getCycleLabel(month, year)}\n`;
  hasil += meteran
    ? `• Pemakaian: ${meteran.pemakaian} m³\n`
    : `• Meteran ${MONTHS[month]} ${year} belum dicatat\n`;
  hasil += `• Tagihan periode ini: ${fmtRp(ringkas.tagihan)}\n`;
  hasil += `• Sudah dibayar: ${fmtRp(sudahBayar)}\n`;
  if (ringkas.tunggakanLalu > 0) hasil += `• Tunggakan sebelumnya: ${fmtRp(ringkas.tunggakanLalu)}\n`;
  if (ringkas.deposit > 0) hasil += `• Deposit (kelebihan bayar): ${fmtRp(ringkas.deposit)}\n`;
  hasil += `• Sisa yang harus dibayar: ${fmtRp(sisa)}\n`;
  hasil += `• Status: ${status}`;

  return hasil;
};

const jawabRiwayat = (teks, state) => {
  const { match, candidates } = findWarga(teks, state.warga);
  if (!match) return pesanNamaTidakJelas(candidates, 'riwayat bayar Bowo');

  const semua = state.pembayaran.filter(p => p.warga_id === match.id);
  if (semua.length === 0) return `Belum ada catatan pembayaran atas nama ${match.nama}.`;

  const riwayat = [...semua]
    .sort((a, b) => new Date(b.tanggal_bayar) - new Date(a.tanggal_bayar))
    .slice(0, 10);

  const baris = riwayat.map(p => {
    const ket = p.keterangan ? ` (${p.keterangan})` : '';
    return `• ${fmtDate(p.tanggal_bayar)} — ${fmtRp(p.jumlah_bayar)}${ket}`;
  });

  const total = semua.reduce((s, p) => s + p.jumlah_bayar, 0);

  return `Riwayat pembayaran ${match.nama} (${riwayat.length} terakhir dari ${semua.length}):\n` +
    `${baris.join('\n')}\n\nTotal seluruh pembayaran: ${fmtRp(total)}`;
};

const jawabBelumBayar = (teks, state, hariIni) => {
  const { month, year } = parsePeriod(teks, hariIni);

  const daftar = state.warga
    .filter(w => w.aktif && w.alamat !== 'SISTEM' && !w.adalah_pengelola)
    .map(w => {
      const { ringkas } = hitungTagihanWarga(w.id, month, year, state);
      return { nama: w.nama, sisa: Math.max(0, ringkas.sisa) };
    })
    .filter(w => w.sisa > 0)
    .sort((a, b) => b.sisa - a.sisa);

  if (daftar.length === 0) {
    return `Tidak ada tunggakan sampai periode ${getCycleLabel(month, year)}.`;
  }

  const total = daftar.reduce((s, w) => s + w.sisa, 0);
  const baris = daftar.map((w, i) => `${i + 1}. ${w.nama} — ${fmtRp(w.sisa)}`);

  return `Warga yang masih punya tunggakan sampai periode ${getCycleLabel(month, year)} ` +
    `(${daftar.length} orang):\n${baris.join('\n')}\n\nTotal tunggakan: ${fmtRp(total)}`;
};

const jawabPengeluaran = (teks, state, hariIni) => {
  const t = normalize(teks);

  if (mengandung(t, ['semua', 'keseluruhan', 'sejak awal'])) {
    const total = state.pengeluaran.reduce((s, k) => s + k.jumlah, 0);
    return `Total pengeluaran sejak awal: ${fmtRp(total)} dari ${state.pengeluaran.length} transaksi.`;
  }

  const { month, year } = parsePeriod(teks, hariIni);
  const daftar = filterKlrBySiklus(state.pengeluaran, month, year);
  if (daftar.length === 0) return `Belum ada pengeluaran pada periode ${getCycleLabel(month, year)}.`;

  const total = daftar.reduce((s, k) => s + k.jumlah, 0);
  const perKategori = {};
  daftar.forEach(k => {
    const kat = k.kategori || 'Lainnya';
    perKategori[kat] = (perKategori[kat] || 0) + k.jumlah;
  });
  const rincian = Object.entries(perKategori)
    .sort((a, b) => b[1] - a[1])
    .map(([kat, jml]) => `• ${kat}: ${fmtRp(jml)}`);

  return `Pengeluaran periode ${getCycleLabel(month, year)}: ${fmtRp(total)} ` +
    `(${daftar.length} transaksi)\n${rincian.join('\n')}`;
};

const jawabPemasukan = (teks, state, hariIni) => {
  const { month, year } = parsePeriod(teks, hariIni);
  const daftar = filterByrBySiklus(state.pembayaran, month, year);
  if (daftar.length === 0) return `Belum ada pemasukan pada periode ${getCycleLabel(month, year)}.`;

  const total = daftar.reduce((s, p) => s + p.jumlah_bayar, 0);
  return `Pemasukan periode ${getCycleLabel(month, year)}: ${fmtRp(total)} dari ${daftar.length} pembayaran.`;
};

export const BANTUAN = 'Saya bisa bantu menjawab soal keuangan air RT:\n' +
  '• "saldo kas berapa"\n' +
  '• "tagihan Bowo berapa"\n' +
  '• "riwayat bayar Bowo"\n' +
  '• "siapa yang belum bayar"\n' +
  '• "pengeluaran bulan Agustus"\n' +
  '• "pemasukan bulan ini"\n\n' +
  'Saya hanya membaca data — tidak bisa mengubah apa pun.';

/**
 * Jawab pertanyaan warga.
 * @returns {{ intent: string, text: string }}
 */
export const answerQuestion = (pertanyaan, state, hariIni = new Date()) => {
  const intent = detectIntent(pertanyaan);

  if (!state || !Array.isArray(state.warga)) {
    return { intent, text: 'Data belum selesai dimuat. Coba lagi sebentar lagi ya.' };
  }

  switch (intent) {
    case 'bantuan': return { intent, text: BANTUAN };
    case 'saldo_kas': return { intent, text: jawabSaldoKas(state) };
    case 'cek_tagihan': return { intent, text: jawabTagihan(pertanyaan, state, hariIni) };
    case 'riwayat_bayar': return { intent, text: jawabRiwayat(pertanyaan, state) };
    case 'belum_bayar': return { intent, text: jawabBelumBayar(pertanyaan, state, hariIni) };
    case 'total_pengeluaran': return { intent, text: jawabPengeluaran(pertanyaan, state, hariIni) };
    case 'total_pemasukan': return { intent, text: jawabPemasukan(pertanyaan, state, hariIni) };
    default: {
      // Nama warga disebut tanpa kata kunci -> anggap menanyakan tagihan
      const { match } = findWarga(pertanyaan, state.warga);
      if (match) return { intent: 'cek_tagihan', text: jawabTagihan(pertanyaan, state, hariIni) };
      return { intent: 'tidak_paham', text: `Maaf, saya belum paham pertanyaannya.\n\n${BANTUAN}` };
    }
  }
};
