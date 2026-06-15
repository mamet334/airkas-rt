const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://psfrkevdcuuyyefeuhps.supabase.co';
const SUPABASE_KEY = 'sb_publishable_drceoz8eAEPpECcxMWx8mg_ElVgUMU2';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const { data: p } = await supabase.from('pembayaran').select('*');
  const { data: m } = await supabase.from('meteran').select('id, warga_id');
  const { data: w } = await supabase.from('warga').select('id, alamat, nama');

  const meteranMap = {};
  m.forEach(x => meteranMap[x.id] = x.warga_id);

  const wargaMap = {};
  w.forEach(x => wargaMap[x.id] = x);

  console.log('=== RINCIAN KAS LAIN / SUMBANGAN (Rp 760.000) ===');
  let total = 0;
  p.forEach(x => {
    const wId = meteranMap[x.meteran_id];
    const wargaObj = wargaMap[wId];
    const alamat = wargaObj ? wargaObj.alamat : null;
    
    if (x.keterangan && x.keterangan.startsWith('[PATUNGAN]')) {
      // ignore
    } else if (alamat === 'SISTEM') {
      console.log(`- ${x.tanggal_bayar.split('T')[0]} | Rp ${x.jumlah_bayar} | ${wargaObj.nama} | Ket: ${x.keterangan || '-'}`);
      total += x.jumlah_bayar;
    }
  });
  console.log('Total:', total);
}
run();
