# Revenue export and all-store scope

## Confirmed scope

- Fix sales-composition exports and reconcile them with the selected period.
- Add all stores for LOCAL_POS, covering dashboard, charts, comparisons and export.
- Include only stores with revenue.read; exporting the entire selection requires revenue.export at every included store.
- Preserve existing revenue calculations, realtime listeners, session-only offline cache and Vietnamese/Chinese UI.
- No database migrations or business-data changes.

## Decisions

The user confirmed that both the screen and exported workbook must aggregate the authorized stores.
Reuse the existing multi-store POS listener and aggregate raw orders on the backend before calculating metrics. This preserves weighted averages and payment percentages.
Alternatives considered: adding completed dashboard metrics (incorrect averages/percentages), or accepting client totals for export (untrusted data).
ALL is a selection marker only. Backend resolves the actual readable stores from the authenticated authorization context, then checks export permission for each. Do not cache an ALL report in a shared warehouse document.
Keep bounded per-store reads and the existing export period limit; no new infrastructure or dependencies.

## Investigation

The latest sales-composition audit selects 2026-09-07, while the newest POS order currently has a 2026-09-06 paidAt. The user confirmed forgetting to select the export date. An empty period correctly produces zero revenue; do not substitute a different date or another store's data.
Hardened the backend business-date key with explicit YYYY-MM-DD assembly matching the frontend, and removed circular SUM formulas from empty worksheet totals. These are defensive fixes, not the confirmed cause of the reported empty period.
Installed Next.js is 15.5.18 and contains no dist/docs directory. Consulted the official Next.js 15 server/client components guide as fallback.

## Tasks

- [x] Read rules/types and confirm scope.
- [x] Trace data/export and inspect export audit metadata read-only.
- [x] Implement authorized ALL scope and multi-store aggregation.
- [x] Share realtime POS subscriptions across the dashboard, chart ranges and comparison periods; clear old results when the selected scope changes.
- [x] Align business-date keys and prevent empty-sheet circular totals.
- [x] Record export audits under each real warehouse ID, with a shared export ID and complete selected scope.
- [x] Test RBAC, date boundaries, duplicate order IDs, workbook values and type/lint checks.

## Validation

- 26 focused tests pass (revenue scope, workbook generation, POS aggregation, date filters and chart ranges).
- Frontend and backend full TypeScript checks pass.
- ESLint passes for all changed application code and tests; git diff --check passes.
- Read-only production-data verification for 2026-09-06: Landmark 81 = 5,440,000 VND / 17 orders; AEON Tan Phu = 24,600,000 VND / 60 orders. ALL = 30,040,000 VND / 77 orders. The generated workbook's summary and product total both match 30,040,000 VND.
- This verification read source records and generated an in-memory workbook; it did not write production data or create export audit records.
- No browser end-to-end session was run. Changes have not been deployed.
