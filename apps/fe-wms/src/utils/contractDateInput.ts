export const normalizeContractDateInput = (value: string): string => {
  const digits = value.replace(/\D/gu, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  }
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
};
