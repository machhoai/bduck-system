/**
 * Expense Dashboard Service — Real KPI Metrics
 *
 * ═══════════════════════════════════════════════════════════════
 * PURPOSE:
 * - Aggregate real expense data for dashboard KPI cards.
 * - Calculate revenue from completed SALE_POS export vouchers.
 * - Compute month-over-month trends (6-month window).
 * - Identify over-budget stores for director-level overview.
 *
 * DATA SOURCES:
 * - Firestore: `expenses` collection (expense documents)
 * - Firestore: `export_vouchers` + sub-collection `items`
 * - Firestore: `warehouses` (for store names)
 * ═══════════════════════════════════════════════════════════════
 */

import { db } from "../config/firebase.js";
import {
  ExpenseCategory,
  ExpenseCostCenter,
} from "@bduck/shared-types";
import type { ExpenseDocument } from "@bduck/shared-types";
import * as expenseRepo from "../repositories/expenseRepository.js";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface KPIMetric {
  value: number;
  prevValue: number;
  trend: number;
}

interface TrendPoint {
  month: string;
  revenue: number;
  expenses: number;
}

interface CostCenterBreakdownItem {
  costCenter: ExpenseCostCenter;
  amount: number;
  percentage: number;
  color: string;
}

interface OverBudgetStoreItem {
  warehouseId: string;
  warehouseName: string;
  budgetUsed: number;
  totalBudget: number;
  totalActual: number;
}

export interface DashboardMetrics {
  grossRevenue: KPIMetric;
  totalExpenses: KPIMetric;
  netProfit: KPIMetric;
  profitMargin: KPIMetric;
  trendData: TrendPoint[];
  costCenterBreakdown: CostCenterBreakdownItem[];
  overBudgetStores: OverBudgetStoreItem[];
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

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

const COST_CENTER_COLORS: Record<ExpenseCostCenter, string> = {
  [ExpenseCostCenter.OPERATIONS]: "var(--color-brand-primary)",
  [ExpenseCostCenter.HR]: "var(--color-accent-warning)",
  [ExpenseCostCenter.MARKETING]: "var(--color-accent-success)",
  [ExpenseCostCenter.MERCHANDISE]: "#257a3e",
  [ExpenseCostCenter.OTHERS]: "var(--color-text-muted)",
};

function getPreviousPeriod(period: string): string {
  const [year, month] = period.split("-").map(Number);
  if (month === 1) return `${year - 1}-12`;
  return `${year}-${String(month - 1).padStart(2, "0")}`;
}

function getMonthLabel(period: string): string {
  const [year, month] = period.split("-");
  return `${month}/${year}`;
}

function buildKPI(value: number, prevValue: number): KPIMetric {
  const trend =
    prevValue > 0
      ? parseFloat((((value - prevValue) / prevValue) * 100).toFixed(1))
      : 0;
  return { value, prevValue, trend };
}

// ─────────────────────────────────────────────
// Revenue Calculation (from revenue_sync collection — JoyWorld API)
// ─────────────────────────────────────────────

async function calculateRevenue(
  _warehouseId: string | null,
  period: string,
): Promise<number> {
  // Revenue comes from JoyWorld system (global, not per-warehouse)
  const docRef = db.collection("revenue_sync").doc(period);
  const snap = await docRef.get();

  if (!snap.exists) return 0;

  const data = snap.data();
  return Number(data?.total_revenue ?? 0);
}

// ─────────────────────────────────────────────
// Expense Totals (from expense documents)
// ─────────────────────────────────────────────

function sumExpenseItems(
  docs: ExpenseDocument[],
  field: "actual_amount" | "budget_amount",
): number {
  let total = 0;
  for (const doc of docs) {
    for (const cat of Object.values(ExpenseCategory)) {
      const item = doc.items[cat];
      if (item) {
        total += (item[field] as number) ?? 0;
      }
    }
  }
  return total;
}

function buildCostCenterBreakdown(
  docs: ExpenseDocument[],
): CostCenterBreakdownItem[] {
  const totals: Record<ExpenseCostCenter, number> = {
    [ExpenseCostCenter.OPERATIONS]: 0,
    [ExpenseCostCenter.HR]: 0,
    [ExpenseCostCenter.MARKETING]: 0,
    [ExpenseCostCenter.MERCHANDISE]: 0,
    [ExpenseCostCenter.OTHERS]: 0,
  };

  for (const doc of docs) {
    for (const cat of Object.values(ExpenseCategory)) {
      const item = doc.items[cat];
      if (item) {
        const cc = CATEGORY_TO_COST_CENTER[cat];
        totals[cc] += item.actual_amount ?? 0;
      }
    }
  }

  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);

  return Object.values(ExpenseCostCenter).map((cc) => ({
    costCenter: cc,
    amount: totals[cc],
    percentage:
      grandTotal > 0 ? Math.round((totals[cc] / grandTotal) * 100) : 0,
    color: COST_CENTER_COLORS[cc],
  }));
}

// ─────────────────────────────────────────────
// Over-Budget Stores
// ─────────────────────────────────────────────

async function getOverBudgetStores(
  period: string,
): Promise<OverBudgetStoreItem[]> {
  const docs = await expenseRepo.findByPeriod(period);
  if (docs.length === 0) return [];

  // Fetch warehouse names
  const whSnap = await db
    .collection("warehouses")
    .where("is_deleted", "==", false)
    .get();
  const whNames: Record<string, string> = {};
  for (const d of whSnap.docs) {
    whNames[d.id] = (d.data().name as string) || d.id;
  }

  const results: OverBudgetStoreItem[] = [];

  for (const doc of docs) {
    let totalActual = 0;
    let totalBudget = 0;

    for (const cat of Object.values(ExpenseCategory)) {
      const item = doc.items[cat];
      if (item) {
        totalActual += item.actual_amount ?? 0;
        totalBudget += (item.budget_amount as number) ?? 0;
      }
    }

    if (totalBudget > 0) {
      const budgetUsed = Math.round((totalActual / totalBudget) * 100);
      if (budgetUsed > 100) {
        results.push({
          warehouseId: doc.warehouse_id,
          warehouseName: whNames[doc.warehouse_id] || doc.warehouse_id,
          budgetUsed,
          totalBudget,
          totalActual,
        });
      }
    }
  }

  return results.sort((a, b) => b.budgetUsed - a.budgetUsed);
}

// ─────────────────────────────────────────────
// Trend Data (6-month window)
// ─────────────────────────────────────────────

async function getTrendData(
  warehouseId: string,
  currentPeriod: string,
): Promise<TrendPoint[]> {
  const periods: string[] = [];
  let period = currentPeriod;
  for (let i = 0; i < 6; i++) {
    periods.unshift(period);
    period = getPreviousPeriod(period);
  }

  const results = await Promise.all(
    periods.map(async (p) => {
      const isAll = warehouseId === "ALL";
      const docs = isAll
        ? await expenseRepo.findByPeriod(p)
        : await expenseRepo
            .getById(`${warehouseId}_${p}`)
            .then((d) => (d ? [d] : []));

      const expenses = sumExpenseItems(docs, "actual_amount");
      const revenue = await calculateRevenue(
        isAll ? null : warehouseId,
        p,
      );

      return {
        month: getMonthLabel(p),
        revenue,
        expenses,
      };
    }),
  );

  return results;
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

export async function getDashboardMetrics(
  warehouseId: string,
  period: string,
): Promise<DashboardMetrics> {
  const isAll = warehouseId === "ALL";
  const prevPeriod = getPreviousPeriod(period);

  // Current period data
  const currentDocs = isAll
    ? await expenseRepo.findByPeriod(period)
    : await expenseRepo
        .getById(`${warehouseId}_${period}`)
        .then((d) => (d ? [d] : []));

  // Previous period data (for MoM comparison)
  const prevDocs = isAll
    ? await expenseRepo.findByPeriod(prevPeriod)
    : await expenseRepo
        .getById(`${warehouseId}_${prevPeriod}`)
        .then((d) => (d ? [d] : []));

  // Revenue
  const [currentRevenue, prevRevenue] = await Promise.all([
    calculateRevenue(isAll ? null : warehouseId, period),
    calculateRevenue(isAll ? null : warehouseId, prevPeriod),
  ]);

  // Expense totals
  const currentExpenses = sumExpenseItems(currentDocs, "actual_amount");
  const prevExpenses = sumExpenseItems(prevDocs, "actual_amount");

  // Net profit
  const currentNet = currentRevenue - currentExpenses;
  const prevNet = prevRevenue - prevExpenses;

  // Profit margin
  const currentMargin =
    currentRevenue > 0 ? (currentNet / currentRevenue) * 100 : 0;
  const prevMargin = prevRevenue > 0 ? (prevNet / prevRevenue) * 100 : 0;

  // Parallel: trend data + over-budget + cost center
  const [trendData, overBudgetStores] = await Promise.all([
    getTrendData(warehouseId, period),
    isAll ? getOverBudgetStores(period) : Promise.resolve([]),
  ]);

  const costCenterBreakdown = buildCostCenterBreakdown(currentDocs);

  return {
    grossRevenue: buildKPI(currentRevenue, prevRevenue),
    totalExpenses: buildKPI(currentExpenses, prevExpenses),
    netProfit: buildKPI(currentNet, prevNet),
    profitMargin: buildKPI(
      parseFloat(currentMargin.toFixed(1)),
      parseFloat(prevMargin.toFixed(1)),
    ),
    trendData,
    costCenterBreakdown,
    overBudgetStores,
  };
}
