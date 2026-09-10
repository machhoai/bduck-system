# JoyWorld refund contract discovery

Date: 2026-09-08  
Status: CONTRACT CAPTURED — secure transport and sandbox verification remain gated

## Verified endpoints

| Purpose | Method | Endpoint | Result |
| --- | --- | --- | --- |
| Manager authentication | POST | `/basic/manager/login/account` | Verified with existing backend credentials; token was not persisted |
| Resolve remote UUID | GET | `/order/manager/buy/order/list` | Exact `orderNumber` match resolved the expected UUID |
| Load local manager detail | GET | `/order/manager/buy/getorderdetails?orderId=...` | Observed before refund eligibility check |
| Check refund eligibility | POST | `/order/manager/orderrefund/check` | Body is `{ orderId }`; verified against an already-refunded order |
| Refund preflight/reconciliation | GET | `/order/manager/orderrefund/getdetails?orderId=...` | Verified with Bearer authentication |
| Submit refund | POST | `/order/manager/orderrefund/submit` | Request and success response captured |

The manager web application and backend both use `http://joyworld.jingjianx.vip`.
The installed cashier application exposes a parallel `/order/cashier/orderrefund`
namespace, but it depends on cashier/device authentication and is not selected for
JPULSE.

## Observed lifecycle

The redacted pre-refund response reported:

- `totalMoney = 180000`
- `items[0].qty = 1`
- `items[0].surplusQty = 1`
- `items[0].returnQty = 1`

After the successful refund, the same authenticated `getdetails` request reported:

- `totalMoney = 0`
- `totalNumber = 0`
- `items[0].surplusQty = 0`
- `payModeInfo = []`

The manager refund report also showed the matching purchase order, a `TD...`
refund order, cash payment, quantity 1, refund amount 180000, and success status.
This gives the reconciliation rule needed to prevent a duplicate full refund:
all selected lines must have positive `surplusQty`, and the calculated refundable
amount must match the local order snapshot before submit.

## Remote order ID resolution

JPOS currently persists `hkOrderNumber` but the refund preflight endpoint requires
the JoyWorld UUID `orderId`. A manager order-list query for the order's paid date,
followed by an exact `orderNumber` comparison, resolved the expected UUID from a
25-row result set. Production resolution must fail when there are zero or multiple
exact matches and must additionally compare store and amount.

## Transport findings

- HTTP responds and the authenticated GET contract works.
- HTTPS fails during the TLS handshake.
- HTTP does not redirect to HTTPS.
- `OPTIONS /order/manager/orderrefund/submit` returns 405 and does not publish a
  machine-readable contract.

Remote refund must stay behind a disabled feature flag until HTTPS is fixed by the
vendor or an approved private network/egress tunnel protects the bearer token and
payload.

## Captured submit contract

The manager UI submitted the following fields. Values in the repository fixture are
synthetic and contain no production identifiers:

```json
{
  "orderId": "<uuid>",
  "totalMoney": 222,
  "originalTotalMoney": 222,
  "remark": "<operator reason>",
  "isForcedRefund": true,
  "items": [
    {
      "goodsId": "<uuid>",
      "cancelQty": 1,
      "businessType": 0
    }
  ]
}
```

The submit request also carried these relevant headers:

- `Authorization: Bearer <token>`
- `Content-Type: application/json`
- `JJ-LANGUAGE: cn | vi`
- `JJ-BizCode: <dynamic value>`

Two captures produced different 32-character alphanumeric `JJ-BizCode` values.
Neither captured value is stored. Inspection of the executed refund component and
the static application bundle proves that this is a client-generated idempotency
key:

- `createCode(32)` selects each character from
  `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789` using
  `Math.random()`.
- `getBizCode()` lazily creates a value when none exists, then returns the current
  in-memory value.
- `refresh()` replaces it with a newly generated 32-character value.
- The refund dialog calls `refresh()` when it opens, uses `getBizCode()` for
  `/orderrefund/submit`, and calls `refresh()` again only after a successful
  response.
- A failed submit therefore keeps the same value for a retry. Closing and opening
  the dialog creates a new value. No client-side expiry is implemented.

JPULSE must never hard-code or reuse a captured value. The backend implementation
should use a cryptographically secure generator for the same 32-character
alphanumeric format and persist one key with the local refund command so network
retries reuse it. It should rotate/retire the key only when the refund reaches a
terminal outcome or the command is explicitly abandoned. Whether the remote
server imposes an expiry or rejects reuse after success still requires a sandbox
verification.

### Downloaded manager bundle inspection

The downloaded `index-d9b3f835.js` bundle was inspected by content (SHA-256
`6EAA205A161640EB28AFF6CAB22C4FCA44C404EAB3D516D524872D3B7EFA1B0D`). It contains
six literal `JJ-BizCode` call sites, but all six belong to the unrelated member
pass/store delay endpoints:

- `/member/cashier/memberpassticket/delay`
- `/member/cashier/memberstore/delay`

Those call sites initialize/reset the value with `dayjs().valueOf()` (a
millisecond timestamp). The bundle contains no `orderrefund` string or submit
endpoint. Its shared HTTP `transformRequest` only injects `Authorization` and
`JJ-LANGUAGE`; the Axios request forwards supplied custom headers without a
`JJ-BizCode` conversion. Therefore these six occurrences do not explain the
32-character value observed on the manager refund request.

The same bundle defines `loadFromNetwork(...)`, which fetches a route component
from its configured URL with a random query parameter and passes the response to
`ModuleLoader.useModule(...)`. That loader wraps the downloaded script and runs
it through `eval(...)`. Chrome consequently exposes the business component as a
runtime `VM...` source rather than as a separate static file. The captured submit
call stack confirms this split: the shared `post`/request/Axios frames point to
`index-d9b3f835.js`, while the immediate business caller is `M @ VM472:53`.
`VM472` (or the corresponding network-loaded component response), not the six
static-bundle occurrences, is the source that must be inspected for the refund
`JJ-BizCode` generator.

The downloaded runtime component `VM472` was subsequently inspected by content
(SHA-256 `FF2649186237E1B65DC33BAC481F53B338F453537E472BFAAD80C2FC32B628D9`). It
contains the complete refund caller and confirms:

```js
jingjian.https.post(
  "/order/manager/orderrefund/submit",
  payload,
  { "JJ-BizCode": jingjian.bizCode.getBizCode() }
)
```

The component refreshes the business code on dialog open and after success; the
`jingjian.bizCode` implementation and generator live in the static bundle as
described above.

The observed call order is:

1. `GET /buy/getorderdetails`
2. `POST /orderrefund/check`
3. `GET /orderrefund/getdetails`
4. `POST /orderrefund/submit`
5. `GET /buy/order/list`
6. `GET /system/notifymessage/getlatestnotify`

The last two calls refresh the manager UI and are not part of the core refund
transaction. JPULSE should reconcile using `check` and `getdetails`, not the notify
endpoint.

## Remaining release gates

1. Confirm server-side expiry and replay behavior for `JJ-BizCode` during a
   separately approved sandbox refund.
2. Execute that approved sandbox refund through the future backend client.
3. Provide HTTPS or an approved protected egress path.
4. Never call a live refund from CI.

## Phase 0 checklist

- [x] Verify manager authentication and GET preflight.
- [x] Verify exact `hkOrderNumber` to `orderId` resolution.
- [x] Record redacted pre-refund, post-refund, and submit-response fixtures.
- [x] Add Zod schemas and contract tests for observed data.
- [x] Confirm duplicate-refund reconciliation signals.
- [x] Assess HTTP/HTTPS transport.
- [x] Capture and redact the exact `/submit` request body and headers.
- [x] Add the `/orderrefund/check` request and observed response contract.
- [x] Replace the fail-closed request schema with the captured strict schema.
- [x] Establish the client-side source, format, and retry lifecycle for
  `JJ-BizCode`.
- [ ] Verify server-side expiry and replay behavior for `JJ-BizCode` in sandbox.
- [ ] Execute one approved sandbox refund against the final request contract.
- [ ] Approve a secure production transport path.
