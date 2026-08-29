export interface RevenueOrderFilters {
  employee: string;
  status: string;
  payment: string;
  minAmount: string;
  maxAmount: string;
  search: string;
}

export const emptyRevenueOrderFilters: RevenueOrderFilters = {
  employee: "",
  status: "",
  payment: "",
  minAmount: "",
  maxAmount: "",
  search: "",
};

export function matchesRevenueOrderFilters(
  item: {
    employeeName: string;
    statusLabel: string;
    payMethod: string;
    amount: number;
    searchable: string;
  },
  filters: RevenueOrderFilters,
): boolean {
  const min = Number(filters.minAmount || 0);
  const max = Number(filters.maxAmount || Number.POSITIVE_INFINITY);
  const search = filters.search.trim().toLowerCase();
  return (
    (!filters.employee || item.employeeName === filters.employee) &&
    (!filters.status || item.statusLabel === filters.status) &&
    (!filters.payment || item.payMethod === filters.payment) &&
    item.amount >= min &&
    item.amount <= max &&
    (!search || item.searchable.toLowerCase().includes(search))
  );
}

export function uniqueRevenueOrderValues(values: string[]): string[] {
  return Array.from(
    new Set(values.filter((value) => value && value !== "-")),
  ).sort((left, right) => left.localeCompare(right));
}

export function getPaginationPages(
  currentPage: number,
  totalPages: number,
): number[] {
  const start = Math.max(1, Math.min(currentPage - 1, totalPages - 2));
  const end = Math.min(totalPages, Math.max(currentPage + 1, 3));
  return Array.from(
    { length: Math.max(0, end - start + 1) },
    (_, index) => start + index,
  );
}
