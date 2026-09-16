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
  'rincian', 'detail', 'pemakaian', 'kubik', 'tarif', 'harga', 'laporan',
  'ringkasan', 'rekap', 'kapan', 'terakhir', 'aktif', 'orang',
  ...MONTHS.filter(Boolean).map(m => m.toLowerCase())
]);

export const normalize = (teks) =>
  String(teks || '').toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();

const mengandung = (teks, daftar) => daftar.some(k => teks.includes(k));

/** Tentukan maksud pertanyaan dari kata kunci */
export const detectIntent = (teks) => {
  const t = normalize(teks);
  if (!t) return 'tidak_paham';

  // Sapaan/bantuan dicek dengan batas kata agar "siapa saja" tidak tertangkap
  if (/\b(bantuan|help|menu|halo|hai|assalamualaikum)\b/.test(t)) return 'bantuan';
  if (mengandung(t, ['bisa apa', 'bisa bantu apa'])) return 'bantuan';

  const soalTunggakan = mengandung(t, ['belum bayar', 'belum lunas', 'nunggak', 'menunggak', 'penunggak']);
  if (soalTunggakan && mengandung(t, ['rincian', 'detail', 'lengkap'])) return 'rincian_belum_bayar';
  if (soalTunggakan) return 'belum_bayar';

  if (mengandung(t, ['sudah bayar', 'sudah lunas', 'yang lunas', 'siapa lunas'])) return 'sudah_bayar';

  if (mengandung(t, ['pemakaian', 'kubik', 'm3', 'meteran'])) return 'pemakaian_air';
  if (mengandung(t, ['tarif', 'harga air', 'biaya admin'])) return 'tarif';
  if (mengandung(t, ['laporan', 'ringkasan', 'rekap'])) return 'laporan_periode';
  if (mengandung(t, ['terakhir bayar', 'kapan bayar', 'bayar terakhir'])) return 'terakhir_bayar';
  if (mengandung(t, ['jumlah warga', 'berapa warga', 'warga aktif'])) return 'jumlah_warga';
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

// ─── Perhitungan bersama ────────────────────────────────────────────────────

const sebelumPeriode = (bulan, tahun, month, year) =>
  tahun < year || (tahun === year && bulan < month);

/** Tagihan satu warga untuk satu periode — cara yang sama dengan halaman Pembayaran */
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

/** Bulan-bulan sebelum periode yang tagihannya belum tertutup pembayaran */
const bulanTertunggak = (wargaId, month, year, state) =>
  state.meteran
    .filter(m => m.warga_id === wargaId && sebelumPeriode(m.bulan, m.tahun, month, year))
    .map(m => {
      const dibayar = state.pembayaran
        .filter(p => p.meteran_id === m.id)
        .reduce((s, p) => s + p.jumlah_bayar, 0);
      return { bulan: m.bulan, tahun: m.tahun, kurang: m.total_tagihan - dibayar };
    })
    .filter(x => x.kurang > 0)
    .sort((a, b) => (a.tahun - b.tahun) || (a.bulan - b.bulan));

const pembayaranTerakhir = (wargaId, state) => {
  const semua = state.pembayaran.filter(p => p.warga_id === wargaId);
  if (semua.length === 0) return null;
  return semua.reduce((a, b) => (new Date(b.tanggal_bayar) > new Date(a.tanggal_bayar) ? b : a));
};

const daftarPenunggak = (month, year, state) =>
  state.warga
    .filter(w => w.aktif && w.alamat !== 'SISTEM' && !w.adalah_pengelola)
    .map(w => {
      const { ringkas } = hitungTagihanWarga(w.id, month, year, state);
      return {
        id: w.id,
        nama: w.nama,
        sisa: Math.max(0, ringkas.sisa),
        tagihan: ringkas.tagihan,
        tunggakanLalu: ringkas.tunggakanLalu
      };
    })
    .filter(w => w.sisa > 0)
    .sort((a, b) => b.sisa - a.sisa);

const daftarLunas = (month, year, state) =>
  state.warga
    .filter(w => w.aktif && w.alamat !== 'SISTEM' && !w.adalah_pengelola)
    .map(w => {
      const { meteran, sudahBayar, ringkas } = hitungTagihanWarga(w.id, month, year, state);
      return {
        id: w.id,
        nama: w.nama,
        adaMeteran: !!meteran,
        tagihan: ringkas.tagihan,
        dibayar: sudahBayar,
        deposit: ringkas.deposit,
        sisa: Math.max(0, ringkas.sisa)
      };
    })
    .filter(w => w.sisa <= 0)
    .sort((a, b) => b.dibayar - a.dibayar);

const pesanNamaTidakJelas = (candidates, contoh) => {
  if (candidates.length > 0) {
    return `Ada beberapa nama yang cocok: ${candidates.map(w => w.nama).join(', ')}.\n` +
      'Sebutkan namanya lebih lengkap ya.';
  }
  return `Nama warganya belum saya kenali. Contoh: "${contoh}"`;
};

// ─── Jawaban per intent ─────────────────────────────────────────────────────

const jawabSaldoKas = (state, hariIni) => {
  const { month, year } = getCycleTarget(hariIni);
  const rekap = state.rekap;

  const masuk = rekap ? rekap.total_bayar : state.pembayaran.reduce((s, p) => s + p.jumlah_bayar, 0);
  const keluar = rekap ? rekap.total_keluar : state.pengeluaran.reduce((s, k) => s + k.jumlah, 0);
  const saldo = rekap ? rekap.kas_rt_bersih : masuk - keluar;

  const masukPeriode = filterByrBySiklus(state.pembayaran, month, year).reduce((s, p) => s + p.jumlah_bayar, 0);
  const keluarPeriode = filterKlrBySiklus(state.pengeluaran, month, year).reduce((s, k) => s + k.jumlah, 0);

  const wargaAktif = state.warga.filter(w => w.aktif && w.alamat !== 'SISTEM' && !w.adalah_pengelola).length;
  const penunggak = daftarPenunggak(month, year, state);
  const totalTunggakan = penunggak.reduce((s, w) => s + w.sisa, 0);

  let teks = `Saldo kas RT saat ini: ${fmtRp(saldo)}\n`;
  if (rekap && rekap.saldo_awal) teks += `• Saldo awal: ${fmtRp(rekap.saldo_awal)}\n`;
  teks += `• Total uang masuk: ${fmtRp(masuk)}\n`;
  teks += `• Total uang keluar: ${fmtRp(keluar)}\n\n`;

  teks += `Periode berjalan (${getCycleLabel(month, year)}):\n`;
  teks += `• Uang masuk: ${fmtRp(masukPeriode)}\n`;
  teks += `• Uang keluar: ${fmtRp(keluarPeriode)}\n`;
  teks += `• Warga aktif: ${wargaAktif} orang\n`;
  teks += `• Belum lunas: ${penunggak.length} orang (${fmtRp(totalTunggakan)})`;

  if (rekap && rekap.kas_patungan_bersih !== undefined) {
    teks += `\n\nKas patungan (perbaikan mesin): ${fmtRp(rekap.kas_patungan_bersih)}`;
  }
  return teks;
};

const jawabTagihan = (teks, state, hariIni) => {
  const { match, candidates } = findWarga(teks, state.warga);
  if (!match) return pesanNamaTidakJelas(candidates, 'tagihan Bowo berapa?');

  const { month, year } = parsePeriod(teks, hariIni);
  const { meteran, sudahBayar, ringkas } = hitungTagihanWarga(match.id, month, year, state);
  const status = evaluatePaymentStatus(ringkas.tagihan, sudahBayar, ringkas.deposit);
  const sisa = Math.max(0, ringkas.sisa);
  const tarif = meteran?.tarif_per_m3 || state.settings?.tarif_per_m3 || 0;

  let hasil = `Tagihan ${match.nama} — periode ${getCycleLabel(month, year)}\n`;

  if (meteran) {
    hasil += `• Meteran: ${meteran.meter_lalu} → ${meteran.meter_sekarang} (pakai ${meteran.pemakaian} m³)\n`;
    if (tarif) hasil += `• Tarif: ${fmtRp(tarif)}/m³\n`;
  } else {
    hasil += `• Meteran ${MONTHS[month]} ${year} belum dicatat\n`;
  }

  hasil += `• Tagihan periode ini: ${fmtRp(ringkas.tagihan)}\n`;
  hasil += `• Sudah dibayar: ${fmtRp(sudahBayar)}\n`;

  const tertunggak = bulanTertunggak(match.id, month, year, state);
  if (ringkas.tunggakanLalu > 0) {
    hasil += `• Tunggakan sebelumnya: ${fmtRp(ringkas.tunggakanLalu)}\n`;
    if (tertunggak.length > 0) {
      const rincian = tertunggak.map(x => `   - ${MONTHS[x.bulan]} ${x.tahun}: ${fmtRp(x.kurang)}`);
      hasil += `${rincian.join('\n')}\n`;
    }
  }
  if (ringkas.deposit > 0) hasil += `• Deposit (kelebihan bayar): ${fmtRp(ringkas.deposit)}\n`;

  hasil += `• Sisa yang harus dibayar: ${fmtRp(sisa)}\n`;
  hasil += `• Status: ${status}`;

  const terakhir = pembayaranTerakhir(match.id, state);
  if (terakhir) {
    hasil += `\n\nPembayaran terakhir: ${fmtDate(terakhir.tanggal_bayar)} sebesar ${fmtRp(terakhir.jumlah_bayar)}`;
    if (terakhir.metode) hasil += ` (${terakhir.metode})`;
  }

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
    const periode = p.bulan ? ` — untuk ${MONTHS[p.bulan]} ${p.tahun}` : '';
    const metode = p.metode ? `, ${p.metode}` : '';
    const ket = p.keterangan ? `\n   ${p.keterangan}` : '';
    return `• ${fmtDate(p.tanggal_bayar)}: ${fmtRp(p.jumlah_bayar)}${periode}${metode}${ket}`;
  });

  const total = semua.reduce((s, p) => s + p.jumlah_bayar, 0);

  return `Riwayat pembayaran ${match.nama} (${riwayat.length} terakhir dari ${semua.length}):\n` +
    `${baris.join('\n')}\n\nTotal seluruh pembayaran: ${fmtRp(total)}`;
};

const jawabBelumBayar = (teks, state, hariIni) => {
  const { month, year } = parsePeriod(teks, hariIni);
  const daftar = daftarPenunggak(month, year, state);

  if (daftar.length === 0) return `Tidak ada tunggakan sampai periode ${getCycleLabel(month, year)}.`;

  const total = daftar.reduce((s, w) => s + w.sisa, 0);
  const baris = daftar.map((w, i) => `${i + 1}. ${w.nama} — ${fmtRp(w.sisa)}`);

  return `Belum lunas sampai periode ${getCycleLabel(month, year)}: ${daftar.length} orang, ` +
    `total ${fmtRp(total)}\n${baris.join('\n')}\n\n` +
    `Ketik "rincian belum bayar" untuk melihat rincian tiap orang, ` +
    `atau "tagihan <nama>" untuk satu warga.`;
};

const jawabRincianBelumBayar = (teks, state, hariIni) => {
  const { month, year } = parsePeriod(teks, hariIni);
  const daftar = daftarPenunggak(month, year, state);

  if (daftar.length === 0) return `Tidak ada tunggakan sampai periode ${getCycleLabel(month, year)}.`;

  const total = daftar.reduce((s, w) => s + w.sisa, 0);
  const baris = daftar.map((w, i) => {
    const tertunggak = bulanTertunggak(w.id, month, year, state);
    const catatanBulan = tertunggak.length > 0
      ? `\n   Bulan tertunggak: ${tertunggak.map(x => `${MONTHS[x.bulan]} ${x.tahun}`).join(', ')}`
      : '';
    return `${i + 1}. ${w.nama} — ${fmtRp(w.sisa)}\n` +
      `   Tagihan periode ini: ${fmtRp(w.tagihan)}, tunggakan lama: ${fmtRp(w.tunggakanLalu)}${catatanBulan}`;
  });

  return `Rincian belum lunas sampai periode ${getCycleLabel(month, year)} ` +
    `(${daftar.length} orang, total ${fmtRp(total)}):\n${baris.join('\n')}`;
};

const jawabSudahBayar = (teks, state, hariIni) => {
  const { month, year } = parsePeriod(teks, hariIni);
  const lunas = daftarLunas(month, year, state);
  const wargaAktif = state.warga.filter(w => w.aktif && w.alamat !== 'SISTEM' && !w.adalah_pengelola).length;

  if (lunas.length === 0) {
    return `Belum ada warga yang lunas untuk periode ${getCycleLabel(month, year)}.`;
  }

  const totalDibayar = lunas.reduce((s, w) => s + w.dibayar, 0);
  const baris = lunas.map((w, i) => {
    let catatan = `${i + 1}. ${w.nama} — ${fmtRp(w.dibayar)}`;
    if (w.dibayar === 0 && w.deposit > 0) catatan += ' (tertutup deposit)';
    else if (w.dibayar === 0 && w.tagihan === 0 && !w.adaMeteran) catatan += ' (belum ada tagihan periode ini)';
    return catatan;
  });

  return `Sudah lunas periode ${getCycleLabel(month, year)}: ${lunas.length} dari ${wargaAktif} warga\n` +
    `${baris.join('\n')}\n\nTotal dibayar periode ini: ${fmtRp(totalDibayar)}`;
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
  const rincianKategori = Object.entries(perKategori)
    .sort((a, b) => b[1] - a[1])
    .map(([kat, jml]) => `• ${kat}: ${fmtRp(jml)}`);

  const transaksi = [...daftar]
    .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal))
    .map(k => {
      const ket = k.keterangan ? ` — ${k.keterangan}` : '';
      return `• ${fmtDate(k.tanggal)}: ${fmtRp(k.jumlah)} [${k.kategori || 'Lainnya'}]${ket}`;
    });

  return `Pengeluaran periode ${getCycleLabel(month, year)}: ${fmtRp(total)} ` +
    `(${daftar.length} transaksi)\n\nPer kategori:\n${rincianKategori.join('\n')}\n\n` +
    `Rincian transaksi:\n${transaksi.join('\n')}`;
};

const jawabPemasukan = (teks, state, hariIni) => {
  const { month, year } = parsePeriod(teks, hariIni);
  const daftar = filterByrBySiklus(state.pembayaran, month, year);
  if (daftar.length === 0) return `Belum ada pemasukan pada periode ${getCycleLabel(month, year)}.`;

  const total = daftar.reduce((s, p) => s + p.jumlah_bayar, 0);
  const patungan = daftar
    .filter(p => p.keterangan && p.keterangan.startsWith('[PATUNGAN]'))
    .reduce((s, p) => s + p.jumlah_bayar, 0);

  let hasil = `Pemasukan periode ${getCycleLabel(month, year)}: ${fmtRp(total)} ` +
    `dari ${daftar.length} pembayaran.`;
  if (patungan > 0) hasil += `\n• Termasuk patungan perbaikan mesin: ${fmtRp(patungan)}`;
  return hasil;
};

const jawabPemakaianAir = (teks, state, hariIni) => {
  const { match, candidates } = findWarga(teks, state.warga);
  if (!match) return pesanNamaTidakJelas(candidates, 'pemakaian air Bowo');

  const { month, year } = parsePeriod(teks, hariIni);
  const riwayat = state.meteran
    .filter(m => m.warga_id === match.id && !sebelumPeriode(month, year, m.bulan, m.tahun))
    .sort((a, b) => (b.tahun - a.tahun) || (b.bulan - a.bulan))
    .slice(0, 6);

  if (riwayat.length === 0) return `Belum ada catatan meteran atas nama ${match.nama}.`;

  const baris = riwayat.map(m =>
    `• ${MONTHS[m.bulan]} ${m.tahun}: ${m.pemakaian} m³ (${m.meter_lalu} → ${m.meter_sekarang}) — ${fmtRp(m.total_tagihan)}`
  );
  const rata = riwayat.reduce((s, m) => s + Number(m.pemakaian || 0), 0) / riwayat.length;

  return `Pemakaian air ${match.nama} (${riwayat.length} bulan terakhir):\n${baris.join('\n')}\n\n` +
    `Rata-rata: ${rata.toFixed(1)} m³ per bulan`;
};

const jawabTarif = (state) => {
  const tarif = state.settings?.tarif_per_m3 || 0;
  const admin = state.settings?.biaya_admin || 0;

  let hasil = `Tarif air RT saat ini: ${fmtRp(tarif)} per m³`;
  hasil += admin > 0 ? `\nBiaya administrasi: ${fmtRp(admin)} per bulan` : '\nTidak ada biaya administrasi.';
  hasil += `\n\nContoh: pakai 10 m³ → ${fmtRp(10 * tarif + admin)}`;
  return hasil;
};

const jawabLaporanPeriode = (teks, state, hariIni) => {
  const { month, year } = parsePeriod(teks, hariIni);

  const bayar = filterByrBySiklus(state.pembayaran, month, year);
  const keluar = filterKlrBySiklus(state.pengeluaran, month, year);
  const masuk = bayar.reduce((s, p) => s + p.jumlah_bayar, 0);
  const totalKeluar = keluar.reduce((s, k) => s + k.jumlah, 0);

  const meteranPeriode = state.meteran.filter(m => {
    const w = state.warga.find(x => x.id === m.warga_id);
    return m.bulan === month && m.tahun === year && w && w.alamat !== 'SISTEM' && !w.adalah_pengelola;
  });
  const totalTagihan = meteranPeriode.reduce((s, m) => s + m.total_tagihan, 0);
  const totalPemakaian = meteranPeriode.reduce((s, m) => s + Number(m.pemakaian || 0), 0);

  const penunggak = daftarPenunggak(month, year, state);
  const wargaAktif = state.warga.filter(w => w.aktif && w.alamat !== 'SISTEM' && !w.adalah_pengelola).length;

  return `Laporan periode ${getCycleLabel(month, year)}\n` +
    `• Tagihan air terbit: ${fmtRp(totalTagihan)} (${meteranPeriode.length} meteran, ${totalPemakaian} m³)\n` +
    `• Uang masuk: ${fmtRp(masuk)} dari ${bayar.length} pembayaran\n` +
    `• Uang keluar: ${fmtRp(totalKeluar)} dari ${keluar.length} transaksi\n` +
    `• Selisih periode ini: ${fmtRp(masuk - totalKeluar)}\n` +
    `• Sudah lunas: ${wargaAktif - penunggak.length} dari ${wargaAktif} warga\n` +
    `• Belum lunas: ${penunggak.length} orang (${fmtRp(penunggak.reduce((s, w) => s + w.sisa, 0))})`;
};

const jawabTerakhirBayar = (teks, state) => {
  const { match, candidates } = findWarga(teks, state.warga);
  if (!match) return pesanNamaTidakJelas(candidates, 'kapan Bowo terakhir bayar');

  const terakhir = pembayaranTerakhir(match.id, state);
  if (!terakhir) return `Belum ada catatan pembayaran atas nama ${match.nama}.`;

  const periode = terakhir.bulan ? ` untuk periode ${MONTHS[terakhir.bulan]} ${terakhir.tahun}` : '';
  const metode = terakhir.metode ? ` (${terakhir.metode})` : '';
  const ket = terakhir.keterangan ? `\nKeterangan: ${terakhir.keterangan}` : '';

  return `${match.nama} terakhir membayar pada ${fmtDate(terakhir.tanggal_bayar)} ` +
    `sebesar ${fmtRp(terakhir.jumlah_bayar)}${metode}${periode}.${ket}`;
};

const jawabJumlahWarga = (state, hariIni) => {
  const { month, year } = getCycleTarget(hariIni);
  const semua = state.warga.filter(w => w.alamat !== 'SISTEM');
  const aktif = semua.filter(w => w.aktif && !w.adalah_pengelola);
  const pengelola = semua.filter(w => w.adalah_pengelola);
  const penunggak = daftarPenunggak(month, year, state);

  return `Jumlah warga terdaftar: ${semua.length} orang\n` +
    `• Aktif (kena tagihan): ${aktif.length}\n` +
    `• Pengelola (bebas tagihan): ${pengelola.length}\n` +
    `• Tidak aktif: ${semua.length - aktif.length - pengelola.length}\n` +
    `• Belum lunas periode berjalan: ${penunggak.length}`;
};

export const BANTUAN = 'Saya bisa bantu menjawab soal keuangan air RT:\n' +
  '• "saldo kas berapa"\n' +
  '• "tagihan Bowo berapa"\n' +
  '• "riwayat bayar Bowo"\n' +
  '• "kapan Bowo terakhir bayar"\n' +
  '• "pemakaian air Bowo"\n' +
  '• "siapa yang sudah bayar"\n' +
  '• "siapa yang belum bayar" / "rincian belum bayar"\n' +
  '• "pengeluaran bulan Agustus"\n' +
  '• "laporan bulan ini"\n' +
  '• "tarif berapa"\n' +
  '• "berapa jumlah warga"\n\n' +
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
    case 'saldo_kas': return { intent, text: jawabSaldoKas(state, hariIni) };
    case 'cek_tagihan': return { intent, text: jawabTagihan(pertanyaan, state, hariIni) };
    case 'riwayat_bayar': return { intent, text: jawabRiwayat(pertanyaan, state) };
    case 'belum_bayar': return { intent, text: jawabBelumBayar(pertanyaan, state, hariIni) };
    case 'sudah_bayar': return { intent, text: jawabSudahBayar(pertanyaan, state, hariIni) };
    case 'rincian_belum_bayar': return { intent, text: jawabRincianBelumBayar(pertanyaan, state, hariIni) };
    case 'total_pengeluaran': return { intent, text: jawabPengeluaran(pertanyaan, state, hariIni) };
    case 'total_pemasukan': return { intent, text: jawabPemasukan(pertanyaan, state, hariIni) };
    case 'pemakaian_air': return { intent, text: jawabPemakaianAir(pertanyaan, state, hariIni) };
    case 'tarif': return { intent, text: jawabTarif(state) };
    case 'laporan_periode': return { intent, text: jawabLaporanPeriode(pertanyaan, state, hariIni) };
    case 'terakhir_bayar': return { intent, text: jawabTerakhirBayar(pertanyaan, state) };
    case 'jumlah_warga': return { intent, text: jawabJumlahWarga(state, hariIni) };
    default: {
      // Nama warga disebut tanpa kata kunci -> anggap menanyakan tagihan
      const { match } = findWarga(pertanyaan, state.warga);
      if (match) return { intent: 'cek_tagihan', text: jawabTagihan(pertanyaan, state, hariIni) };
      return { intent: 'tidak_paham', text: `Maaf, saya belum paham pertanyaannya.\n\n${BANTUAN}` };
    }
  }
};
