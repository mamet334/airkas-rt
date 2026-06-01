export const getCycleMonthYear = (dateStr) => {
  if (!dateStr) return { month: 1, year: 2026 };
  const d = new Date(dateStr);
  const day = d.getDate();
  let month = d.getMonth() + 1;
  let year = d.getFullYear();

  if (day < 15) {
    month = month - 1;
    if (month === 0) {
      month = 12;
      year = year - 1;
    }
  }
  return { month, year };
};

export const getWargaDeposit = (wargaId, m, y, state) => {
  const w = state.warga.find(wg => wg.id === wargaId);
  if (w && w.adalah_pengelola) return 0; // Pengelola RT tidak memiliki deposit/tunggakan

  const pastMeters = state.meteran.filter(x => {
    if (x.warga_id !== wargaId) return false;
    return (x.tahun < y) || (x.tahun === y && x.bulan < m);
  });
  const totalTagihan = pastMeters.reduce((s, x) => s + x.total_tagihan, 0);

  const pastPayments = state.pembayaran.filter(x => {
    if (x.warga_id !== wargaId) return false;
    if (x.meteran_id === null) return false;

    // Abaikan jika pembayaran terhubung ke meteran virtual sistem (seperti Pemasangan Baru)
    const mtr = state.meteran.find(met => met.id === x.meteran_id);
    if (mtr) {
      const wg = state.warga.find(wItem => wItem.id === mtr.warga_id);
      if (wg && wg.alamat === 'SISTEM') return false;
    }

    return (x.tahun < y) || (x.tahun === y && x.bulan < m);
  });
  const totalBayar = pastPayments.reduce((s, x) => s + x.jumlah_bayar, 0);

  return Math.max(0, totalBayar - totalTagihan);
};

export const getWargaTunggakanLalu = (wargaId, m, y, state) => {
  const w = state.warga.find(wg => wg.id === wargaId);
  if (w && w.adalah_pengelola) return 0;

  const pastMeters = state.meteran.filter(x => {
    if (x.warga_id !== wargaId) return false;
    return (x.tahun < y) || (x.tahun === y && x.bulan < m);
  });
  const totalTagihan = pastMeters.reduce((s, x) => s + x.total_tagihan, 0);

  const pastPayments = state.pembayaran.filter(x => {
    if (x.warga_id !== wargaId) return false;
    if (x.meteran_id === null) return false;

    const mtr = state.meteran.find(met => met.id === x.meteran_id);
    if (mtr) {
      const wg = state.warga.find(wItem => wItem.id === mtr.warga_id);
      if (wg && wg.alamat === 'SISTEM') return false;
    }

    return (x.tahun < y) || (x.tahun === y && x.bulan < m);
  });
  const totalBayar = pastPayments.reduce((s, x) => s + x.jumlah_bayar, 0);

  return Math.max(0, totalTagihan - totalBayar);
};
