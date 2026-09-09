# Employee offboarding rollout

## Business rule

- `resignation_date` is the first day the employee no longer works.
- Before that date, historical attendance remains visible.
- From that date onward, attendance is not applicable and new check-ins or late-arrival reports are rejected.
- When a resignation transition becomes effective, the employee profile and linked user become inactive in the same Firestore transaction.
- Active warehouse-role assignments are closed with `valid_until` set to the day before the resignation date. Materialized access is invalidated, never hard-deleted.
- Firebase Authentication disablement and refresh-token revocation are handled by an idempotent outbox job. The transition attempts it immediately; Cloud Scheduler retries pending jobs every five minutes.
- An account linked to a resigned profile cannot be manually reactivated. Rehiring must use a separate lifecycle flow.

## Deployment order

1. Deploy shared types, backend, frontend, and Firestore Rules together.
2. Configure `EMPLOYEE_EMPLOYMENT_CRON_SECRET` in the backend runtime and deployment shell.
3. Deploy the scheduler jobs with `infra/gcp/deploy-hr-schedulers.ps1`. This preserves the daily 00:01 employment-transition job and adds the five-minute identity retry job.
4. Run the reconciliation in dry-run mode and review its JSON output:

   ```powershell
   pnpm --filter @bduck/be-wms reconcile:employee-offboarding
   ```

   For production (`jw-system-f2104`), use the guarded production runner:

   ```powershell
   pnpm --filter @bduck/be-wms reconcile:employee-offboarding:production
   ```

5. After reviewing the exact employee IDs and issues, repair existing inconsistencies:

   ```powershell
   pnpm --filter @bduck/be-wms reconcile:employee-offboarding:apply
   ```

   Apply to production only after reviewing the production dry-run:

   ```powershell
   pnpm --filter @bduck/be-wms reconcile:employee-offboarding:production:apply
   ```

6. Run dry-run again. `inconsistent_profiles` should be zero except non-repairable data-quality findings such as a missing linked user or Firebase Authentication account.

## Verification checklist

- Create a future-dated resignation and confirm it remains scheduled before the effective date.
- At or after 00:01 Asia/Ho_Chi_Minh on the effective date, confirm profile and user status are inactive, role assignments are closed, and materialized access is invalidated.
- Confirm the existing session loses direct Firestore access and API access.
- Confirm a new login is rejected and Firebase Authentication is disabled.
- Confirm the attendance page shows historical days before resignation and “Không áp dụng” / “不适用” from the resignation date onward.
- Confirm check-in and late-arrival endpoints reject the resigned employee.
- Confirm audit records exist for the transition, profile, user, role assignments, materialized access, and identity-sync job.

## Operational recovery

- Inspect failed documents in `employee_identity_sync_jobs`; the scheduler retries them with exponential backoff.
- Re-run the dry-run reconciliation after any incident or manual data correction.
- Do not manually set a resigned account to active. Use the future rehire flow so employment state, permissions, and identity are restored coherently.
