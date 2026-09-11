async function main() {
const credential = process.env.PROD_FIREBASE_SERVICE_ACCOUNT_BASE64;
if (!credential) throw new Error("PROD_FIREBASE_SERVICE_ACCOUNT_BASE64_REQUIRED");

process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 = credential;
process.env.FIREBASE_PROJECT_ID = "jw-system-f2104";
process.env.NODE_ENV = "production";
process.env.FIREBASE_STORAGE_BUCKET =
  process.env.PROD_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
  "jw-system-f2104.firebasestorage.app";

const { db, getCurrentFirebaseProjectId } = await import(
  "../apps/be-wms/src/config/firebase.js"
);

if (getCurrentFirebaseProjectId() !== "jw-system-f2104") {
  throw new Error("CONNECTED_FIREBASE_PROJECT_MISMATCH");
}

const warehouseId = "4ea64164-d889-43ee-82be-105eb88a3112";
const fromIso = "2026-08-31T17:00:00.000Z";
const toIso = "2026-09-10T17:00:00.000Z";

const snapshot = await db
  .collection("pos_orders")
  .where("warehouseId", "==", warehouseId)
  .where("paidAt", ">=", fromIso)
  .where("paidAt", "<", toIso)
  .get();

const paidStatuses = new Set([
  "LOCAL_PAID",
  "SYNCING",
  "SYNC_FAILED",
  "SYNC_SUCCESS",
]);
const localFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

const rows = snapshot.docs.map((doc) => {
  const data = doc.data() as Record<string, unknown>;
  const paidAt = String(data.paidAt ?? data.createdAt ?? "");
  const parts = Object.fromEntries(
    localFormatter.formatToParts(new Date(paidAt)).map((part) => [part.type, part.value]),
  );
  return {
    id: doc.id,
    localOrderId: data.localOrderId ?? null,
    paidAt,
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    status: String(data.status ?? ""),
    totalAmount: Number(data.totalAmount ?? 0),
  };
});

const included = rows.filter(
  (row) => paidStatuses.has(row.status) && row.hour >= 9 && row.hour <= 15,
);
const dates = Array.from({ length: 10 }, (_, index) =>
  `2026-09-${String(index + 1).padStart(2, "0")}`,
);
const summary = dates.map((date) => {
  const dateRows = included.filter((row) => row.date === date);
  return {
    date,
    hourly: Object.fromEntries(
      Array.from({ length: 7 }, (_, index) => {
        const hour = index + 9;
        const hourRows = dateRows.filter((row) => row.hour === hour);
        return [
          String(hour).padStart(2, "0") + ":00",
          {
            orders: hourRows.length,
            revenue: hourRows.reduce((sum, row) => sum + row.totalAmount, 0),
          },
        ];
      }),
    ),
    orderCount: dateRows.length,
    revenue: dateRows.reduce((sum, row) => sum + row.totalAmount, 0),
  };
});

console.log(
  JSON.stringify(
    {
      projectId: getCurrentFirebaseProjectId(),
      warehouseId,
      fetched: rows.length,
      statuses: Object.fromEntries(
        [...new Set(rows.map((row) => row.status))].sort().map((status) => [
          status,
          rows.filter((row) => row.status === status).length,
        ]),
      ),
      summary,
    },
    null,
    2,
  ),
);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
