# Facility access scope rollout

## Business policy locked for implementation

- A facility is one of `OFFICE`, `MAIN` (warehouse), or `STORE`.
- A warehouse or store employee has access to their own workplace by default.
- An office employee inherits the warehouse/store scope configured for their workplace office.
- `ALL` is dynamic and includes warehouses/stores created in the future. It is not a global administrator grant.
- Offices do not manage other offices. Only system administrators can manage all offices.
- Office scope inheritance is not transitive.
- Access to business records follows the current effective scope; being the creator does not preserve access after revocation.
- A manager cannot grant roles, actions, or facilities beyond their own effective access.
- All removals use soft-delete and every scope mutation writes an audit log with `action_time` and `sync_time`.

## Authorization invariant

An operation is allowed only when all conditions are true:

1. The user is authenticated and active.
2. An active role grants the requested action.
3. The resource facility is inside the user's effective scope for that action.
4. Operation-specific constraints are satisfied (for example transfer source/destination policy and self-approval blocking).

Frontend visibility is never an authorization boundary. Backend authorization and Firestore Rules must both enforce this invariant.

## Rollout checklist

### Phase 0 - Inventory and safety net

- [x] Lock the business policy and non-transitive inheritance rules.
- [x] Inventory Firestore collections by protection class.
- [x] Inventory unsafe middleware, query, and realtime-listener patterns.
- [x] Add a machine-readable acceptance matrix for Office A, Office B, warehouse/store staff, and system admin.
- [x] Add an automated repository security audit in report mode.
- [x] Run the initial matrix validation and save the baseline audit result.

Phase 0 acceptance evidence:

- `security/facility-access-matrix.json`: 43 policy cases, validated by `pnpm test:access-matrix`.
- `security/firestore-protection-inventory.json`: canonical protection classes and denormalization blockers.
- `security/facility-access-baseline.json`: report-only baseline captured on 2026-07-15.
- Baseline findings: 41 unsafe authenticated Rules reads, 63 unbound any-scope guards, 58 unbound specific guards, 75 sensitive realtime references, 7 client-side access filters, and the active-user/cache/revocation gaps recorded by the audit.

### Phase 1 - Domain model and migration

- [x] Add shared types for office scope configuration, scope edges, effective grants, and access versioning.
- [x] Add validation schemas and collection constants.
- [x] Add repositories for scope configuration, edges, grants, and migration state.
- [x] Add an idempotent backfill command for workplace and legacy assignments.
- [x] Add dry-run, resumability, orphan detection, and audit output to the migration.

Phase 1 acceptance evidence:

- Versioned `user_access/{userId}/versions/{versionId}` snapshots reject
  mutation after activation, verify the complete grant manifest, and only
  advance the active version by one. `FAILED` snapshots remain auditable
  without blocking a recovery snapshot.
- Office-scope transactions enforce edge ownership and valid facility states,
  allow only `OFFICE -> MAIN|STORE`, and soft-deactivate every persisted edge
  when switching to `ALL`.
- `pnpm test:facility-access-planner`: 28 planner, version sequencing,
  office topology, lease, cursor, and crash-resume tests pass.
- `pnpm --filter @bduck/shared-types build`, shared typecheck, and backend typecheck pass.
- Apply mode requires an exact project confirmation; every domain mutation,
  audit record, source revalidation, lease check, cursor, and counter delta
  commits atomically. Dry-run has no write path.

### Phase 2 - Central backend authorization

- [x] Build one `AuthorizationService` for effective facility/action decisions.
- [x] Attach the access context in authenticated requests.
- [ ] Replace resource authorization based only on `requireAnyScopedPermission`.
- [x] Scope users, employee profiles, roles, and assignments; prevent privilege escalation.
- [x] Scope inventory, locations, and stock policies.
- [x] Scope import/export vouchers and their child records.
- [x] Scope transfers using source/destination operation policy.
- [ ] Scope stock counts, nonconformities, approvals, attendance, audit, expenses, and revenue.

### Phase 3 - Materialized effective grants

- [ ] Materialize per-user/per-facility grants with their source assignments.
- [ ] Recompute grants transactionally when scopes, roles, workplaces, or user status change.
- [ ] Increment `access_version` and write complete audit logs.
- [ ] Add idempotency and repair/rebuild commands.

### Phase 4 - Grant-aware realtime and Firestore Rules

- [ ] Add Firestore emulator security tests for every protection class.
- [ ] Replace broad frontend listeners with grant-compatible queries.
- [ ] Enforce user-private, global master-data, and facility-scoped rules.
- [ ] Cover transfer source/destination and child collection access.
- [ ] Remove blanket authenticated reads.

### Phase 5 - Office scope administration UI

- [ ] Add an Office scope editor with `ALL` and `SELECTED` modes.
- [ ] Group selectable targets into warehouses and stores.
- [ ] Show effective scope, inherited/direct sources, affected employee count, and audit history.
- [ ] Update employee/role forms to distinguish workplace, inherited scope, and exceptional direct grants.
- [ ] Add mobile-native layouts, skeletons, i18n, and promise toasts.

### Phase 6 - Revocation and offline cache

- [ ] Subscribe to the current user's access metadata and react to `access_version` changes.
- [ ] Cancel and recreate listeners immediately after a scope change.
- [ ] Isolate or clear sensitive persistent cache on logout and account switching.
- [ ] Verify offline revocation and shared-device scenarios.

### Phase 7 - Shadow rollout and cutover

- [ ] Log old/new authorization differences without blocking requests.
- [ ] Resolve data and policy mismatches.
- [ ] Cut backend authorization over first, then listeners and Firestore Rules.
- [ ] Enable repository security audit enforcement.
- [ ] Remove legacy scope parsing and global fallbacks.

### Phase 8 - End-to-end verification

- [ ] Verify Office A dynamic-all access.
- [ ] Verify Office B can access only Warehouse C and Store D.
- [ ] Verify warehouse/store staff self-scope.
- [ ] Verify user move, scope revoke, disabled user, deep links, direct Firestore access, and offline cache.
- [ ] Verify transfer source/destination actions and privilege-escalation denial.
- [ ] Complete operational and recovery documentation.

## Firestore protection inventory

The canonical, machine-readable inventory is `security/firestore-protection-inventory.json`. The lists below are a review summary; new collections must be classified in the JSON inventory before they are introduced.

### Global authenticated master data

These records may be shared across facilities but writes remain permission-controlled:

- `product_categories`
- `products`
- `product_bom`
- `organizations` (pending confirmation if suppliers become facility-owned)

### Global administrator configuration

- `roles`
- `workflow_definitions` and `versions`
- `process_configs`
- `file_templates`
- `report_templates` and `report_template_versions` (owner/private visibility is enforced separately)
- `system_configs` and `openapi_warehouse_configs`

### Facility-scoped data

- `warehouses`
- `warehouse_locations`
- `warehouse_location_slots`
- `warehouse_location_slot_products`
- `users` (through denormalized workplace facility)
- `employee_profiles`
- `user_warehouse_roles`
- `office_scope_configs` and `office_scope_edges`
- `audit_logs`
- `vouchers`
- `inventory`
- `inventory_stock_policies`
- `warehouse_attendance_policies`
- `warehouse_attendance_exemptions`
- `attendance_logs`
- `attendance_late_reports`
- `workflow_instances` and `tasks`
- `import_vouchers` and `items`
- `export_vouchers` and `items`
- `transfer_orders` and `items`
- `nonconformity_reports`
- `quarantine_records`
- `stock_count_sessions`
- `stock_count_items`
- `pending_approvals`
- `external_scan_queue` and `external_queue_scannable_products`
- purchase, adjustment, gift-export, and POS documents/items
- `report_exports`
- `expenses`
- `revenue_sync`
- `revenue_dashboards`, `orders`, and `sold_items`

### User-private or participant-only data

- `in_app_notifications`
- `notification_dispatches`
- `notification_push_tokens`
- `user_access` metadata and immutable version/facility subcollections
- `lan_transfer_presence`
- `lan_transfer_requests` and `signals`

### Backend-only internal data

- `account_invitations`
- `integration_clients`
- `counters`
- migration state documents

### Required denormalization before secure Rules

| Collection/resource               | Required access discriminator                              |
| --------------------------------- | ---------------------------------------------------------- |
| `users`                           | `workplace_facility_id`                                    |
| `stock_count_items`               | `warehouse_id` copied from the session                     |
| `quarantine_records`              | `warehouse_id` copied from the report                      |
| facility `audit_logs`             | required `facility_id`; null is global-admin only          |
| attachments                       | `access_class` and `facility_id`, or backend-only delivery |
| legacy workflow instances/tasks   | `facility_id`, or backend/admin-only access                |
| revenue dashboard parent/children | top-level `warehouse_id`                                   |

`revenue_sync` also has a document-key/schema mismatch: the backend uses a warehouse-period key while the frontend listens by period only. This must be aligned before scoped Rules are enabled.

## Transfer operation policy

| Operation                 | Required facility scope                     |
| ------------------------- | ------------------------------------------- |
| Read/list                 | Source or destination with `transfers.read` |
| Create/update/cancel/pick | Source with `transfers.write`               |
| Receive/confirm receipt   | Destination with `transfers.receive`        |
| Approve/reject            | Facility configured for that approval step  |
