import {
  ExpenseCategory,
  ExpenseCostCenter,
} from "@bduck/shared-types";
import type { ExpenseDocument, ExpenseCustomItem } from "@bduck/shared-types";
import ExcelJS from "exceljs";
import {
  EXPENSE_CATEGORY_CONFIGS,
  EXPENSE_CATEGORY_TO_COST_CENTER,
} from "./expenseConfig";
import {
  buildExpenseHeaderAliases,
  extractExpenseOptionCode,
  getExcelCellText,
  normalizeExpenseIdentity,
  normalizeExpenseKey,
  normalizeExpenseRow,
  parseExpenseAmount,
} from "./expenseExcelParsing";
import type {
  ExpenseImportColumnKey,
  ExpenseImportLabels,
  ExpenseImportPreviewRow,
  ExpenseImportSummary,
  ExpenseImportTarget,
  ExpenseImportText,
} from "./expenseExcelTypes";

export type {
  ExpenseImportColumnKey,
  ExpenseImportLabels,
  ExpenseImportPreviewRow,
  ExpenseImportSummary,
  ExpenseImportTarget,
  ExpenseImportText,
} from "./expenseExcelTypes";

function buildCostCenterLookup(labels: ExpenseImportLabels) {
  const lookup = new Map<string, ExpenseCostCenter>();
  for (const costCenter of Object.values(ExpenseCostCenter)) {
    lookup.set(normalizeExpenseIdentity(costCenter), costCenter);
    lookup.set(normalizeExpenseIdentity(labels.costCenter[costCenter]), costCenter);
    lookup.set(
      normalizeExpenseIdentity(`${costCenter} - ${labels.costCenter[costCenter]}`),
      costCenter,
    );
  }
  return lookup;
}

function buildCategoryLookup(labels: ExpenseImportLabels) {
  const lookup = new Map<string, ExpenseCategory>();
  for (const config of EXPENSE_CATEGORY_CONFIGS) {
    lookup.set(normalizeExpenseIdentity(config.key), config.key);
    lookup.set(normalizeExpenseIdentity(labels.category[config.key]), config.key);
    lookup.set(
      normalizeExpenseIdentity(`${config.key} - ${labels.category[config.key]}`),
      config.key,
    );
  }
  return lookup;
}

function buildCustomItemLookup(customItems?: Record<string, ExpenseCustomItem>) {
  const lookup = new Map<string, ExpenseCustomItem>();
  for (const item of Object.values(customItems ?? {})) {
    if (item.is_deleted) continue;
    lookup.set(customItemLookupKey(item.cost_center, item.label), item);
  }
  return lookup;
}

function customItemLookupKey(costCenter: ExpenseCostCenter, label: string) {
  return `${costCenter}:${normalizeExpenseIdentity(label)}`;
}

export async function parseExpenseImportFile(
  file: File,
  options: {
    data: ExpenseDocument;
    labels: ExpenseImportLabels;
    text: ExpenseImportText;
  },
): Promise<ExpenseImportPreviewRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet("Expense_entry") ?? workbook.worksheets[0];

  if (!sheet) throw new Error(options.text.errors.noSheet);

  const headerAliases = buildExpenseHeaderAliases(options.text);
  const headers: Array<ExpenseImportColumnKey | null> = [];
  sheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber - 1] =
      headerAliases[normalizeExpenseKey(getExcelCellText(cell))] ?? null;
  });

  if (!headers.some(Boolean)) {
    throw new Error(options.text.errors.noRecognizedColumns);
  }

  const costCenterLookup = buildCostCenterLookup(options.labels);
  const categoryLookup = buildCategoryLookup(options.labels);
  const customItemLookup = buildCustomItemLookup(options.data.custom_items);
  const rows: ExpenseImportPreviewRow[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const raw = normalizeExpenseRow(row, headers);
    if (!Object.values(raw).some((value) => value.trim())) return;

    const hasImportValue =
      raw.budgetAmount.trim() || raw.actualAmount.trim() || raw.note.trim();
    if (!hasImportValue) {
      rows.push({ rowNumber, raw, target: null, skipped: true, errors: [] });
      return;
    }

    const errors: string[] = [];
    const costCenterCode = extractExpenseOptionCode(raw.costCenter);
    const costCenter = costCenterLookup.get(normalizeExpenseIdentity(costCenterCode));
    if (!costCenter) {
      errors.push(`${options.text.errors.invalidCostCenter}: ${raw.costCenter}`);
    }

    const itemCode = extractExpenseOptionCode(raw.itemCode);
    const categoryFromCode = itemCode
      ? categoryLookup.get(normalizeExpenseIdentity(itemCode))
      : undefined;
    if (itemCode && !categoryFromCode) {
      errors.push(`${options.text.errors.invalidItemCode}: ${raw.itemCode}`);
    }

    const category =
      categoryFromCode ??
      (raw.itemName
        ? categoryLookup.get(normalizeExpenseIdentity(raw.itemName))
        : undefined);

    if (category && costCenter) {
      const expectedCostCenter = EXPENSE_CATEGORY_TO_COST_CENTER[category];
      if (expectedCostCenter !== costCenter) {
        errors.push(
          `${options.text.errors.costCenterMismatch}: ${options.labels.category[category]}`,
        );
      }
    }

    if (!category && !raw.itemName.trim()) {
      errors.push(options.text.errors.missingItemName);
    }

    const budget = parseExpenseAmount(
      raw.budgetAmount,
      options.text.errors.invalidBudget,
      options.text.errors.negativeAmount,
    );
    if (budget.error) errors.push(budget.error);

    const actual = parseExpenseAmount(
      raw.actualAmount,
      options.text.errors.invalidActual,
      options.text.errors.negativeAmount,
    );
    if (actual.error) errors.push(actual.error);

    rows.push({
      rowNumber,
      raw,
      target: buildTarget({
        errors,
        costCenter,
        category,
        customItemLookup,
        rawLabel: raw.itemName,
      }),
      budgetAmount: budget.value,
      actualAmount: actual.value,
      note: raw.note.trim() || undefined,
      skipped: false,
      errors,
    });
  });

  return rows;
}

function buildTarget(options: {
  errors: string[];
  costCenter?: ExpenseCostCenter;
  category?: ExpenseCategory;
  customItemLookup: Map<string, ExpenseCustomItem>;
  rawLabel: string;
}): ExpenseImportTarget | null {
  if (options.errors.length > 0 || !options.costCenter) return null;
  if (options.category) {
    return {
      type: "standard",
      category: options.category,
      costCenter: options.costCenter,
    };
  }

  const label = options.rawLabel.trim();
  const existing = options.customItemLookup.get(
    customItemLookupKey(options.costCenter, label),
  );
  return {
    type: "custom",
    itemId: existing?.id ?? null,
    label,
    costCenter: options.costCenter,
  };
}

export function summarizeExpenseImportRows(
  rows: ExpenseImportPreviewRow[],
): ExpenseImportSummary {
  const activeRows = rows.filter((row) => !row.skipped);
  const validRows = activeRows.filter((row) => row.errors.length === 0 && row.target);

  return {
    totalRows: rows.length,
    importableRows: validRows.length,
    skippedRows: rows.filter((row) => row.skipped).length,
    errorRows: activeRows.filter((row) => row.errors.length > 0).length,
    standardRows: validRows.filter((row) => row.target?.type === "standard").length,
    customCreateRows: validRows.filter(
      (row) => row.target?.type === "custom" && !row.target.itemId,
    ).length,
    customUpdateRows: validRows.filter(
      (row) => row.target?.type === "custom" && !!row.target.itemId,
    ).length,
  };
}
