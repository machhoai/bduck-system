type JsonRecord = Record<string, unknown>;

export const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as JsonRecord)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
};

export const parseJoyworldDate = (value: unknown): Date | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  const text = value.trim();
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)
    ? `${text.replace(" ", "T")}+07:00`
    : text;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
};

export const deriveAmountBeforeTax = (
  realMoney: number | null,
  taxMoney: number | null,
): number | null => {
  if (realMoney === null || taxMoney === null) return null;
  return realMoney - taxMoney;
};
