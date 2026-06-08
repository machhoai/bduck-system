import {
  ExpenseCategory,
  ExpenseCostCenter,
} from "@bduck/shared-types";

export type ExpenseImportColumnKey =
  | "costCenter"
  | "itemCode"
  | "itemName"
  | "budgetAmount"
  | "actualAmount"
  | "note";

export const EXPENSE_IMPORT_COLUMN_KEYS: ExpenseImportColumnKey[] = [
  "costCenter",
  "itemCode",
  "itemName",
  "budgetAmount",
  "actualAmount",
  "note",
];

export interface ExpenseImportLabels {
  costCenter: Record<ExpenseCostCenter, string>;
  category: Record<ExpenseCategory, string>;
}

export interface ExpenseImportText {
  columns: Record<ExpenseImportColumnKey, string | { label: string }>;
  errors: {
    noSheet: string;
    noRecognizedColumns: string;
    invalidCostCenter: string;
    invalidItemCode: string;
    costCenterMismatch: string;
    missingItemName: string;
    invalidBudget: string;
    invalidActual: string;
    negativeAmount: string;
  };
}

export type ExpenseImportTarget =
  | {
      type: "standard";
      category: ExpenseCategory;
      costCenter: ExpenseCostCenter;
    }
  | {
      type: "custom";
      itemId: string | null;
      label: string;
      costCenter: ExpenseCostCenter;
    };

export interface ExpenseImportPreviewRow {
  rowNumber: number;
  raw: Record<ExpenseImportColumnKey, string>;
  target: ExpenseImportTarget | null;
  budgetAmount?: number;
  actualAmount?: number;
  note?: string;
  skipped: boolean;
  errors: string[];
}

export interface ExpenseImportSummary {
  totalRows: number;
  importableRows: number;
  skippedRows: number;
  errorRows: number;
  standardRows: number;
  customCreateRows: number;
  customUpdateRows: number;
}

export type ExpenseTemplateColumn = {
  label: string;
  note: string;
  width: number;
  required?: boolean;
};

export interface ExpenseTemplateText {
  sheets: {
    data: string;
    guide: string;
    refs: string;
  };
  fileName: string;
  columns: Record<ExpenseImportColumnKey, ExpenseTemplateColumn>;
  prompts: {
    title: string;
    invalidTitle: string;
    invalidList: string;
    invalidAmount: string;
    costCenter: string;
    itemCode: string;
    itemName: string;
    amount: string;
  };
  refs: {
    group: string;
    value: string;
    meaning: string;
    costCenter: string;
    fixedItem: string;
  };
  guideHeaders: {
    section: string;
    guide: string;
  };
  guides: Array<{ section: string; guide: string }>;
  sampleCustomName: string;
}
