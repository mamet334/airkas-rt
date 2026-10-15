-- ============================================================
-- Migration: Penggantian Meteran
-- Tanggal  : 2026-10-15
-- Deskripsi: Mencatat penggantian meteran fisik sebagai EVENT terpisah,
--            supaya angka meteran baru yang mulai dari 0 tidak dianggap
--            "mundur" dari angka meteran lama.
--
-- Kenapa tabel baru, bukan kolom di `warga`:
--   Satu warga bisa berganti meteran berkali-kali sepanjang umur pakai
--   alat. Kolom tunggal (mis. "sudah_ganti_meteran") hanya menampung satu
--   kejadian dan akan memaksa perubahan kode lagi pada penggantian kedua.
--
-- Prinsip: baris `meteran` lama TIDAK pernah diubah oleh migrasi ini.
--   Riwayat tagihan & laporan periode lampau tetap apa adanya (terarsip).
--
-- ROLLBACK:
--   ALTER TABLE public.meteran DROP COLUMN IF EXISTS ganti_meter_id;
--   ALTER TABLE public.meteran DROP COLUMN IF EXISTS pemakaian_meter_lama;
--   DROP TABLE IF EXISTS public.penggantian_meter;
-- ============================================================

-- ── 1. Tabel event penggantian ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.penggantian_meter (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  warga_id          bigint NOT NULL REFERENCES public.warga(id) ON DELETE CASCADE,

  -- Tanggal fisik meteran diganti.
  tanggal           date NOT NULL,

  -- Siklus tagihan tempat penggantian ini mulai berlaku (siklus 15-14).
  -- Disimpan eksplisit, tidak dihitung ulang dari `tanggal`, agar admin
  -- tetap bisa menempatkan event pada siklus yang benar bila pencatatan
  -- telat dilakukan.
  bulan             int NOT NULL CHECK (bulan >= 1 AND bulan <= 12),
  tahun             int NOT NULL,

  -- Arsip meteran lama. Keduanya boleh kosong.
  no_meter_lama     text,
  -- NULL = angka akhir meteran lama tidak sempat dicatat, jadi sisa
  -- pemakaiannya diabaikan (tidak ditagih). Diisi = sisa pemakaian meteran
  -- lama ikut dihitung pada tagihan siklus ini.
  meter_akhir_lama  numeric,

  -- Meteran pengganti. Default 0 karena meteran baru umumnya mulai dari 0,
  -- tetapi tetap bisa diisi bila memakai meteran bekas/kalibrasi.
  no_meter_baru     text,
  meter_awal_baru   numeric NOT NULL DEFAULT 0,

  keterangan        text DEFAULT '',
  created_at        timestamptz DEFAULT now(),

  -- Angka meteran tidak boleh negatif
  CONSTRAINT penggantian_meter_awal_baru_nonneg CHECK (meter_awal_baru >= 0),
  CONSTRAINT penggantian_meter_akhir_lama_nonneg CHECK (meter_akhir_lama IS NULL OR meter_akhir_lama >= 0),

  -- Satu warga hanya boleh punya satu penggantian per siklus. Ini menahan
  -- entri ganda akibat klik dobel; penggantian dua kali dalam satu siklus
  -- yang sama praktis tidak terjadi, dan event-nya tetap bisa dihapus bila
  -- admin salah input.
  CONSTRAINT penggantian_meter_unik_per_siklus UNIQUE (warga_id, bulan, tahun)
);

CREATE INDEX IF NOT EXISTS penggantian_meter_warga_idx
  ON public.penggantian_meter (warga_id, tahun, bulan);

-- ── 2. Jejak pada baris meteran ──────────────────────────────
-- Dua kolom ini hanya diisi pada siklus yang mengalami penggantian.
ALTER TABLE public.meteran
  ADD COLUMN IF NOT EXISTS ganti_meter_id bigint
    REFERENCES public.penggantian_meter(id) ON DELETE SET NULL;

-- Sisa pemakaian meteran LAMA yang ikut ditagih pada siklus penggantian.
-- `pemakaian` tetap menjadi total yang ditagih (lama + baru), supaya semua
-- laporan yang sudah membaca kolom `pemakaian` tidak perlu diubah.
ALTER TABLE public.meteran
  ADD COLUMN IF NOT EXISTS pemakaian_meter_lama numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.meteran.pemakaian_meter_lama IS
  'Bagian dari `pemakaian` yang berasal dari meteran lama pada siklus penggantian. 0 untuk siklus normal.';

-- ── 3. RLS: baca publik, tulis admin ─────────────────────────
-- Mengikuti pola 20260915b_fix_rls_admin.sql (memakai public.is_admin()
-- agar tidak terjadi rekursi saat policy membaca admin_users).
ALTER TABLE public.penggantian_meter ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "penggantian_meter_select_public" ON public.penggantian_meter;
DROP POLICY IF EXISTS "penggantian_meter_insert_admin" ON public.penggantian_meter;
DROP POLICY IF EXISTS "penggantian_meter_update_admin" ON public.penggantian_meter;
DROP POLICY IF EXISTS "penggantian_meter_delete_admin" ON public.penggantian_meter;

CREATE POLICY "penggantian_meter_select_public" ON public.penggantian_meter
  FOR SELECT USING (true);
CREATE POLICY "penggantian_meter_insert_admin" ON public.penggantian_meter
  FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "penggantian_meter_update_admin" ON public.penggantian_meter
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "penggantian_meter_delete_admin" ON public.penggantian_meter
  FOR DELETE USING (public.is_admin());

-- ── 4. Verifikasi ────────────────────────────────────────────
-- SELECT * FROM public.penggantian_meter ORDER BY tahun, bulan;
-- SELECT policyname, cmd FROM pg_policies
--   WHERE schemaname='public' AND tablename='penggantian_meter' ORDER BY cmd;
