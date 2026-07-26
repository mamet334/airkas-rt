const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://psfrkevdcuuyyefeuhps.supabase.co';
const SUPABASE_KEY = 'sb_publishable_drceoz8eAEPpECcxMWx8mg_ElVgUMU2';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkJuni() {
  const { data: p } = await supabase.from('pembayaran').select('*').eq('bulan', 6).eq('tahun', 2026);
  const { data: m } = await supabase.from('meteran').select('*').eq('bulan', 6).eq('tahun', 2026);
  const { data: k } = await supabase.from('pengeluaran').select('*');
  const { data: w } = await supabase.from('warga').select('*');

  console.log('=== PEMBAYARAN JUNI 2026 ===');
  console.log('Count:', p ? p.length : 0);
  p.forEach(x => {
    const wg = w.find(y => y.id === x.warga_id) || {};
    console.log(wg.nama || x.warga_id, '| Rp' + x.jumlah_bayar, '|', x.tanggal_bayar, '|', x.keterangan || '-');
  });

  console.log('\n=== METERAN JUNI 2026 ===');
  console.log('Count:', m ? m.length : 0);
  m.forEach(x => {
    const wg = w.find(y => y.id === x.warga_id) || {};
    console.log(wg.nama || x.warga_id, '| Pakai:', x.pemakaian, 'm3 | Tagihan:', x.total_tagihan);
  });

  console.log('\n=== PENGELUARAN JUNI 2026 ===');
  const junKlr = k.filter(x => {
    const d = new Date(x.tanggal);
    // Cycle for June: 16 May - 15 June
    return d >= new Date('2026-05-16') && d <= new Date('2026-06-15T23:59:59');
  });
  console.log('Count:', junKlr.length);
  junKlr.forEach(x => {
    console.log(x.tanggal, '| Rp' + x.jumlah, '|', x.kategori, '|', x.keterangan || '-');
  });
}
checkJuni();
