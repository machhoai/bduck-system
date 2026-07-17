import { ExpenseCategory, ExpenseCostCenter } from "@bduck/shared-types";

export const EXPENSE_CATEGORY_COST_CENTER: Record<
  ExpenseCategory,
  ExpenseCostCenter
> = {
  [ExpenseCategory.RENT]: ExpenseCostCenter.OPERATIONS,
  [ExpenseCategory.ELECTRICITY]: ExpenseCostCenter.OPERATIONS,
  [ExpenseCategory.WATER]: ExpenseCostCenter.OPERATIONS,
  [ExpenseCategory.TRASH_COLLECTION]: ExpenseCostCenter.OPERATIONS,
  [ExpenseCategory.DRINKING_WATER]: ExpenseCostCenter.OPERATIONS,
  [ExpenseCategory.SOCIAL_INSURANCE]: ExpenseCostCenter.HR,
  [ExpenseCategory.SALARY_FULLTIME]: ExpenseCostCenter.HR,
  [ExpenseCategory.SALARY_PARTTIME]: ExpenseCostCenter.HR,
  [ExpenseCategory.MARKETING]: ExpenseCostCenter.MARKETING,
  [ExpenseCategory.GIFT_EXPENSE]: ExpenseCostCenter.MERCHANDISE,
  [ExpenseCategory.COGS]: ExpenseCostCenter.MERCHANDISE,
  [ExpenseCategory.CONSUMABLE_SUPPLIES]: ExpenseCostCenter.OTHERS,
  [ExpenseCategory.OTHERS]: ExpenseCostCenter.OTHERS,
};

export const EXPENSE_COST_CENTER_COLORS: Record<ExpenseCostCenter, string> = {
  [ExpenseCostCenter.OPERATIONS]: "var(--color-brand-primary)",
  [ExpenseCostCenter.HR]: "var(--color-accent-warning)",
  [ExpenseCostCenter.MARKETING]: "var(--color-accent-success)",
  [ExpenseCostCenter.MERCHANDISE]: "#257a3e",
  [ExpenseCostCenter.OTHERS]: "var(--color-text-muted)",
};

export const getPreviousExpensePeriod = (period: string): string => {
  const [year, month] = period.split("-").map(Number);
  return month === 1
    ? `${year - 1}-12`
    : `${year}-${String(month - 1).padStart(2, "0")}`;
};

export const getExpenseMonthLabel = (period: string): string => {
  const [year, month] = period.split("-");
  return `${month}/${year}`;
};

export const buildExpenseKpi = (value: number, prevValue: number) => ({
  value,
  prevValue,
  trend:
    prevValue > 0
      ? parseFloat((((value - prevValue) / prevValue) * 100).toFixed(1))
      : 0,
});
