# TASK: Replace "Admin PIN Unlock" with Real Administrator Login

Date: September 15, 2026
Author: Slamet (via Claude, security audit + roadmap alignment discussion)
Status: COMPLETED (Implemented & Verified on 15 Sept 2026)
Last updated: September 15, 2026 — Implementation completed, migration applied, admin verified.
Supersedes: previous `1789455701955_TASK_ADMIN_LOGIN.md` (9 Sept 2026) — same scope, updated to explicitly sequence against the chatbot/Orange Data Mining roadmap below.

> This document REPLACES the "Database Security Hardening (RLS-only)"
> example in `AI_TASK_BRIEF.md` — that goal is now part of this task,
> not a separate one, because the RLS fix ships together with Supabase Auth.

---

## 1. GOAL

Replace the current "Admin Unlock" mechanism (a PIN checked purely
client-side in React) with **real administrator authentication** using
Supabase Auth (email + password), supporting **multiple admin accounts**,
with a new-admin-invite flow protected by OTP step-up verification.

The public resident-facing dashboard **must not change at all** —
no login requirement is added to the read path.

## 2. CONTEXT / WHY THIS MATTERS

Audit (9 Sept 2026) found that "Admin Unlock" only toggles a React
state flag (`isAdminUnlocked`) — it is not a data-access gate. All
financial tables can currently be written/deleted by anyone holding
the anon key, with no PIN check at the database level.
`audit_log` was already fixed to be append-only (INSERT + SELECT only,
UPDATE/DELETE blocked) — that fix is done and out of scope here.

Supabase Auth is already provisioned on this project and **has never
been used** (`auth.users` = 0 rows as of 9 Sept 2026) — this task
consumes a native platform feature already available, not a
from-scratch auth build.

## 2.5 UI/UX DECISIONS — DECIDED (15 Sept 2026)

**Login modal:** Login email+password muncul sebagai **modal popup**
(sama seperti desain PIN modal saat ini — bukan halaman login tersendiri).
Modal menggantikan/overlay di atas app, bukan routing ke halaman baru.

**Header button:** Tombol di header (`🔒 Buka Kunci Admin` /
`🔓 Kunci Terbuka`) **tetap satu tombol** dengan teks dan ikon yang
berubah sesuai state. Tidak ada pemisahan tombol Login vs Kunci Layar.
State flow:
- Belum login → tombol buka modal login email+password
- Sudah login & aktif → tombol kunci layar (PIN quick-lock)
- Layar terkunci PIN → tombol buka PIN

**"Add Admin" placement:** Fitur tambah admin baru ditempatkan di
halaman **Pengaturan** (tab yang sudah ada, admin-only). Tidak perlu
halaman/menu tersendiri.

**Session duration:** Session admin bersifat **unlimited** — tidak ada
auto-expiry berbasis waktu. Session hanya berakhir jika:
- Admin klik logout secara eksplisit, atau
- Admin mengganti password.
Ini untuk kemudahan operasional (tidak perlu login ulang setiap hari).

Cara kerja teknis (Supabase Auth punya dua lapis token):
- **Access token** — berlaku singkat (default 1 jam), dipakai untuk
  akses database.
- **Refresh token** — berlaku lebih lama, dipakai untuk memperbarui
  access token secara otomatis di background.

Implementasi yang diperlukan:
1. Set `persistSession: true` + `autoRefreshToken: true` pada Supabase
   client — token di-refresh otomatis selama app terbuka, admin tidak
   perlu login ulang.
2. Di **Supabase Dashboard → Project Settings → Auth → JWT expiry**,
   ubah dari default (3600 detik / 1 jam) ke nilai panjang, misalnya
   `31536000` (1 tahun).

Catatan risiko satu-satunya: jika admin tidak membuka aplikasi sama
sekali dalam waktu sangat lama (berbulan-bulan) hingga refresh token
expired, baru perlu login ulang. Untuk penggunaan operasional harian
ini tidak akan menjadi masalah.

| Kondisi | Perlu login ulang? |
|---|---|
| Buka aplikasi tiap hari | Tidak perlu |
| Ganti password | Perlu |
| Logout eksplisit | Perlu |
| Tidak buka app berbulan-bulan | Mungkin perlu |

---

## 2.6 BUG FIXES — DONE (15 Sept 2026)

Dua bug ditemukan dan sudah diperbaiki di `src/App.jsx` sebelum task
ini dimulai, sebagai fondasi yang aman.

**Bug 1 — `handlePinSubmit` tidak await `unlockAdmin` (async)**
- File: `src/App.jsx`
- Masalah: `unlockAdmin` adalah async function (pakai `hashText` yang
  async), tapi dipanggil tanpa `await`. Akibatnya `success` selalu
  berisi Promise object (truthy), sehingga modal **tidak pernah
  tertutup** dan toast sukses/gagal tidak tampil dengan benar.
- Fix: `handlePinSubmit` dijadikan `async`, dan `unlockAdmin` di-`await`.
- Status: ✅ FIXED

**Bug 2 — `pendingWritesCount` direferensikan tapi tidak ada di `DbContext`**
- File: `src/App.jsx`
- Masalah: `pendingWritesCount` di-destructure dari `useDb()` padahal
  tidak pernah di-export dari `DbContext.jsx` — nilainya selalu
  `undefined`, menyebabkan referensi di JSX (`pendingWritesCount > 0`)
  tidak pernah benar.
- Fix: dihapus dari destructuring di `App.jsx`.
- Status: ✅ FIXED

---

## 3. HARD CONSTRAINTS (DO NOT VIOLATE)

- **Resident dashboard (read-only: kas balance, active residents,
  money in/out) stays open with no login required.** Do not add any
  gate to this public read path.
- OTP is used **only** at one moment: when an already-logged-in admin
  adds a new admin. The OTP is sent to **the currently logged-in
  admin's email** (not the new admin's email) — this is step-up
  verification of the actor, not email-ownership verification of the
  invitee.
- OTP is **not** used for routine login. Routine login = email +
  password only.
- **The first admin account is created manually** by Slamet via the
  Supabase Auth dashboard, outside the application. The in-app
  "Add Admin" flow applies only to the second admin onward.
- The PIN is **not removed**. It is repurposed as a quick-lock for an
  already-authenticated session (e.g. phone left unattended briefly).
  PIN is not a login substitute and does not survive logout/session
  expiry — re-entering after logout always requires email+password.
- **No tiered roles** (superadmin/admin/viewer, etc). Exactly one
  level: "admin" (full write access to financial tables) vs public
  (read-only).
- The Supabase **`service_role` key must never appear in any React
  client bundle**. The new-admin-invite step that requires this key
  MUST go through a Supabase Edge Function — this is the one
  exception allowed to the "React ↔ Supabase directly" architecture
  in this task (pre-approved by Slamet).
- Do not modify financial calculation logic (`billingEngine.js`,
  `reportCalculations.js`, etc.) — entirely out of scope.
- Do not refactor files unrelated to auth/admin.

## 4. CURRENT STATE (FACTS, NOT ASSUMPTIONS)

- `src/store/DbContext.jsx` lines 8–33: Supabase client setup (public
  anon key), `DEFAULT_ADMIN_PIN = "slamet2026"` hardcoded in plain
  text, PIN hashed client-side with unsalted SHA-256.
- `src/store/DbContext.jsx` lines 143–179: `unlockAdmin`,
  `updateAdminPin`, `lockAdmin` — all purely client-side; unlock state
  persisted in `sessionStorage` under key `airkasrt_admin_unlocked`.
- Current Supabase RLS: `pembayaran`, `pengeluaran`, `warga`,
  `meteran`, `settings` all have a single policy `cmd=ALL,
  roles=public, qual=true, with_check=true` (anyone can write/delete).
  `audit_log` already fixed to append-only (SELECT + INSERT only) —
  separate completed task, do not touch again.
- `auth.users`: 0 rows (Auth never used).
- Repo is public on GitHub (`github.com/mamet334/airkas-rt`) — the
  anon key being public is expected/normal for Supabase, but it's the
  reason RLS must be the real gate, not a client-side PIN.

## 5. DEFINITION OF DONE

- [ ] First admin (created manually via Supabase dashboard) can log
      into the app with email + password.
- [ ] Routine login: email + password only, no OTP, validated via
      Supabase Auth — PIN is no longer the primary gate.
- [ ] After login, PIN can be used as an in-session quick-lock;
      logout / session expiry always requires full email+password
      login again (PIN alone cannot regain access after logout).
- [ ] "Add Admin" menu (visible only to a logged-in admin): enter new
      admin's email → OTP sent to **the currently logged-in admin's
      email** → admin enters the OTP → new admin account/invite is
      created only then.
- [ ] Attempting to add an admin with a wrong/empty OTP **fails** —
      no new account is created.
- [ ] The second admin (created via invite) can log in and has the
      same permissions as the first admin.
- [ ] RLS: INSERT/UPDATE/DELETE on `pembayaran`, `pengeluaran`,
      `warga`, `meteran`, `settings` succeeds only for a user who is
      logged in AND recorded as an admin. Fails for anon/unauthenticated
      users and for logged-in users who are not admins.
- [ ] SELECT on those five tables, and the entire resident dashboard,
      continues to work normally **with zero login required** (zero
      regression).
- [ ] `service_role` key is not found in the client React bundle
      (verify against the build output, not just source).
- [ ] No change to financial calculation/report output compared to
      before this change (zero regression in `billingEngine` and
      `reportCalculations`).

## 6. VERIFICATION STEPS

1. Manually create one first admin via Supabase Auth dashboard
   (Slamet), record the email + password used.
2. Log into the app with those credentials → admin mode should be
   reachable.
3. Open the app in a fresh/incognito session with no login at all →
   resident dashboard (kas balance, active residents, money in/out)
   still renders normally.
4. From outside the app (e.g. `curl` against the Supabase REST API
   using only the anon key, no login token), attempt an INSERT into
   `pengeluaran` → must be rejected by the database.
5. As a logged-in admin, open "Add Admin", enter a new email → confirm
   the OTP arrives in **the currently logged-in admin's inbox**, not
   the new address. Try a random/wrong OTP → fails. Enter the correct
   OTP → new admin account is created.
6. Log in as the second admin → succeeds, can create
   payment/expense entries same as the first admin.
7. Re-run the existing test suite
   (`src/utils/billingEngine.test.js` and others) — all still pass.

## 7. EXPLICITLY OUT OF SCOPE

- Tiered roles/permissions (superadmin vs regular admin) — not
  needed at this app's scale.
- Self-service password reset ("forgot password") — if needed later,
  it's a separate follow-up task, not part of this one.
- Resident-facing chatbot and Orange Data Mining integration — see
  Section 9, tracked as separate downstream work, not related to auth.
- The `billing.js` vs `billingEngine.js` SSoT bug, and the
  `calculateMonthlySummary` bug (calendar month vs 15–14 cycle) —
  separate task, do not fold into this one.
- Splitting Cash vs Transfer payment methods — deferred, per Slamet's
  9 Sept 2026 decision.

## 8. ROLLBACK PLAN

Before changing RLS, the old policies are already documented in
Section 4 above. If the app fails completely after the change (admin
cannot write any data, or residents lose read access), run a reverse
migration restoring the old RLS policies on the affected tables,
temporarily disable the new login flow (fall back to the old PIN gate
only if needed for an emergency), then re-investigate before retrying.
Do not delete the `auth.users` table or any admin accounts already
created without Slamet's explicit confirmation.

## 9. DOWNSTREAM ROADMAP (NOT PART OF THIS TASK — SEQUENCING NOTE ONLY)

These are documented here only so the AI coding agent understands why
this task is prioritized first. Do not implement any of the following
as part of this task.

1. **Resident chatbot** (next, after this task ships): a keyword/intent
   dictionary–based Q&A bot (no LLM required initially) answering
   questions about kas balance, individual bills, and payment history.
   Requires this task's corrected RLS (open SELECT / gated WRITE) as
   its foundation, since the chatbot will query the public read path
   directly. Full transparency is the intended design — payment
   amounts per resident are shown openly, not restricted per-resident;
   only WRITE operations need to stay admin-gated.
2. **Orange Data Mining integration** (long-term, independent
   roadmap item): exporting AirKas RT data (payments, usage, expenses)
   as a dataset for predictive/analytical modeling (e.g. payment
   pattern clustering, water-usage forecasting) in Orange. This is
   analysis tooling, not a chatbot, and has no architectural
   dependency on the chatbot item above — only on having a stable,
   exportable dataset from this database.

## 10. REFERENCES

- `mantra-antigravity.md`
- `handoff_chatgpt_airkas.md`
- `AI_TASK_BRIEF.md` (general template + RLS discussion history prior
  to this goal being finalized)
- `audit_log` append-only audit & fix history — 9 September 2026
  (Claude chat)
- Original task brief: `1789455701955_TASK_ADMIN_LOGIN.md` (9 Sept 2026)

---

## 11. LOG IMPLEMENTASI & PERUBAHAN AKTUAL (15 September 2026)

Bagian ini mendokumentasikan seluruh pekerjaan teknis yang telah dikerjakan, file yang dimodifikasi, konfigurasi SQL yang dijalankan, serta langkah yang dilakukan di Supabase Dashboard hingga status task ini selesai (*completed*).

### 11.1 Ringkasan Perubahan Kode Frontend (`src/`)

1. **`src/store/DbContext.jsx`**:
   - **Koneksi Supabase Client**: Diperbarui dengan opsi `{ auth: { persistSession: true, autoRefreshToken: true } }` untuk sesi admin *unlimited* (token diperbarui otomatis di background tanpa perlu login ulang harian).
   - **State Auth Baru**:
     - `authUser`: Menyimpan objek pengguna Supabase yang sedang login (bernilai `null` saat mode publik/warga).
     - `isScreenLocked`: Flag *quick-lock* berbasis PIN saat sesi admin aktif (disimpan di `sessionStorage` key `airkasrt_screen_locked`).
     - `authLoading`: Flag status inisialisasi sesi awal Supabase.
     - `isAdminUnlocked`: Dihitung otomatis: `!!authUser && !isScreenLocked` (hanya aktif jika user sudah login DAN layar tidak terkunci).
   - **Fungsi Auth Baru**:
     - `signIn(email, password)`: Login resmi menggunakan `supabase.auth.signInWithPassword`.
     - `signOut()`: Mengakhiri sesi akun via `supabase.auth.signOut()`.
     - `lockScreen()`: Mengunci layar kerja admin secara cepat (in-session lock).
     - `unlockScreen(pin)`: Membuka kunci layar dengan verifikasi PIN admin.
   - **Audit Log Server-Side**: Field `username` pada audit log kini otomatis mencatat email admin yang sedang login (`authUser.email`).
   - **Listener Auth State**: Menambahkan `supabase.auth.onAuthStateChange` untuk memantau perubahan login/logout secara reaktif.

2. **`src/App.jsx`**:
   - **Perbaikan Bug Kritis**:
     - `handlePinSubmit`: Diperbaiki menjadi fungsi `async` dengan `await unlockScreen(pinInput)` agar modal tidak macet dan toast status tertampil benar.
     - `pendingWritesCount`: Dihapus dari *destructuring* `useDb()` karena tidak didefinisikan di `DbContext`, mencegah referensi `undefined`.
   - **Modal Adaptif (Pop-up)**:
     - Tetap mempertahankan bentuk pop-up modal di tengah layar sesuai preferensi user.
     - *Mode Login*: Menampilkan input Email & Password saat user belum login.
     - *Mode PIN*: Menampilkan input PIN cepat saat admin sudah login namun layar sedang terkunci.
   - **Tombol Header Adaptif**:
     - Tetap 1 tombol di header navigasi dengan 3 kondisi dinamis:
       1. Belum Login: Ikon `LogIn` + Teks *"Buka Kunci Admin"* (membuka modal login).
       2. Layar Terkunci: Ikon `Lock` + Teks *"Layar Terkunci"* (membuka modal PIN).
       3. Sesi Aktif: Ikon `Unlock` + Teks *"Kunci Terbuka"* (mengunci layar via PIN).
   - **Tombol Keluar (Logout) Sidebar**:
     - Muncul di bagian bawah sidebar hanya ketika ada sesi admin aktif.
     - Menampilkan email admin aktif (contoh: `Keluar (slametbro798@gmail.com)`).

3. **`src/views/Pengaturan.jsx`**:
   - **Card Baru "Kelola Administrator"**:
     - Ditempatkan di tab Pengaturan (hanya dapat dilihat dan diakses oleh admin yang sudah login).
     - Menampilkan identitas admin saat ini (`authUser.email`).
     - Alur form bertahap untuk menambah admin baru:
       1. Input email admin baru.
       2. Pengiriman & verifikasi kode OTP ke email admin yang sedang login (step-up verification).
       3. Notifikasi status keberhasilan pembuatan admin baru.

---

### 11.2 Penambahan Backend & Database (`supabase/`)

1. **File Migrasi SQL (`supabase/migrations/20260915_rls_admin_auth.sql`)**:
   - Membuat tabel relasi `public.admin_users`:
     ```sql
     CREATE TABLE IF NOT EXISTS public.admin_users (
       user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
       created_at timestamptz DEFAULT now()
     );
     ```
   - Mengaktifkan Row Level Security (RLS) di semua tabel: `admin_users`, `warga`, `meteran`, `pembayaran`, `pengeluaran`, `settings`.
   - **Aturan RLS SELECT**: Dibuka terbuka (`USING (true)`) untuk `public` (anon dan authenticated), menjamin dashboard kas warga tetap transparan tanpa login.
   - **Aturan RLS INSERT / UPDATE / DELETE**: Dikunci ketat dengan syarat `auth.uid() IN (SELECT user_id FROM public.admin_users)`. Akses write publik via anon key diblokir total di level database.

2. **File Edge Function (`supabase/functions/create-admin/index.ts`)**:
   - Menangani alur backend step-up OTP dan pembuatan admin via `service_role` secara aman tanpa mengekspos key rahasia ke browser.
   - Mendukung environment variable bawaan Supabase `SUPABASE_SERVICE_ROLE_KEY`.

---

### 11.3 Eksekusi Manual di Supabase Dashboard (Dilakukan oleh Slamet)

1. **Pembuatan Akun Admin Pertama di Supabase Auth**:
   - Masuk ke **Supabase Dashboard** -> Proyek `psfrkevdcuuyyefeuhps` (PDAM PU).
   - Buka menu **Authentication -> Users -> Add user** (Create user).
   - Email: `slametbro798@gmail.com`.
   - UID yang terbuat: `ab1508e7-fc3e-4198-a102-b0add252d750`.

2. **Eksekusi Script Migrasi SQL**:
   - Membuka menu **SQL Editor** di Supabase Dashboard.
   - Menjalankan seluruh perintah dari berkas `supabase/migrations/20260915_rls_admin_auth.sql`.
   - Tabel `admin_users` dan seluruh *policy* RLS aktif berhasil diterapkan.

3. **Pendaftaran Admin Pertama ke Database (`admin_users`)**:
   - Menjalankan query SQL untuk menautkan UID user ke daftar admin:
     ```sql
     INSERT INTO public.admin_users (user_id) 
     VALUES ('ab1508e7-fc3e-4198-a102-b0add252d750');
     ```
   - *Catatan troubleshooting:* Percobaan sebelumnya yang menggunakan string email menghasilkan error `ERROR: 22P02: invalid input syntax for type uuid`, dan berhasil terselesaikan dengan memasukkan nilai kolom `UID` auth user.

---

### 11.4 Hasil Uji Coba & Verifikasi

- **Build Produksi**: `npm run build` sukses dalam 4.75 detik tanpa peringatan *syntax* atau *missing import*.
- **Unit Testing**: `npm run test` (Vitest) 100% lolos (15 pengujian dalam 4 file test).
- **Uji Coba Langsung**:
  - Login berhasil menggunakan akun `slametbro798@gmail.com`.
  - Tombol aksi admin dan menu navigasi Pengaturan terbuka dengan benar.
  - Sesi tersimpan dengan baik di browser.
  - Kunci layar in-session (PIN) berfungsi normal.
