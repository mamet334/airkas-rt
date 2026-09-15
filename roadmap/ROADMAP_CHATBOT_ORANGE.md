# ROADMAP: Resident Chatbot & Orange Data Mining Integration

Date: September 15, 2026
Author: Slamet (via Claude, discussion/design brief)
Status: PLANNING — NOT STARTED
Last updated: September 15, 2026 — UI, language, and name-matching decisions confirmed by Slamet.
Dependency: Requires `TASK_ADMIN_LOGIN.md` (RLS + Auth fix) to ship first.
This document is a design brief, not a build task — no AI coding agent
should implement from this file until Slamet explicitly starts a build
task for one of these two items.

---

## PART 1: RESIDENT CHATBOT

### 1.1 Purpose

A chatbot embedded in the AirKas RT live web app, for **residents**
(not admins), to answer questions about the RT's finances in natural
conversational form instead of requiring them to read raw
tables/reports.

**Core design principle: full transparency.** This is not a personal-
data-privacy chatbot — it's an accountability tool. Any resident can
ask about any other resident's payment status or amount, the RT's
total kas balance, expenses, and history, with no login or identity
check required to ask.

### 1.2 Scope of answerable questions

- Current kas balance (total money in vs out)
- Total pengeluaran (expenses) for a given period
- Who has / hasn't paid their water bill for a given month
- Individual resident's payment history (any resident can be named,
  not just "your own")
- Individual resident's current outstanding bill amount

### 1.3 What the chatbot does NOT do

- No write access of any kind — read-only, always. All INSERT/UPDATE/
  DELETE stays behind the admin-authenticated path defined in
  `TASK_ADMIN_LOGIN.md`.
- No resident login/identification step — the "full transparency"
  decision means the bot never needs to know who is asking.
- Should not expose residents' phone numbers or other non-financial
  personal data, even though financial data is open. Query from a
  restricted view (e.g. a `warga_public` view excluding `telepon`),
  not the raw `warga` table.

### 1.4 Technical approach — decided direction

**Phase 1 (build first): rule-based / keyword-intent dictionary.**
No AI/LLM API required — free, deterministic, easy to maintain.

Structure: each entry maps an **intent** → **trigger keywords /
synonyms** → **Supabase query** → **response template**.

Example shape (to be filled in fully when the build starts):

| Intent | Trigger keywords (examples) | Query target | Response template |
|---|---|---|---|
| `cek_saldo_kas` | "saldo", "kas berapa", "uang kas" | SUM(pembayaran) − SUM(pengeluaran) | "Saldo kas RT saat ini: Rp{saldo}" |
| `cek_tagihan` | "tagihan", "berapa bayar" | `meteran` filtered by resident name + unpaid | "Tagihan {nama} bulan {bulan}: Rp{total}" |
| `riwayat_bayar` | "riwayat", "history bayar" | `pembayaran` filtered by resident name | list of transactions |
| `belum_bayar` | "siapa belum bayar", "yang nunggak" | `warga` LEFT JOIN `pembayaran` WHERE unpaid | list of names |
| `total_pengeluaran` | "pengeluaran", "uang keluar" | SUM(`pengeluaran`) by period | "Total pengeluaran bulan {bulan}: Rp{total}" |

Design notes for the eventual build:
- Each intent needs multiple synonym phrasings (residents won't all
  phrase things the same way).
- Some intents need parameter extraction from free text (e.g. a month
  name like "Agustus" → month number, or a resident's name).
- Needs a fallback response for unmatched input ("Maaf saya belum
  paham, coba tanya soal saldo/tagihan/riwayat").

**Phase 2 (optional, later): LLM-based NLU (e.g. Claude API).**
Only if Phase 1 proves too rigid for how residents actually ask
questions. In this model, the LLM would handle natural-language intent
detection, but the app's own backend — not the LLM — would still be
the only thing that executes the Supabase query (the LLM should not
be given direct DB write access, and should ideally not be given a
raw DB credential at all — it identifies intent, the app runs the
query).

Cost note: Phase 1 is free indefinitely (no external API). Phase 2 has
a small per-request API cost — likely low for RT-scale traffic, but
not zero, and requires a backend proxy so the API key is never
exposed client-side.

### 1.5 UI — DECIDED (15 Sept 2026)

**Floating draggable bubble button.**

- Chatbot muncul sebagai tombol gelembung (bubble) melayang di atas
  semua konten, posisi awal pojok kanan bawah layar.
- Pengguna dapat **menyeret (drag) bubble** ke posisi mana saja di
  layar — posisi terakhir disimpan di `localStorage` agar tidak
  reset setiap reload.
- Klik bubble membuka panel chat kecil (inline, bukan halaman baru).
  Klik ulang atau tombol ✕ menutup panel.
- Bubble dan panel chat **tidak tercetak** saat print (`no-print` class,
  sama dengan sidebar dan header).
- Bubble tampil di semua tab/halaman — tidak perlu navigasi khusus.

### 1.6 Bahasa — DECIDED (15 Sept 2026)

**Bahasa Indonesia saja.**

- Semua keyword/trigger dictionary ditulis dalam Bahasa Indonesia.
- Tidak ada dukungan bahasa Jawa atau bahasa lain.
- Response template seluruhnya dalam Bahasa Indonesia.

### 1.7 Name matching — DECIDED (15 Sept 2026)

**Nama warga di database bersifat campuran huruf besar/kecil.**

- Matching nama dari teks bebas harus dilakukan secara
  **case-insensitive** (misalnya "bowo", "Bowo", "BOWO" semuanya
  cocok dengan data "bowo" atau "Bowo" di database).
- Gunakan `.toLowerCase()` / `.toUpperCase()` secara konsisten saat
  membandingkan nama dari input user dengan data `warga`.
- Pertimbangkan fuzzy partial match (`.includes()`) untuk menangani
  input seperti "pak bowo" yang perlu diekstrak menjadi "bowo"
  sebelum dicocokkan.



### 1.8 Prerequisite from TASK_ADMIN_LOGIN.md

The chatbot depends on RLS SELECT being open on `pembayaran`,
`pengeluaran`, `meteran`, `warga` (or a `warga_public` view), and
WRITE being properly gated to authenticated admins only — this is
exactly what `TASK_ADMIN_LOGIN.md` delivers. Do not start chatbot
implementation before that task's Definition of Done is met.

---

## PART 2: ORANGE DATA MINING INTEGRATION

### 2.1 Purpose

Separate, long-term initiative unrelated to the chatbot. Uses AirKas
RT's data as a dataset for **predictive/analytical modeling**, using
Orange Data Mining's visual workflow tool (classification, clustering,
regression, visualization) — not for building a conversational
interface. Orange is not suited to chatbot construction (no natural-
language generation capability beyond basic text-mining/topic-
modeling add-ons).

### 2.2 Candidate analyses

- Clustering residents by payment behavior (e.g. who tends to pay
  late, patterns behind it)
- Forecasting next month's water usage from historical meter readings
- Trend visualization of kas inflow/outflow over time

### 2.3 Data pipeline (draft)

1. Export relevant tables (`pembayaran`, `pengeluaran`, `meteran`,
   possibly `warga` minus sensitive columns) from Supabase as CSV.
2. Import into Orange as a static dataset.
3. Build/iterate the analysis workflow in Orange's visual canvas.

This is a manual/periodic export process, not a live integration —
Orange works on a dataset snapshot, not a live DB connection. No
architectural changes to the AirKas RT app itself are required to
support this; it only needs a clean, exportable data source.

### 2.4 Relationship to the chatbot

None, architecturally. These are two independent downstream items that
both depend on the database being in good shape (which
`TASK_ADMIN_LOGIN.md` ensures), but do not depend on each other. They
can be sequenced in either order once that task is done.

---

## 3. OPEN ITEMS / NOT YET DECIDED

- Full intent/keyword dictionary for the chatbot (Section 1.4) — to be
  built out in detail when Slamet starts the chatbot build.
- Whether Phase 2 (LLM-based NLU) is ever needed, and if so, when.
- Specific Orange workflows/models to build — not yet scoped in
  detail.

## 4. REFERENCES

- `TASK_ADMIN_LOGIN.md` — prerequisite task (RLS + Auth), must ship first.
- Chat discussion with Claude, 13–15 September 2026 (AirKas RT chatbot
  & Orange Data Mining planning).
