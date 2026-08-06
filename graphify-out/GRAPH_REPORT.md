# Graph Report - .  (2026-08-06)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 196 nodes · 385 edges · 24 communities (16 shown, 8 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ebc27608`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- devDependencies
- fmtRp
- dependencies
- DbContext.jsx
- billingEngine.js
- format.js
- useLaporanData.js
- useReportActions.js
- cek_duplikat.cjs
- cek_pengembalian.cjs
- cek_saldo.cjs
- dump_kas_lain.cjs
- check_all_pembayaran.cjs
- check_juni.cjs
- getWargaDeposit
- getWargaTunggakanLalu

## God Nodes (most connected - your core abstractions)
1. `fmtRp()` - 25 edges
2. `useDb()` - 19 edges
3. `useNotification()` - 17 edges
4. `MONTHS` - 11 edges
5. `getCycleMonthYear()` - 10 edges
6. `getWargaBillingSummary()` - 10 edges
7. `fmtDate()` - 10 edges
8. `Pembayaran()` - 9 edges
9. `filterKlrBySiklus()` - 8 edges
10. `Dashboard()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `addFootersToAllPages()` --references--> `jspdf`  [EXTRACTED]
  src/features/laporan-keuangan/services/reportExporter.js → package.json
- `ensureSpaceForSignature()` --references--> `jspdf`  [EXTRACTED]
  src/features/laporan-keuangan/services/reportExporter.js → package.json
- `generateMonthlyPDF()` --references--> `jspdf`  [EXTRACTED]
  src/features/laporan-keuangan/services/reportExporter.js → package.json
- `generateYearlyPDF()` --references--> `jspdf`  [EXTRACTED]
  src/features/laporan-keuangan/services/reportExporter.js → package.json
- `App()` --references--> `react`  [EXTRACTED]
  src/App.jsx → package.json

## Import Cycles
- None detected.

## Communities (24 total, 8 thin omitted)

### Community 0 - "devDependencies"
Cohesion: 0.06
Nodes (31): autoprefixer, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, devDependencies, autoprefixer (+23 more)

### Community 1 - "fmtRp"
Cohesion: 0.23
Nodes (17): useDb(), useNotification(), filterKlrBySiklus(), getCycleMonthYear(), getWargaTunggakanLalu(), evaluatePaymentStatus(), fmtDateTime(), fmtRp() (+9 more)

### Community 2 - "dependencies"
Cohesion: 0.09
Nodes (22): html2canvas-pro, jspdf-autotable, lucide-react, dependencies, html2canvas-pro, jspdf-autotable, lucide-react, react-dom (+14 more)

### Community 3 - "DbContext.jsx"
Cohesion: 0.13
Nodes (19): react, react, App(), AuditLog, Dashboard, DataWarga, LaporanKeuangan, Pembayaran (+11 more)

### Community 4 - "billingEngine.js"
Cohesion: 0.16
Nodes (16): getStatusInfo(), WargaDetailTable(), WargaRow(), getWargaDeposit(), calculateArrears(), calculateBill(), calculateDeposit(), filterByrBySiklus() (+8 more)

### Community 5 - "format.js"
Cohesion: 0.27
Nodes (7): LaporanControls(), PengeluaranTable(), SummaryCards(), TransactionLog(), fmtDate(), getCycleMonthYear(), MONTHS

### Community 6 - "useLaporanData.js"
Cohesion: 0.42
Nodes (8): prepareMonthlyData(), prepareYearlyData(), useLaporanData(), filterByrBySiklus(), getCycleDateRange(), calculateMonthlySummary(), calculatePendapatanAir(), calculateTotalTagihan()

### Community 7 - "useReportActions.js"
Cohesion: 0.42
Nodes (8): jspdf, jspdf, useReportActions(), addFootersToAllPages(), ensureSpaceForSignature(), generateMonthlyPDF(), generateYearlyPDF(), LaporanKeuangan()

## Knowledge Gaps
- **59 isolated node(s):** `{ createClient }`, `supabase`, `{ createClient }`, `supabase`, `{ createClient }` (+54 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `DbContext.jsx`, `useReportActions.js`?**
  _High betweenness centrality (0.330) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `dependencies`?**
  _High betweenness centrality (0.230) - this node is a cross-community bridge._
- **Why does `jspdf` connect `useReportActions.js` to `dependencies`?**
  _High betweenness centrality (0.159) - this node is a cross-community bridge._
- **What connects `{ createClient }`, `supabase`, `{ createClient }` to the rest of the system?**
  _59 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `DbContext.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13043478260869565 - nodes in this community are weakly interconnected._