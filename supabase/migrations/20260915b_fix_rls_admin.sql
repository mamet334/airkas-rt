-- ============================================================
-- Migration: Fix RLS Admin (menggantikan penerapan 20260915_rls_admin_auth.sql)
-- Tanggal  : 2026-09-15
-- Diterapkan via Supabase MCP (apply_migration: fix_rls_admin_write_lock)
--
-- Temuan sebelum migrasi ini:
--   - Policy lama bernama "a" (ALL, public, true) masih aktif di warga,
--     meteran, pembayaran, pengeluaran, settings -> anon bisa tulis/hapus.
--   - Policy admin_users_select membaca tabelnya sendiri ->
--     ERROR 42P17 infinite recursion.
--   - audit_log bisa di-INSERT oleh anon.
--
-- ROLLBACK DARURAT (kembalikan kondisi lama):
--   DROP POLICY ... (policy baru di bawah);
--   CREATE POLICY "a" ON public.<tabel> FOR ALL USING (true) WITH CHECK (true);
-- ============================================================

-- ── 1. Fungsi cek admin tanpa rekursi ───────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid());
$$;

-- ── 2. admin_users ───────────────────────────────────────────
DROP POLICY IF EXISTS "admin_users_select" ON public.admin_users;
CREATE POLICY "admin_users_select" ON public.admin_users
  FOR SELECT USING (public.is_admin());

-- ── 3. Tabel keuangan: baca publik, tulis admin ──────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['warga','meteran','pembayaran','pengeluaran'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "a" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_select_public" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_insert_admin" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_update_admin" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_delete_admin" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_select_public" ON public.%I FOR SELECT USING (true)', t, t);
    EXECUTE format('CREATE POLICY "%s_insert_admin" ON public.%I FOR INSERT WITH CHECK (public.is_admin())', t, t);
    EXECUTE format('CREATE POLICY "%s_update_admin" ON public.%I FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin())', t, t);
    EXECUTE format('CREATE POLICY "%s_delete_admin" ON public.%I FOR DELETE USING (public.is_admin())', t, t);
  END LOOP;
END $$;

-- ── 4. settings: baca publik, update admin (tidak ada insert/delete) ─
DROP POLICY IF EXISTS "a" ON public.settings;
DROP POLICY IF EXISTS "settings_select_public" ON public.settings;
DROP POLICY IF EXISTS "settings_update_admin" ON public.settings;
CREATE POLICY "settings_select_public" ON public.settings FOR SELECT USING (true);
CREATE POLICY "settings_update_admin" ON public.settings
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── 5. audit_log: baca publik, insert admin, tetap append-only ─
DROP POLICY IF EXISTS "audit_log_insert_all" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_insert_admin" ON public.audit_log;
CREATE POLICY "audit_log_insert_admin" ON public.audit_log
  FOR INSERT WITH CHECK (public.is_admin());
