import {
  ExpenseCategory,
  ExpenseCostCenter,
} from "@bduck/shared-types";

export interface ExpenseCategoryConfig {
  key: ExpenseCategory;
  costCenter: ExpenseCostCenter;
  isSemiAuto: boolean;
}

export const EXPENSE_CATEGORY_CONFIGS: ExpenseCategoryConfig[] = [
  { key: ExpenseCategory.RENT, costCenter: ExpenseCostCenter.OPERATIONS, isSemiAuto: false },
  { key: ExpenseCategory.ELECTRICITY, costCenter: ExpenseCostCenter.OPERATIONS, isSemiAuto: false },
  { key: ExpenseCategory.WATER, costCenter: ExpenseCostCenter.OPERATIONS, isSemiAuto: false },
  { key: ExpenseCategory.TRASH_COLLECTION, costCenter: ExpenseCostCenter.OPERATIONS, isSemiAuto: false },
  { key: ExpenseCategory.DRINKING_WATER, costCenter: ExpenseCostCenter.OPERATIONS, isSemiAuto: false },
  { key: ExpenseCategory.SOCIAL_INSURANCE, costCenter: ExpenseCostCenter.HR, isSemiAuto: false },
  { key: ExpenseCategory.SALARY_FULLTIME, costCenter: ExpenseCostCenter.HR, isSemiAuto: false },
  { key: ExpenseCategory.SALARY_PARTTIME, costCenter: ExpenseCostCenter.HR, isSemiAuto: false },
  { key: ExpenseCategory.MARKETING, costCenter: ExpenseCostCenter.MARKETING, isSemiAuto: false },
  { key: ExpenseCategory.GIFT_EXPENSE, costCenter: ExpenseCostCenter.MERCHANDISE, isSemiAuto: true },
  { key: ExpenseCategory.COGS, costCenter: ExpenseCostCenter.MERCHANDISE, isSemiAuto: true },
  { key: ExpenseCategory.CONSUMABLE_SUPPLIES, costCenter: ExpenseCostCenter.OTHERS, isSemiAuto: false },
  { key: ExpenseCategory.OTHERS, costCenter: ExpenseCostCenter.OTHERS, isSemiAuto: false },
];

export const EXPENSE_COST_CENTER_ORDER: ExpenseCostCenter[] = [
  ExpenseCostCenter.OPERATIONS,
  ExpenseCostCenter.HR,
  ExpenseCostCenter.MARKETING,
  ExpenseCostCenter.MERCHANDISE,
  ExpenseCostCenter.OTHERS,
];

export const EXPENSE_CATEGORY_TO_COST_CENTER: Record<
  ExpenseCategory,
  ExpenseCostCenter
> = EXPENSE_CATEGORY_CONFIGS.reduce(
  (map, config) => ({ ...map, [config.key]: config.costCenter }),
  {} as Record<ExpenseCategory, ExpenseCostCenter>,
);
