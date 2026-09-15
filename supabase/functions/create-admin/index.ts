// supabase/functions/create-admin/index.ts
// Edge Function kelola administrator AirKas RT.
// Berjalan di server Supabase — service_role key tidak pernah dikirim ke browser.
//
// Aksi (POST JSON { action, ... }):
//   list_admins                       — admin yang login
//   create_admin { email, password }  — admin yang login + OTP email terverifikasi ≤ 10 menit
//   delete_admin { user_id }          — admin yang login + OTP email terverifikasi ≤ 10 menit
//
// OTP dikirim & diverifikasi oleh Supabase Auth di aplikasi (signInWithOtp + verifyOtp
// ke email admin yang sedang login). Function ini hanya memeriksa klaim `amr` di JWT:
// harus ada metode "otp" yang timestamp-nya masih baru. Tidak ada OTP yang disimpan di sini.
//
// Env otomatis dari Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Deploy dengan verify_jwt = false (token divalidasi manual lewat auth.getUser).

import { createClient } from 'npm:@supabase/supabase-js@2';

const OTP_MAX_AGE_SECONDS = 10 * 60;
const MIN_PASSWORD_LENGTH = 8;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const decodeJwtPayload = (jwt: string) => {
  const part = jwt.split('.')[1] ?? '';
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
  return JSON.parse(atob(b64));
};

// Token harus sudah divalidasi (auth.getUser) sebelum klaimnya dipercaya.
const hasRecentOtp = (jwt: string) => {
  try {
    const amr: { method: string; timestamp: number }[] = decodeJwtPayload(jwt).amr ?? [];
    const now = Math.floor(Date.now() / 1000);
    return amr.some((m) => m.method === 'otp' && now - m.timestamp <= OTP_MAX_AGE_SECONDS);
  } catch {
    return false;
  }
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method tidak diizinkan.' }, 405);

  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'Silakan login sebagai admin.' }, 401);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Validasi token pemanggil di server Auth
    const { data: { user: caller }, error: authError } = await admin.auth.getUser(jwt);
    if (authError || !caller) return json({ error: 'Sesi tidak valid. Silakan login ulang.' }, 401);

    // Pemanggil harus terdaftar sebagai admin
    const { data: callerRow } = await admin
      .from('admin_users')
      .select('user_id')
      .eq('user_id', caller.id)
      .maybeSingle();
    if (!callerRow) return json({ error: 'Akses ditolak: bukan administrator.' }, 403);

    const { action, email, password, user_id } = await req.json().catch(() => ({}));

    // ── list_admins ────────────────────────────────────────────────────────
    if (action === 'list_admins') {
      const { data: rows, error } = await admin
        .from('admin_users')
        .select('user_id, created_at')
        .order('created_at');
      if (error) throw error;

      const admins = await Promise.all((rows ?? []).map(async (row) => {
        const { data } = await admin.auth.admin.getUserById(row.user_id);
        return {
          user_id: row.user_id,
          email: data.user?.email ?? '(tidak diketahui)',
          created_at: row.created_at,
          last_sign_in_at: data.user?.last_sign_in_at ?? null,
        };
      }));
      return json({ admins });
    }

    if (action !== 'create_admin' && action !== 'delete_admin') {
      return json({ error: 'Aksi tidak dikenal.' }, 400);
    }

    // Aksi sensitif: wajib OTP email yang baru diverifikasi
    if (!hasRecentOtp(jwt)) {
      return json({ error: 'Verifikasi OTP diperlukan atau sudah kedaluwarsa. Minta kode OTP baru.', code: 'otp_required' }, 403);
    }

    // ── create_admin ───────────────────────────────────────────────────────
    if (action === 'create_admin') {
      const cleanEmail = String(email ?? '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return json({ error: 'Format email tidak valid.' }, 400);
      }
      if (String(password ?? '').length < MIN_PASSWORD_LENGTH) {
        return json({ error: `Password awal minimal ${MIN_PASSWORD_LENGTH} karakter.` }, 400);
      }

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: cleanEmail,
        password: String(password),
        email_confirm: true, // langsung aktif, tanpa email konfirmasi
      });
      if (createError || !created.user) {
        const msg = createError?.message ?? 'Gagal membuat akun.';
        return json({ error: /already|registered|exists/i.test(msg) ? 'Email sudah terdaftar.' : msg }, 400);
      }

      const { error: insertError } = await admin.from('admin_users').insert({ user_id: created.user.id });
      if (insertError) {
        await admin.auth.admin.deleteUser(created.user.id); // rollback akun
        throw insertError;
      }

      await admin.from('audit_log').insert({
        aksi: 'ADMIN',
        detail: `Menambah administrator ${cleanEmail} (oleh ${caller.email})`,
        created_at: new Date().toISOString(),
      });
      return json({ success: true, email: cleanEmail });
    }

    // ── delete_admin ───────────────────────────────────────────────────────
    if (!user_id) return json({ error: 'Admin yang akan dihapus belum dipilih.' }, 400);

    const { count } = await admin.from('admin_users').select('user_id', { count: 'exact', head: true });
    if ((count ?? 0) <= 1) return json({ error: 'Tidak bisa menghapus administrator terakhir.' }, 400);

    const { data: targetRow } = await admin
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user_id)
      .maybeSingle();
    if (!targetRow) return json({ error: 'Administrator tidak ditemukan.' }, 404);

    const { data: target } = await admin.auth.admin.getUserById(user_id);
    // Hapus akun login; baris admin_users ikut terhapus (ON DELETE CASCADE)
    const { error: deleteError } = await admin.auth.admin.deleteUser(user_id);
    if (deleteError) throw deleteError;

    await admin.from('audit_log').insert({
      aksi: 'ADMIN',
      detail: `Menghapus administrator ${target.user?.email ?? user_id} (oleh ${caller.email})`,
      created_at: new Date().toISOString(),
    });
    return json({ success: true, self: user_id === caller.id });
  } catch (err) {
    console.error('[create-admin] Error:', err);
    return json({ error: 'Terjadi kesalahan di server.' }, 500);
  }
});
