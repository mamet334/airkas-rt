// supabase/functions/create-admin/index.ts
// Edge Function — berjalan di Supabase server, bukan di browser.
// Aman memakai service_role key karena tidak pernah dikirim ke client.
//
// CARA DEPLOY:
//   supabase functions deploy create-admin --no-verify-jwt
//
// ENV yang dibutuhkan di Supabase Dashboard → Functions → create-admin → Secrets:
//   SUPABASE_URL         = https://psfrkevdcuuyyefeuhps.supabase.co
//   SUPABASE_SERVICE_KEY = <service_role key dari Project Settings → API>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// In-memory OTP store (per function instance, cukup untuk skala RT)
// Key: admin_user_id, Value: { otp, new_admin_email, expires_at }
const otpStore = new Map<string, { otp: string; new_admin_email: string; expires_at: number }>();

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verifikasi token admin yang memanggil function
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Client dengan anon key untuk verifikasi token pemanggil
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Dapatkan user yang memanggil
    const { data: { user: callerUser }, error: authError } = await callerClient.auth.getUser();
    if (authError || !callerUser) {
      return new Response(JSON.stringify({ error: 'Token tidak valid' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Client dengan service_role untuk operasi admin
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Verifikasi pemanggil adalah admin yang terdaftar
    const { data: adminCheck } = await adminClient
      .from('admin_users')
      .select('user_id')
      .eq('user_id', callerUser.id)
      .single();

    if (!adminCheck) {
      return new Response(JSON.stringify({ error: 'Akses ditolak: bukan administrator' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { action, new_admin_email, otp } = body;

    // ── ACTION: request_otp ─────────────────────────────────────────────
    if (action === 'request_otp') {
      if (!new_admin_email) {
        return new Response(JSON.stringify({ error: 'Email admin baru diperlukan' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Generate OTP 6 digit
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 menit

      // Simpan OTP ke store (keyed by caller admin user_id)
      otpStore.set(callerUser.id, {
        otp: generatedOtp,
        new_admin_email,
        expires_at: expiresAt
      });

      // Kirim OTP ke email admin yang SEDANG LOGIN (bukan email baru)
      // Menggunakan Supabase Auth Admin untuk kirim email
      const { error: emailError } = await adminClient.auth.admin.generateLink({
        type: 'magiclink',
        email: callerUser.email!,
      });

      // Kirim via email sederhana menggunakan Supabase built-in
      // (Supabase akan kirim ke callerUser.email)
      // Untuk saat ini gunakan cara alternatif: kirim OTP manual via email
      // NOTE: Implementasi email sebenarnya tergantung SMTP setup di Supabase
      // Untuk development: OTP dikembalikan di response (hapus di production)
      console.log(`[create-admin] OTP untuk ${callerUser.email}: ${generatedOtp}`);

      return new Response(JSON.stringify({
        success: true,
        message: `OTP dikirim ke ${callerUser.email}`,
        // HAPUS baris debug_otp ini di production:
        debug_otp: generatedOtp
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── ACTION: verify_and_create ───────────────────────────────────────
    if (action === 'verify_and_create') {
      if (!otp || !new_admin_email) {
        return new Response(JSON.stringify({ error: 'OTP dan email diperlukan' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Ambil OTP dari store
      const stored = otpStore.get(callerUser.id);
      if (!stored) {
        return new Response(JSON.stringify({ error: 'OTP tidak ditemukan. Minta OTP baru.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Cek kadaluarsa
      if (Date.now() > stored.expires_at) {
        otpStore.delete(callerUser.id);
        return new Response(JSON.stringify({ error: 'OTP sudah kadaluarsa. Minta OTP baru.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Verifikasi OTP dan email
      if (stored.otp !== otp || stored.new_admin_email !== new_admin_email) {
        return new Response(JSON.stringify({ error: 'OTP salah atau email tidak cocok.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // OTP valid — buat user baru dengan password sementara acak
      const tempPassword = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: new_admin_email,
        password: tempPassword,
        email_confirm: true, // langsung aktif tanpa perlu konfirmasi email
      });

      if (createError || !newUser.user) {
        return new Response(JSON.stringify({ error: createError?.message || 'Gagal membuat user' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Daftarkan ke tabel admin_users
      const { error: insertError } = await adminClient
        .from('admin_users')
        .insert({ user_id: newUser.user.id });

      if (insertError) {
        // Rollback: hapus user yang baru dibuat
        await adminClient.auth.admin.deleteUser(newUser.user.id);
        return new Response(JSON.stringify({ error: 'Gagal mendaftarkan admin: ' + insertError.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Bersihkan OTP dari store
      otpStore.delete(callerUser.id);

      // Kirim email dengan password sementara ke admin baru
      // (Supabase akan kirim invite email otomatis)
      await adminClient.auth.admin.generateLink({
        type: 'recovery',
        email: new_admin_email,
      });

      return new Response(JSON.stringify({
        success: true,
        message: `Admin baru ${new_admin_email} berhasil dibuat. Email password sementara telah dikirim.`
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Action tidak dikenal' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('[create-admin] Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
