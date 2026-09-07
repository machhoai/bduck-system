# Revenue export customization

## Confirmed requirements

- Three report choices: daily revenue, sales composition, invoice preparation file.
- Select products present in the selected period/store scope, with search and custom export names.
- User confirmed aliases affect only exports and are remembered per account in the browser.
- User confirmed invoice preparation uses LOCAL_POS only. OpenAPI remains available for daily/composition reports.
- Preserve authenticated RBAC for each store, audit exports and retain existing realtime POS data subscriptions.

## Design decisions

- Enrich missing order-item groups from jpos_products.typeName using goodsId; keep explicit historical group names when available. Include inactive catalog products so historical reports stay classifiable.
- Expose only product-ID/group reference metadata through an authenticated revenue endpoint. Keep direct Firestore access to jpos_products denied; the existing POS revenue listeners continue to deliver amounts in realtime.
- Use original group + product name as the selection identity, matching the existing report aggregation. Renamed products do not merge with another product that has the same alias.
- Backend reloads the authorized period and validates selections; client supplies keys/names only, never amounts. Selected-product totals must reconcile across exported sheets.
- Store aliases under project + account + source. Do not persist transaction amounts, selected products or customer data.
- Invoice workbook contains product lines by order, source warehouse, recorded tax/net/gross amounts, and payment method; optional integer-money rounding. It prepares data and does not issue invoices or apply a new tax rate.
- Reuse current loading/toast/export infrastructure. Split the modal editor, preference hook, data selection policy and invoice workbook into modules under 300 lines.

## Tasks

- [x] Inspect both reference dialogs and shared types; confirm alias storage and invoice source.
- [x] Enrich and align product groups in frontend/backend.
- [x] Add product selection and per-account aliases to modal.
- [x] Add backend selection validation, scoped totals and invoice workbook.
- [x] Verify selected/unselected products, same-name products in different groups, aliases, tax rounding, empty periods and access rules.

## Validation

- 26 focused tests pass for authorized store scope, Vietnam date boundaries, product-group enrichment, product selection, per-account preference keys, aliases, invoice tax/rounding and workbook contents.
- Shared types, frontend and backend TypeScript checks pass. ESLint passes for all changed application files; `git diff --check` passes.
- Backend production build passes. Frontend production compilation and all 43 static pages pass; the final standalone copy is blocked by Windows `EPERM` while creating dependency symlinks.
- Read-only data verification for 2026-09-06 returns 30,040,000 VND / 77 orders across the two authorized stores. Groups resolve to `[AMTP] Nạp thẻ`, `Vé lượt` and `[LM81] Nạp thẻ`, with no blanket `Other` group.
- In-memory verification generated a two-product composition workbook and a 39-line invoice-preparation workbook. It did not write production data or create export audit records.
- Browser verification was not run because `agent-browser` is unavailable in this workspace. Changes have not been deployed.
