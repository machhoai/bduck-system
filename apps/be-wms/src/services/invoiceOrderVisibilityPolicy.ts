const finiteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const invoiceOrderShouldAppearInList = (
  order: Record<string, unknown>,
): boolean => {
  const total = finiteNumber(order.real_money);
  const status = finiteNumber(order.source_status);
  return !(total === 0 && status !== 3);
};
