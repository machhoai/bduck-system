import type { RevenueProductGroups } from "@bduck/shared-types";

import { db } from "../config/firebase.js";

export async function fetchRevenueProductGroups(): Promise<RevenueProductGroups> {
  // Historical sales still need names from products that are no longer on sale.
  const snapshot = await db
    .collection("jpos_products")
    .select("goodsId", "typeName")
    .get();
  return Object.fromEntries(
    snapshot.docs.flatMap((document) => {
      const item = document.data();
      const goodsId =
        typeof item.goodsId === "string" ? item.goodsId.trim() : document.id;
      const groupName =
        typeof item.typeName === "string" ? item.typeName.trim() : "";
      return goodsId && groupName ? [[goodsId, groupName]] : [];
    }),
  );
}
