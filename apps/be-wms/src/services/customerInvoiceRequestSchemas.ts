import { z } from "zod";

export const invoiceRequestTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/);

export const taxCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{10}(?:-\d{3})?$/);

export const customerInvoiceRequestParamsSchema = z.object({
  token: invoiceRequestTokenSchema,
});

export const customerInvoiceTaxParamsSchema = z.object({
  token: invoiceRequestTokenSchema,
  taxCode: taxCodeSchema,
});

export const customerInvoiceRequestSubmissionSchema = z.object({
  idempotency_key: z.string().uuid(),
  action_time: z.string().datetime({ offset: true }),
  buyer: z.object({
    full_name: z.string().trim().max(255),
    legal_name: z.string().trim().min(1).max(255),
    tax_code: taxCodeSchema,
    address: z.string().trim().min(1).max(500),
    phone_number: z
      .string()
      .trim()
      .max(50)
      .regex(/^[0-9+().\- ]*$/),
    email: z.union([z.literal(""), z.string().trim().email().max(255)]),
  }),
});

export type CustomerInvoiceRequestSubmission = z.infer<
  typeof customerInvoiceRequestSubmissionSchema
>;
