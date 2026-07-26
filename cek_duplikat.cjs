const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://psfrkevdcuuyyefeuhps.supabase.co';
const SUPABASE_KEY = 'sb_publishable_drceoz8eAEPpECcxMWx8mg_ElVgUMU2';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkDups() {
  const { data: p } = await supabase.from('pembayaran').select('*');
  const { data: k } = await supabase.from('pengeluaran').select('*');
  const { data: w } = await supabase.from('warga').select('id, nama');
  const { data: m } = await supabase.from('meteran').select('id, warga_id');
  
  const mMap = {}; m.forEach(x => mMap[x.id] = x.warga_id);
  const wMap = {}; w.forEach(x => wMap[x.id] = x.nama);

  console.log('=== CEK DUPLIKASI PEMBAYARAN ===');
  const seen = {};
  p.forEach(x => {
    const wId = mMap[x.meteran_id];
    const key = wId + '_' + x.jumlah_bayar + '_' + x.bulan + '_' + x.tahun + '_' + (x.keterangan || '');
    if (!seen[key]) seen[key] = [];
    seen[key].push(x);
  });

  let foundDup = false;
  for (const k in seen) {
    if (seen[k].length > 1) {
      foundDup = true;
      const wId = k.split('_')[0];
      console.log('POTENSI DUPLIKAT UNTUK WARGA:', wMap[wId], 'JUMLAH:', seen[k][0].jumlah_bayar);
      seen[k].forEach(x => {
        console.log('  -', x.tanggal_bayar, '| Rp' + x.jumlah_bayar, '| Ket:', x.keterangan || '-');
      });
    }
  }
  if (!foundDup) console.log('Tidak ada indikasi pembayaran ganda di bulan yang sama.');

  console.log('\n=== CEK KAS LAIN YANG BUKAN UANG FISIK ===');
  console.log('Cek apakah ada Modal Awal atau Pinjaman yang membengkakkan saldo tanpa wujud uang tunai:');
  p.forEach(x => {
    if (x.keterangan && x.keterangan.toLowerCase().includes('modal') || x.keterangan && x.keterangan.toLowerCase().includes('pinjam')) {
       console.log('  -', x.tanggal_bayar, '| Rp' + x.jumlah_bayar, '|', x.keterangan);
    }
  });

  console.log('\n=== CEK PENGELUARAN DOUBLE ===');
  const seenKlr = {};
  k.forEach(x => {
    const key = x.jumlah + '_' + x.kategori + '_' + x.keterangan;
    if (!seenKlr[key]) seenKlr[key] = [];
    seenKlr[key].push(x);
  });
  for (const c in seenKlr) {
    if (seenKlr[c].length > 1) {
      console.log('POTENSI PENGELUARAN DUPLIKAT:', c);
      seenKlr[c].forEach(x => {
         console.log('  -', x.tanggal, '| Rp' + x.jumlah, '|', x.keterangan);
      });
    }
  }
}
checkDups();
