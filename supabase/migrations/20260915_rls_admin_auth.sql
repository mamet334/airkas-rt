-- ============================================================
-- Migration: RLS Admin Auth
-- Tanggal  : 2026-09-15
-- Deskripsi: Ganti RLS "anyone can write" menjadi:
--            - SELECT: terbuka untuk semua (anon + authenticated)
--            - INSERT/UPDATE/DELETE: hanya untuk admin yang login
--
-- CARA PAKAI:
-- Jalankan script ini di Supabase Dashboard → SQL Editor
-- SETELAH membuat akun admin pertama via Supabase Auth Dashboard.
-- ============================================================

-- ── 1. Tabel admin_users ─────────────────────────────────────
-- Menyimpan daftar user_id yang berhak sebagai admin.
-- Satu admin pertama di-insert manual setelah script ini dijalankan.

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Aktifkan RLS pada tabel admin_users itu sendiri
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Admin bisa baca daftar admin (untuk fitur "Kelola Admin")
CREATE POLICY "admin_users_select"
  ON public.admin_users FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM public.admin_users));

-- Hanya Edge Function (service_role) yang bisa insert admin baru
-- (service_role melewati RLS secara otomatis)


-- ── 2. Tabel: warga ──────────────────────────────────────────
ALTER TABLE public.warga ENABLE ROW LEVEL SECURITY;

-- Hapus policy lama yang terlalu lebar
DROP POLICY IF EXISTS "warga_all" ON public.warga;
DROP POLICY IF EXISTS "Enable all for public" ON public.warga;

-- SELECT: siapapun boleh baca
CREATE POLICY "warga_select_public"
  ON public.warga FOR SELECT
  USING (true);

-- INSERT/UPDATE/DELETE: hanya admin
CREATE POLICY "warga_write_admin"
  ON public.warga FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.admin_users));

CREATE POLICY "warga_update_admin"
  ON public.warga FOR UPDATE
  USING (auth.uid() IN (SELECT user_id FROM public.admin_users));

CREATE POLICY "warga_delete_admin"
  ON public.warga FOR DELETE
  USING (auth.uid() IN (SELECT user_id FROM public.admin_users));


-- ── 3. Tabel: meteran ────────────────────────────────────────
ALTER TABLE public.meteran ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meteran_all" ON public.meteran;
DROP POLICY IF EXISTS "Enable all for public" ON public.meteran;

CREATE POLICY "meteran_select_public"
  ON public.meteran FOR SELECT
  USING (true);

CREATE POLICY "meteran_write_admin"
  ON public.meteran FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.admin_users));

CREATE POLICY "meteran_update_admin"
  ON public.meteran FOR UPDATE
  USING (auth.uid() IN (SELECT user_id FROM public.admin_users));

CREATE POLICY "meteran_delete_admin"
  ON public.meteran FOR DELETE
  USING (auth.uid() IN (SELECT user_id FROM public.admin_users));


-- ── 4. Tabel: pembayaran ─────────────────────────────────────
ALTER TABLE public.pembayaran ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pembayaran_all" ON public.pembayaran;
DROP POLICY IF EXISTS "Enable all for public" ON public.pembayaran;

CREATE POLICY "pembayaran_select_public"
  ON public.pembayaran FOR SELECT
  USING (true);

CREATE POLICY "pembayaran_write_admin"
  ON public.pembayaran FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.admin_users));

CREATE POLICY "pembayaran_update_admin"
  ON public.pembayaran FOR UPDATE
  USING (auth.uid() IN (SELECT user_id FROM public.admin_users));

CREATE POLICY "pembayaran_delete_admin"
  ON public.pembayaran FOR DELETE
  USING (auth.uid() IN (SELECT user_id FROM public.admin_users));


-- ── 5. Tabel: pengeluaran ────────────────────────────────────
ALTER TABLE public.pengeluaran ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pengeluaran_all" ON public.pengeluaran;
DROP POLICY IF EXISTS "Enable all for public" ON public.pengeluaran;

CREATE POLICY "pengeluaran_select_public"
  ON public.pengeluaran FOR SELECT
  USING (true);

CREATE POLICY "pengeluaran_write_admin"
  ON public.pengeluaran FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.admin_users));

CREATE POLICY "pengeluaran_update_admin"
  ON public.pengeluaran FOR UPDATE
  USING (auth.uid() IN (SELECT user_id FROM public.admin_users));

CREATE POLICY "pengeluaran_delete_admin"
  ON public.pengeluaran FOR DELETE
  USING (auth.uid() IN (SELECT user_id FROM public.admin_users));


-- ── 6. Tabel: settings ───────────────────────────────────────
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_all" ON public.settings;
DROP POLICY IF EXISTS "Enable all for public" ON public.settings;

CREATE POLICY "settings_select_public"
  ON public.settings FOR SELECT
  USING (true);

CREATE POLICY "settings_update_admin"
  ON public.settings FOR UPDATE
  USING (auth.uid() IN (SELECT user_id FROM public.admin_users));


-- ── 7. Insert admin pertama (jalankan setelah buat akun di Auth Dashboard) ─
-- Ganti 'UUID-ADMIN-ANDA' dengan user_id dari Supabase Auth → Users
-- Contoh:
-- INSERT INTO public.admin_users (user_id)
-- VALUES ('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');


-- ── 8. Verifikasi ─────────────────────────────────────────────
-- Setelah script dijalankan, cek dengan:
-- SELECT * FROM public.admin_users;
-- SELECT schemaname, tablename, policyname, cmd FROM pg_policies
--   WHERE schemaname = 'public' ORDER BY tablename, cmd;
