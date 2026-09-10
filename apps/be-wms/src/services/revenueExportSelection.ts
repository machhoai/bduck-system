import {
  getRevenueProductKey,
  type RevenueDashboardData,
  type RevenueExportProductSelection,
} from "@bduck/shared-types";

export function applyRevenueProductSelection(
  data: RevenueDashboardData,
  selection?: RevenueExportProductSelection[],
): RevenueDashboardData {
  if (!selection) return data;
  const available = new Set(
    data.topProductGroups.flatMap((group) =>
      group.items.map((item) =>
        getRevenueProductKey(group.groupName, item.name),
      ),
    ),
  );
  const selected = new Map(
    selection.map((item) => [item.key, item.exportName]),
  );
  if (
    !selection.length ||
    selected.size !== selection.length ||
    selection.some((item) => !available.has(item.key))
  ) {
    throw Object.assign(new Error("INVALID_REVENUE_PRODUCT_SELECTION"), {
      statusCode: 409,
      messages: {
        vi: "Sản phẩm đã chọn không còn khớp với phạm vi báo cáo. Vui lòng kiểm tra lại lựa chọn.",
        zh: "所选商品与报表范围不符，请检查选择。",
      },
    });
  }
  const topProductGroups = data.topProductGroups.flatMap((group) => {
    const items = group.items
      .filter((item) =>
        selected.has(getRevenueProductKey(group.groupName, item.name)),
      )
      .map((item) => ({
        ...item,
        name:
          selected.get(getRevenueProductKey(group.groupName, item.name)) ||
          item.name,
      }));
    return items.length
      ? [
          {
            ...group,
            items,
            quantity: items.reduce((sum, item) => sum + item.quantity, 0),
            revenue: items.reduce((sum, item) => sum + item.revenue, 0),
            taxAmount: items.reduce(
              (sum, item) => sum + (item.taxAmount ?? 0),
              0,
            ),
          },
        ]
      : [];
  });
  const soldItems = data.soldItems
    .filter((item) =>
      selected.has(getRevenueProductKey(item.categoryName, item.goodsName)),
    )
    .map((item) => ({
      ...item,
      goodsName:
        selected.get(getRevenueProductKey(item.categoryName, item.goodsName)) ||
        item.goodsName,
    }));
  const orderIds = new Set(soldItems.map((item) => item.orderId));
  return {
    ...data,
    topProductGroups,
    soldItems,
    orders: data.orders.filter((order) => orderIds.has(order.orderId)),
  };
}
