const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://psfrkevdcuuyyefeuhps.supabase.co';
const SUPABASE_KEY = 'sb_publishable_drceoz8eAEPpECcxMWx8mg_ElVgUMU2';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function findKlr() {
  const { data: k } = await supabase.from('pengeluaran').select('*');
  let totalKlrLain = 0;
  console.log('=== PENGELUARAN TERKAIT PENGEMBALIAN/LAIN ===');
  k.forEach(x => {
    const ket = (x.keterangan || '').toLowerCase();
    const kat = (x.kategori || '').toLowerCase();
    if (ket.includes('kembali') || ket.includes('pinjam') || ket.includes('talangan') || kat === 'lain-lain') {
       console.log('-', x.tanggal, '| Rp' + x.jumlah, '| Kat:', x.kategori, '| Ket:', x.keterangan);
       totalKlrLain += x.jumlah;
    }
  });
  console.log('Total pengeluaran tsb:', totalKlrLain);
}
findKlr();
