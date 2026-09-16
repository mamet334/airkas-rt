-- ============================================================
-- Migration: PIN kunci layar disimpan per akun admin
-- Tanggal  : 2026-09-16
-- Diterapkan via Supabase MCP (apply_migration: admin_pin_hash)
--
-- Sebelumnya PIN di-hash di browser dan disimpan di localStorage,
-- dengan nilai bawaan hardcoded di src/store/DbContext.jsx. Akibatnya:
--   - PIN bawaan terbaca siapa pun di repo publik
--   - PIN hanya berlaku di satu perangkat
--
-- Sekarang: hash PIN disimpan di admin_users.pin_hash, hanya bisa
-- dibaca/diubah oleh pemilik akun. PIN di-hash bersama user_id sebagai
-- garam (SHA-256 dari "<user_id>:<pin>") agar tidak mudah ditebak.
-- Jika pin_hash NULL, fitur kunci layar tidak aktif untuk akun itu.
--
-- ROLLBACK: DROP POLICY "admin_users_update_self" ON public.admin_users;
--           ALTER TABLE public.admin_users DROP COLUMN pin_hash;
-- ============================================================

ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS pin_hash text;

-- Admin hanya boleh mengubah barisnya sendiri (untuk menyimpan PIN)
DROP POLICY IF EXISTS "admin_users_update_self" ON public.admin_users;
CREATE POLICY "admin_users_update_self"
  ON public.admin_users FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
