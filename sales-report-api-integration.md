# B.Duck Sales Report API Integration

> Version: v1  
> Base URL: `https://cityfuns.joyworld.vn/api/v1`  
> Endpoint: `GET /reports/sales`  
> Auth: `Authorization: Bearer <INTERNAL_API_KEY>`

## Purpose

Use this API when an external system needs to pull paid-order revenue and sold-item data from B.Duck Ticketing for a selected time range.

The report includes:

- Revenue summary from paid orders
- Sold quantity by product
- Daily revenue rows
- Payment-provider breakdown
- Optional order details for reconciliation

## Authentication

Send the internal API key in the `Authorization` header.

```http
Authorization: Bearer <INTERNAL_API_KEY>
```

Do not expose this key in browser code, mobile apps, or public repositories.

## Request

```http
GET /api/v1/reports/sales?from=2026-06-01&to=2026-06-30
```

### Query Parameters

| Name | Required | Description |
| --- | --- | --- |
| `from` | Yes | Start time. Accepts `YYYY-MM-DD` or ISO-8601 datetime. Date-only values are interpreted as `00:00:00.000` in Vietnam time. |
| `to` | Yes | End time. Accepts `YYYY-MM-DD` or ISO-8601 datetime. Date-only values are interpreted as `23:59:59.999` in Vietnam time. |
| `includeOrders` | No | Set to `true` to include order-level rows for reconciliation. Default is `false`. |
| `orderLimit` | No | Max order rows returned when `includeOrders=true`. Min `1`, max `500`, default `100`. |

The maximum allowed range is 366 days.

### Time Zone

The report uses `Asia/Ho_Chi_Minh` for date-only input and daily grouping. The returned `range.from` and `range.to` values are ISO UTC timestamps.

## cURL Example

```bash
curl -s "https://cityfuns.joyworld.vn/api/v1/reports/sales?from=2026-06-01&to=2026-06-30" \
  -H "Authorization: Bearer <INTERNAL_API_KEY>"
```

With order details:

```bash
curl -s "https://cityfuns.joyworld.vn/api/v1/reports/sales?from=2026-06-01&to=2026-06-30&includeOrders=true&orderLimit=200" \
  -H "Authorization: Bearer <INTERNAL_API_KEY>"
```

## Success Response

```json
{
  "success": true,
  "generatedAt": "2026-06-25T08:30:00.000Z",
  "timeZone": "Asia/Ho_Chi_Minh",
  "range": {
    "from": "2026-05-31T17:00:00.000Z",
    "to": "2026-06-30T16:59:59.999Z"
  },
  "summary": {
    "orderCount": 120,
    "itemQuantity": 260,
    "passesIssued": 260,
    "grossRevenue": 39000000,
    "discountAmount": 1500000,
    "netRevenue": 37500000,
    "averageOrderValue": 312500
  },
  "dailySales": [
    {
      "date": "2026-06-01",
      "orderCount": 5,
      "itemQuantity": 12,
      "grossRevenue": 1800000,
      "discountAmount": 100000,
      "netRevenue": 1700000
    }
  ],
  "productSales": [
    {
      "productId": "prod_ticket_01",
      "productName": "Ve tham quan Joyworld",
      "productType": "ticket",
      "quantitySold": 180,
      "grossRevenue": 27000000,
      "netRevenue": 26000000,
      "orderCount": 90
    }
  ],
  "paymentProviders": [
    {
      "provider": "payos",
      "orderCount": 80,
      "netRevenue": 25000000
    }
  ]
}
```

## Field Notes

| Field | Meaning |
| --- | --- |
| `summary.grossRevenue` | Sum of order `subtotal` before discount. |
| `summary.discountAmount` | Sum of order discount amount. |
| `summary.netRevenue` | Sum of order `finalAmount`. This is the main revenue number. |
| `summary.itemQuantity` | Sum of purchased item quantities from order line items. |
| `summary.passesIssued` | Number of issued pass IDs on paid orders. |
| `productSales.grossRevenue` | Sum of line-item subtotals before order discount allocation. |
| `productSales.netRevenue` | Order final amount allocated proportionally to line items. |
| `dailySales.date` | Local Vietnam date in `YYYY-MM-DD`. |

Only orders with `status = "paid"` are included. The time filter is based on `createdAt` to match the admin dashboard convention.

## Optional Order Rows

When `includeOrders=true`, the response includes:

```json
{
  "orders": [
    {
      "id": "order_abc123",
      "orderNumber": "BDUCK-20260601-00001",
      "orderCode": "BDK-A3F9X2",
      "status": "paid",
      "customerName": "Nguyen Van A",
      "customerEmail": "a@example.com",
      "customerPhone": "0901234567",
      "paymentProvider": "counter",
      "subtotal": 300000,
      "discountAmount": 0,
      "finalAmount": 300000,
      "itemQuantity": 2,
      "passIds": ["pass_1", "pass_2"],
      "paidAt": "2026-06-01T05:00:00.000Z",
      "createdAt": "2026-06-01T04:50:00.000Z"
    }
  ],
  "ordersTruncated": false,
  "orderLimit": 100
}
```

If `ordersTruncated=true`, call again with a narrower time range or a higher `orderLimit` up to `500`.

## Error Responses

### Missing or Invalid Date Range

HTTP `400`

```json
{
  "success": false,
  "error": "INVALID_DATE_RANGE",
  "message": "Query params from and to are required. Use YYYY-MM-DD or ISO-8601 datetime."
}
```

### Range Too Large

HTTP `400`

```json
{
  "success": false,
  "error": "DATE_RANGE_TOO_LARGE",
  "message": "Date range must be 366 days or less."
}
```

### Unauthorized

HTTP `401`

```json
{
  "success": false,
  "error": "Unauthorized - invalid or missing API key"
}
```

### Server Error

HTTP `500`

```json
{
  "success": false,
  "error": "SERVER_ERROR",
  "message": "Unable to generate sales report."
}
```

## Recommended Sync Pattern

Pull data by completed business day:

```text
from = yesterday in Vietnam time, YYYY-MM-DD
to   = same date, YYYY-MM-DD
```

For reconciliation, store `generatedAt`, `range`, and the full response payload in the external system. If a retry is needed, repeat the same `from` and `to`; the endpoint is read-only and safe to call multiple times.
