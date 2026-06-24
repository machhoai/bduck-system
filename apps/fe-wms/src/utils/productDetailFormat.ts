export function formatProductDetailNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

export function formatProductDetailDate(value: unknown) {
  if (!value) return "-";
  if (value instanceof Date) return value.toLocaleDateString("vi-VN");
  if (typeof value === "object") {
    const candidate = value as { toDate?: () => Date; seconds?: number };
    if (typeof candidate.toDate === "function") {
      return candidate.toDate().toLocaleDateString("vi-VN");
    }
    if (typeof candidate.seconds === "number") {
      return new Date(candidate.seconds * 1000).toLocaleDateString("vi-VN");
    }
  }
  const parsed = new Date(value as string);
  return Number.isNaN(parsed.getTime())
    ? "-"
    : parsed.toLocaleDateString("vi-VN");
}
