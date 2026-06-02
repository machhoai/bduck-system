import { z } from 'zod';
import { ExpenseStatus, ExpenseCategory } from './enums.js';

export const ExpenseItemSchema = z.object({
  actual_amount: z.number().min(0, 'Số tiền thực tế không được âm'),
  budget_amount: z.number().nullable(),
  suggested_amount: z.number().nullable(),
  attachments: z.array(z.string()).default([]),
  note: z.string().nullable(),
});

export type ExpenseItem = z.infer<typeof ExpenseItemSchema>;

export const ExpenseDocumentSchema = z.object({
  id: z.string(),
  warehouse_id: z.string(),
  period: z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/, 'Kỳ kế toán không hợp lệ (định dạng YYYY-MM)'),
  status: z.nativeEnum(ExpenseStatus),
  items: z.record(z.nativeEnum(ExpenseCategory), ExpenseItemSchema),
  created_by: z.string(),
  updated_by: z.string(),
  is_deleted: z.boolean().default(false),
  created_at: z.date(),
  updated_at: z.date(),
});

export type ExpenseDocument = z.infer<typeof ExpenseDocumentSchema>;
