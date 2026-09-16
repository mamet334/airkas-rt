-- ============================================================
-- Migration: Fungsi restore_backup (pemulihan data dalam 1 transaksi)
-- Tanggal  : 2026-09-16
-- Diterapkan via Supabase MCP (apply_migration: restore_backup_function)
--
-- Masalah sebelumnya: Restore di aplikasi menghapus & memasukkan data
-- baris per baris dari browser (±673 permintaan). Jika koneksi putus di
-- tengah, data lama sudah terhapus dan data baru hanya sebagian masuk.
-- Selain itu ID lama dibuang saat insert, sehingga pembayaran.meteran_id
-- menunjuk meteran yang sudah tidak ada -> melanggar foreign key.
--
-- Sekarang: seluruh proses dijalankan di dalam satu fungsi (satu transaksi).
-- Jika ada satu saja kesalahan, SEMUA perubahan dibatalkan otomatis dan
-- data lama tetap utuh. ID asli dipertahankan agar relasi antar tabel tetap benar.
--
-- ROLLBACK: DROP FUNCTION public.restore_backup(jsonb);
-- ============================================================

CREATE OR REPLACE FUNCTION public.restore_backup(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  n_warga int;
  n_meteran int;
  n_pembayaran int;
  n_pengeluaran int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak: hanya administrator yang boleh memulihkan data.';
  END IF;

  IF jsonb_typeof(payload->'warga') <> 'array'
     OR jsonb_typeof(payload->'meteran') <> 'array'
     OR jsonb_typeof(payload->'pembayaran') <> 'array'
     OR jsonb_typeof(payload->'pengeluaran') <> 'array' THEN
    RAISE EXCEPTION 'Struktur berkas backup tidak sesuai (warga/meteran/pembayaran/pengeluaran harus berupa daftar).';
  END IF;

  -- Kosongkan data lama (audit_log sengaja TIDAK dihapus: append-only)
  DELETE FROM public.pembayaran;
  DELETE FROM public.meteran;
  DELETE FROM public.warga;
  DELETE FROM public.pengeluaran;

  -- Masukkan kembali dengan ID asli agar relasi antar tabel tetap utuh
  INSERT INTO public.warga (id, nama, alamat, no_meter, aktif, adalah_pengelola, created_at, telepon)
  OVERRIDING SYSTEM VALUE
  SELECT id, nama, alamat, no_meter, COALESCE(aktif, true), COALESCE(adalah_pengelola, false),
         COALESCE(created_at, now()), telepon
  FROM jsonb_populate_recordset(NULL::public.warga, payload->'warga');
  GET DIAGNOSTICS n_warga = ROW_COUNT;

  INSERT INTO public.meteran (id, warga_id, bulan, tahun, meter_lalu, meter_sekarang, pemakaian,
                              tarif_per_m3, biaya_admin, total_tagihan, tanggal_input, created_at)
  OVERRIDING SYSTEM VALUE
  SELECT id, warga_id, bulan, tahun, meter_lalu, meter_sekarang, pemakaian,
         tarif_per_m3, biaya_admin, total_tagihan, tanggal_input, COALESCE(created_at, now())
  FROM jsonb_populate_recordset(NULL::public.meteran, payload->'meteran');
  GET DIAGNOSTICS n_meteran = ROW_COUNT;

  INSERT INTO public.pembayaran (id, meteran_id, warga_id, bulan, tahun, jumlah_bayar, metode,
                                 no_bukti, keterangan, tanggal_bayar, created_at)
  OVERRIDING SYSTEM VALUE
  SELECT id, meteran_id, warga_id, bulan, tahun, jumlah_bayar, metode,
         no_bukti, keterangan, tanggal_bayar, COALESCE(created_at, now())
  FROM jsonb_populate_recordset(NULL::public.pembayaran, payload->'pembayaran');
  GET DIAGNOSTICS n_pembayaran = ROW_COUNT;

  INSERT INTO public.pengeluaran (id, kategori, keterangan, jumlah, tanggal, no_bukti, created_at)
  OVERRIDING SYSTEM VALUE
  SELECT id, kategori, keterangan, jumlah, tanggal, no_bukti, COALESCE(created_at, now())
  FROM jsonb_populate_recordset(NULL::public.pengeluaran, payload->'pengeluaran');
  GET DIAGNOSTICS n_pengeluaran = ROW_COUNT;

  -- Setelan RT (baris tunggal id = 1)
  IF jsonb_typeof(payload->'settings') = 'object' THEN
    UPDATE public.settings s SET
      nama_rt = p.nama_rt,
      alamat = p.alamat,
      pengelola = p.pengelola,
      tarif_per_m3 = COALESCE(p.tarif_per_m3, s.tarif_per_m3),
      biaya_admin = COALESCE(p.biaya_admin, s.biaya_admin),
      saldo_awal = COALESCE(p.saldo_awal, s.saldo_awal),
      saldo_patungan_awal = COALESCE(p.saldo_patungan_awal, s.saldo_patungan_awal),
      updated_at = now()
    FROM jsonb_populate_record(NULL::public.settings, payload->'settings') p
    WHERE s.id = 1;
  END IF;

  -- Selaraskan penomoran ID agar data baru tidak bentrok dengan ID hasil restore
  PERFORM setval(pg_get_serial_sequence('public.warga', 'id'),
                 GREATEST(COALESCE((SELECT max(id) FROM public.warga), 0), 1));
  PERFORM setval(pg_get_serial_sequence('public.meteran', 'id'),
                 GREATEST(COALESCE((SELECT max(id) FROM public.meteran), 0), 1));
  PERFORM setval(pg_get_serial_sequence('public.pembayaran', 'id'),
                 GREATEST(COALESCE((SELECT max(id) FROM public.pembayaran), 0), 1));
  PERFORM setval(pg_get_serial_sequence('public.pengeluaran', 'id'),
                 GREATEST(COALESCE((SELECT max(id) FROM public.pengeluaran), 0), 1));

  INSERT INTO public.audit_log (aksi, detail, created_at)
  VALUES ('RESTORE',
          format('Memulihkan data dari backup: %s warga, %s meteran, %s pembayaran, %s pengeluaran',
                 n_warga, n_meteran, n_pembayaran, n_pengeluaran),
          now());

  RETURN jsonb_build_object('warga', n_warga, 'meteran', n_meteran,
                            'pembayaran', n_pembayaran, 'pengeluaran', n_pengeluaran);
END;
$$;

REVOKE ALL ON FUNCTION public.restore_backup(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_backup(jsonb) TO authenticated;
