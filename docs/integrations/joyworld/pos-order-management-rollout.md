# POS order management rollout

The list and local cancellation paths are production-ready after the checks in
this document. JoyWorld remote refund must remain disabled until the transport
and sandbox gates from Phase 0 are closed.

## Deployment order

1. Deploy the JPOS Functions release that includes the `pos_order_summaries`
   projection and the transactional synchronization claim guard.
2. Deploy `firestore.rules` and `firestore.indexes.json`; wait until all four
   order-summary sort indexes report ready.
3. Run `pnpm --filter @bduck/be-wms backfill:pos-order-lifecycle` without
   `--apply` and review the scanned/changed totals.
4. Run the same command with `--apply`. It adds lifecycle fields and summary
   projections without deleting or replacing local order history.
5. Deploy the JPULSE backend and frontend.
6. Grant `pos.orders.read`, `pos.orders.cancel_local`, and, only to approved
   operators, `pos.orders.refund_remote` at the intended store scope.

## Remote refund gates

Keep these defaults until the vendor supplies HTTPS or an approved private
egress path protects the bearer token and refund payload:

```dotenv
JOYWORLD_REFUND_ENABLED=false
JOYWORLD_REFUND_ALLOW_INSECURE_HTTP=false
```

After secure transport is available:

1. Configure `JOYWORLD_MANAGER_BASE_URL` and credentials.
2. Verify `JJ-BizCode` replay/expiry behavior with one separately approved
   sandbox refund. Never perform a live refund from CI.
3. Set `JOYWORLD_REFUND_ENABLED=true`. This enables the integration for every
   store; warehouse-scoped `pos.orders.refund_remote` permissions remain the
   authorization boundary. Monitor cancellation audit records and revenue
   reconciliation after rollout.

An order in `SYNCING`, `REFUNDING`, or `REFUND_UNKNOWN` is fail-closed. An order
linked to an in-flight or issued MISA invoice is also fail-closed. Operators
must reconcile an unknown refund outcome instead of retrying it blindly.

## Rollback

Disable `JOYWORLD_REFUND_ENABLED` first. This immediately prevents new remote
refund preflights and submissions while preserving local order, cancellation,
and audit records. The order list remains read-only and local cancellation can
remain enabled independently.
