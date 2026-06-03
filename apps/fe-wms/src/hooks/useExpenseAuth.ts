"use client";

/**
 * useExpenseAuth — Dual-Matrix RBAC hook for Expense Management
 *
 * Checks if the current user can write to a specific expense category
 * for a given warehouse, using the Cost Center → Permission mapping.
 *
 * Rules:
 * - warehouseId === 'ALL' → always read-only (Consolidated view)
 * - Maps category to cost center → checks permission key
 * - Supports both global and warehouse-scoped permissions
 */

import { useUserStore } from "@/stores/useUserStore";
import {
  ExpenseCategory,
  ExpenseCostCenter,
} from "@bduck/shared-types";

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
  [ExpenseCategory.GIFT_EXPENSE]: ExpenseCostCenter.MARKETING,
  [ExpenseCategory.COGS]: ExpenseCostCenter.MARKETING,
  [ExpenseCategory.CONSUMABLE_SUPPLIES]: ExpenseCostCenter.OTHERS,
  [ExpenseCategory.OTHERS]: ExpenseCostCenter.OTHERS,
};

const COST_CENTER_PERMISSION: Record<ExpenseCostCenter, string> = {
  [ExpenseCostCenter.OPERATIONS]: "expenses.operations.write",
  [ExpenseCostCenter.HR]: "expenses.hr.write",
  [ExpenseCostCenter.MARKETING]: "expenses.marketing.write",
  [ExpenseCostCenter.OTHERS]: "expenses.others.write",
};

interface ExpenseAuthResult {
  canWrite: boolean;
  canRead: boolean;
  canClosePeriod: boolean;
  canReopenPeriod: boolean;
}

export function useExpenseAuth(
  warehouseId: string,
  category?: ExpenseCategory,
): ExpenseAuthResult {
  const hasPermission = useUserStore((s) => s.hasPermission);

  // Consolidated view is strictly read-only
  if (warehouseId === "ALL") {
    return {
      canWrite: false,
      canRead: hasPermission("expenses.consolidated.view"),
      canClosePeriod: false,
      canReopenPeriod: false,
    };
  }

  const canRead = hasPermission("expenses.read", warehouseId);
  const canClosePeriod = hasPermission("expenses.close_period", warehouseId);
  const canReopenPeriod = hasPermission("expenses.reopen_period", warehouseId);

  if (!category) {
    return { canWrite: false, canRead, canClosePeriod, canReopenPeriod };
  }

  const costCenter = CATEGORY_TO_COST_CENTER[category];
  const requiredPerm = COST_CENTER_PERMISSION[costCenter];
  const canWrite = hasPermission(requiredPerm, warehouseId);

  return { canWrite, canRead, canClosePeriod, canReopenPeriod };
}
