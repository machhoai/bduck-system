import { db } from "../config/firebase.js";

export async function validateAtpSufficiency(voucherId: string): Promise<void> {
  const voucherRef = db.collection("export_vouchers").doc(voucherId);
  const voucherSnap = await voucherRef.get();
  if (!voucherSnap.exists) return;

  const voucher = voucherSnap.data()!;
  const warehouseId = voucher.warehouse_id as string;

  const itemsSnap = await voucherRef
    .collection("items")
    .where("is_deleted", "==", false)
    .get();

  for (const doc of itemsSnap.docs) {
    const item = doc.data();
    const requestedQty = item.quantity as number;
    const productId = item.product_id as string;
    const locationId = item.warehouse_location_id as string;

    // Query inventory for this product at this location
    // CRITICAL: Filter is_deleted client-side to avoid composite index requirement
    const invSnapRaw = await db
      .collection("inventory")
      .where("warehouse_id", "==", warehouseId)
      .where("warehouse_location_id", "==", locationId)
      .where("product_id", "==", productId)
      .limit(5)
      .get();
    const activeInvDocs = invSnapRaw.docs.filter(
      (d) => d.data().is_deleted !== true,
    );

    const currentAtp =
      activeInvDocs.length === 0
        ? 0
        : (activeInvDocs[0].data().atp_quantity as number) || 0;

    if (currentAtp < requestedQty) {
      // Resolve product name + location name for human-readable error
      let productLabel = productId;
      let locationLabel = locationId;
      try {
        const [productSnap, locationSnap] = await Promise.all([
          db.collection("products").doc(productId).get(),
          db.collection("warehouse_locations").doc(locationId).get(),
        ]);
        if (productSnap.exists) {
          const pData = productSnap.data()!;
          productLabel = `${pData.name || ""} (${pData.code || productId})`;
        }
        if (locationSnap.exists) {
          const lData = locationSnap.data()!;
          locationLabel = `${lData.name || ""} (${lData.code || locationId})`;
        }
      } catch {
        // Fallback to IDs if name resolution fails
      }

      throw Object.assign(new Error("Insufficient ATP"), {
        statusCode: 400,
        messages: {
          vi: `KhÃ´ng Ä‘á»§ tá»“n kho kháº£ dá»¥ng. Sáº£n pháº©m: ${productLabel}, Vá»‹ trÃ­: ${locationLabel}, ATP hiá»‡n táº¡i: ${currentAtp}, YÃªu cáº§u: ${requestedQty}.`,
          zh: `å¯ç”¨åº“å­˜ä¸è¶³ã€‚äº§å“ï¼š${productLabel}ï¼Œåº“ä½ï¼š${locationLabel}ï¼Œå½“å‰ATPï¼š${currentAtp}ï¼Œè¯·æ±‚ï¼š${requestedQty}ã€‚`,
        },
      });
    }
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// HELPERS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
