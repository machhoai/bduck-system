const text = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const normalizeName = (value: unknown): string =>
  text(value)
    .normalize("NFKC")
    .toLocaleLowerCase("vi")
    .replace(/\s+/g, " ");

export const buildPosProductGroupKey = (value: {
  category?: unknown;
  typeId?: unknown;
  typeName?: unknown;
}): string => {
  const category = Number.isFinite(Number(value.category))
    ? Number(value.category)
    : 0;
  const typeId = normalizeName(value.typeId);
  if (typeId) return `category:${category}:id:${typeId}`;
  const typeName = normalizeName(value.typeName);
  return typeName
    ? `category:${category}:name:${typeName}`
    : `category:${category}:ungrouped`;
};

export const isPosProductUpstreamVisible = (
  value: Record<string, unknown>,
): boolean =>
  value.isEnabled !== false &&
  value.isOpenSales !== false &&
  value.isCategoryEnabled !== false &&
  value.syncStatus !== "disabled";

