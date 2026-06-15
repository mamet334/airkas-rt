const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://psfrkevdcuuyyefeuhps.supabase.co";
const SUPABASE_KEY = "sb_publishable_drceoz8eAEPpECcxMWx8mg_ElVgUMU2";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
  const { data: p } = await supabase.from('pembayaran').select('*');
  const { data: k } = await supabase.from('pengeluaran').select('*');

  let total_pemasukan_air = 0;
  let total_pemasukan_lain = 0;
  let total_pemasukan_patungan = 0;

  p.forEach(x => {
    if (x.keterangan && x.keterangan.startsWith('[PATUNGAN]')) {
      total_pemasukan_patungan += x.jumlah_bayar;
    } else if (x.keterangan && (x.keterangan.toLowerCase().includes('kas rt') || x.keterangan.toLowerCase().includes('lain'))) {
       // Wait, we need to know if the meter is SISTEM
    }
  });

  const { data: m } = await supabase.from('meteran').select('id, warga_id');
  const { data: w } = await supabase.from('warga').select('id, alamat');

  const meteranMap = {};
  m.forEach(x => meteranMap[x.id] = x.warga_id);

  const wargaMap = {};
  w.forEach(x => wargaMap[x.id] = x.alamat);

  let real_pemasukan_air = 0;
  let real_pemasukan_lain = 0;
  let real_pemasukan_patungan = 0;

  p.forEach(x => {
    const wId = meteranMap[x.meteran_id];
    const alamat = wargaMap[wId];

    if (x.keterangan && x.keterangan.startsWith('[PATUNGAN]')) {
      real_pemasukan_patungan += x.jumlah_bayar;
    } else if (alamat === 'SISTEM') {
      real_pemasukan_lain += x.jumlah_bayar;
    } else {
      real_pemasukan_air += x.jumlah_bayar;
    }
  });

  let total_keluar_air = 0;
  let total_keluar_patungan = 0;

  k.forEach(x => {
    if (x.kategori === 'Perbaikan Mesin (Patungan)') {
      total_keluar_patungan += x.jumlah;
    } else {
      total_keluar_air += x.jumlah;
    }
  });

  console.log("=== HITUNGAN LOKAL NODEJS ===");
  console.log("Pemasukan Air:", real_pemasukan_air);
  console.log("Pemasukan Lain:", real_pemasukan_lain);
  console.log("Pemasukan Patungan:", real_pemasukan_patungan);
  console.log("Total Pemasukan All:", real_pemasukan_air + real_pemasukan_lain + real_pemasukan_patungan);
  console.log("---");
  console.log("Keluar Operasional:", total_keluar_air);
  console.log("Keluar Mesin (Patungan):", total_keluar_patungan);
  console.log("Total Keluar All:", total_keluar_air + total_keluar_patungan);
  console.log("---");
  console.log("Saldo Kas RT (Air + Lain - Operasional):", (real_pemasukan_air + real_pemasukan_lain) - total_keluar_air);
  console.log("Saldo Patungan (Patungan - Mesin):", real_pemasukan_patungan - total_keluar_patungan);
  console.log("Saldo Global (Total Masuk - Total Keluar):", (real_pemasukan_air + real_pemasukan_lain + real_pemasukan_patungan) - (total_keluar_air + total_keluar_patungan));

  const { data: rpc } = await supabase.rpc('get_rekap_kas_total');
  console.log("\n=== HASIL DARI SUPABASE RPC get_rekap_kas_total ===");
  console.log(rpc);
}

check();
