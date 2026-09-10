/** Only reference metadata; contains no order or price information. */
export type RevenueProductGroups = Record<string, string>;

export interface RevenueExportProductOption {
  key: string;
  name: string;
  groupName: string;
  quantity: number;
  revenue: number;
}

export interface RevenueExportProductSelection {
  key: string;
  exportName?: string;
}

/** Matches the report's original group/name aggregation, before applying aliases. */
export function getRevenueProductKey(
  groupName: string,
  productName: string,
): string {
  return JSON.stringify([groupName, productName]);
}

export function resolveRevenueProductGroup(
  item: Record<string, unknown>,
  catalog: RevenueProductGroups = {},
): string {
  const meaningfulName = (value: unknown): string | null => {
    if (typeof value !== "string" || !value.trim()) return null;
    const name = value.trim();
    return /^(other|khác|chưa phân nhóm|未分类|其他|-)$/iu.test(name)
      ? null
      : name;
  };
  for (const value of [
    item.categoryName,
    item.goodsTypeName,
    item.showCategoryName,
    item.typeName,
  ]) {
    const name = meaningfulName(value);
    if (name) return name;
  }
  const goodsId = typeof item.goodsId === "string" ? item.goodsId.trim() : "";
  return (
    (Object.hasOwn(catalog, goodsId)
      ? meaningfulName(catalog[goodsId])
      : null) ?? "Khác"
  );
}
