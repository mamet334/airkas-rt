# AIRKAS RT - HANDOFF DOCUMENT FOR CHATGPT

## Project Overview
**AirKas RT** is a web-based financial ledger and reporting system built specifically for a neighborhood community (Rukun Tetangga / RT) to manage monthly water meter readings, billings, operational expenses, and community fund contributions (Patungan).

### Core Philosophy (CRITICAL RULES)
The primary directive of this project is: **"Kalkulator + Memori + Laporan" (Calculator + Memory + Report).**
- It is **NOT** an Enterprise ERP.
- It is **NOT** an accounting suite.
- **DO NOT** overengineer. Avoid abstractions, factory patterns, repositories, custom hooks, or splitting components "just for clean code".
- **DO NOT** rewrite or refactor code purely for aesthetic reasons (e.g. DRY). Only touch code if it fixes a real operational bug (data loss, wrong calculation, crash).
- Every change MUST be evaluated with: *"Will this reduce the likelihood of the treasurer making a financial mistake?"* If no, don't change it.

## Tech Stack
- **Frontend:** React.js (Vite), Tailwind CSS, Lucide Icons.
- **Backend/DB:** Supabase (Direct API via `@supabase/supabase-js`). No middleman server.
- **PDF Export:** `html2canvas-pro` and `jspdf`.

## Current State (Production Release - June 26, 2026)
The application has successfully completed rigorous business reliability hardening. The current version is 100% stable and deployed to Vercel (`https://airkas-rt.vercel.app`).

### Key Stable Features:
1. **Billing Engine SSoT:** All financial derivations (Tunggakan/Arrears, Deposit, Tagihan/Bills, Status Lunas/Paid) are exclusively computed by `src/utils/billingEngine.js`. This ensures the Dashboard, Payment Modal, and Financial Reports share identical numbers.
2. **Transaction Integrity:** Database writes via `DbContext.executeWrite` have a strict `try/catch` with `throw err` abort barriers. Double submits are blocked via `isSaving` React state.
3. **Data Validation Guardrails:** The system blocks negative payments, zero payments, reverse meter inputs, duplicate meter numbers, and undefined dates to protect the Kas RT balance from corruption.
4. **Smart Automation:** Overpayments dynamically convert into deposits. Arrears roll over automatically. Next month's bill effortlessly deducts deposits first. No manual inputs are required for these states.

## Architecture Context
- **Global State:** Handled natively via `src/store/DbContext.jsx`. The application operates entirely online but uses an optimistic UI approach for instant responsiveness.
- **Siklus/Cycles:** The RT calculates cycles from the 15th of the previous month to the 14th of the current month. Financial reports reflect this specific timeframe offset (handled by `cycleEngine.js`).
- **Dummy Meters:** Incomes like "Kas Lain" or "Patungan" that do not originate from a water bill rely on a virtual meter assigned to the `SISTEM` dummy user. This keeps the schema unified.

## Instructions for ChatGPT
1. Read the `mantra-antigravity.md` file in the project root to absorb standard operating procedures and deployment steps.
2. If the user requests a new feature, challenge them first on whether it breaks the "Calculator + Memory + Report" simplicity rule.
3. When fixing a bug, do not rewrite the entire file. Use targeted string replacements.
4. If asked to refactor or "clean up" components, firmly refuse unless a severe operational flaw is proven. Emphasize that the project is currently under a Code Freeze for structural changes.
