export type RevenueExportAliases = Record<string, string>;

export function revenueExportPreferenceKey(
  projectId: string,
  userId: string,
  source: string,
) {
  return `revenue-export-names:v1:${JSON.stringify([projectId, userId, source])}`;
}

export function readRevenueExportAliases(
  storage: Pick<Storage, "getItem">,
  key: string,
): RevenueExportAliases {
  const raw = storage.getItem(key);
  if (!raw) return {};
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      ([name, alias]) =>
        name.length <= 2048 &&
        typeof alias === "string" &&
        alias.trim().length > 0 &&
        alias.length <= 200,
    ),
  );
}

export function writeRevenueExportAliases(
  storage: Pick<Storage, "setItem">,
  key: string,
  aliases: RevenueExportAliases,
) {
  const normalized = Object.fromEntries(
    Object.entries(aliases).filter(
      ([name, alias]) =>
        name.length <= 2048 && alias.trim().length > 0 && alias.length <= 200,
    ),
  );
  storage.setItem(key, JSON.stringify(normalized));
}
