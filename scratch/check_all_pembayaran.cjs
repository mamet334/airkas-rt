const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://psfrkevdcuuyyefeuhps.supabase.co';
const SUPABASE_KEY = 'sb_publishable_drceoz8eAEPpECcxMWx8mg_ElVgUMU2';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkAll() {
  const { data: p } = await supabase.from('pembayaran').select('*');
  const { data: w } = await supabase.from('warga').select('*');

  console.log('=== PEMBAYARAN ANTARA 16 MEI - 15 JUNI ===');
  const filtered = p.filter(x => {
    const d = new Date(x.tanggal_bayar);
    return d >= new Date('2026-05-16') && d <= new Date('2026-06-15T23:59:59');
  });

  filtered.forEach(x => {
    const wg = w.find(y => y.id === x.warga_id) || {};
    console.log(wg.nama || x.warga_id, '| Rp' + x.jumlah_bayar, '| Tgl:', x.tanggal_bayar, '| DB Bulan:', x.bulan, '| DB Tahun:', x.tahun, '| Ket:', x.keterangan || '-');
  });
}
checkAll();
