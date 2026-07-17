import { ExpenseCategory, ExpenseCostCenter } from "@bduck/shared-types";

const CATEGORY_TO_COST_CENTER: Record<ExpenseCategory, ExpenseCostCenter> = {
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

const COST_CENTER_PERMISSION: Record<ExpenseCostCenter, string> = {
  [ExpenseCostCenter.OPERATIONS]: "expenses.operations.write",
  [ExpenseCostCenter.HR]: "expenses.hr.write",
  [ExpenseCostCenter.MARKETING]: "expenses.marketing.write",
  [ExpenseCostCenter.MERCHANDISE]: "expenses.merchandise.write",
  [ExpenseCostCenter.OTHERS]: "expenses.others.write",
};

export const expensePermissionForCategory = (
  category: ExpenseCategory,
): string => COST_CENTER_PERMISSION[CATEGORY_TO_COST_CENTER[category]];

export const expensePermissionForCostCenter = (
  costCenter: ExpenseCostCenter,
): string => COST_CENTER_PERMISSION[costCenter];

export const EXPENSE_WRITE_ACTIONS = Object.values(COST_CENTER_PERMISSION);
