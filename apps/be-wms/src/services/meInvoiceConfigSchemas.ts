import { MeInvoiceEnvironment, MeInvoiceSignType } from "@bduck/shared-types";
import { z } from "zod";

const identifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[^$\u0000]+$/, "Identifier contains unsupported characters.");

const taxCodeSchema = z
  .string()
  .trim()
  .regex(
    /^\d{10}(?:-\d{3})?$/,
    "Vietnam tax code must have 10 digits or 10-3 digits.",
  );

const DEFAULT_RETAIL_BUYER_NAME = "Khách lẻ (Không lấy hóa đơn)";

export const meInvoiceAccountInputSchema = z.object({
  legal_entity_id: identifierSchema,
  display_name: z.string().trim().min(1).max(200),
  tax_code: taxCodeSchema,
  environment: z.nativeEnum(MeInvoiceEnvironment),
  client_id: z.string().trim().min(1).max(500).optional(),
  client_secret: z.string().trim().min(1).max(1000).optional(),
  username: z.string().trim().min(1).max(500).optional(),
  password: z.string().min(1).max(1000).optional(),
  enabled: z.boolean().default(false),
  action_time: z.coerce.date().optional(),
});

const decimalDigitsSchema = z.number().int().min(0).max(8);
const vatRateNameSchema = z.enum(["0%", "5%", "8%", "10%", "KCT", "KKKNT"]);

const skuMappingSchema = z.object({
  item_code: z.string().trim().min(1).max(100).optional(),
  item_name: z.string().trim().min(1).max(500).optional(),
  unit_name: z.string().trim().min(1).max(100).optional(),
  vat_rate_name: vatRateNameSchema.optional(),
});

export const meInvoiceOptionUserDefinedSchema = z.object({
  main_currency: z.string().trim().min(3).max(3).default("VND"),
  amount_decimal_digits: decimalDigitsSchema.default(0),
  amount_oc_decimal_digits: decimalDigitsSchema.default(0),
  unit_price_oc_decimal_digits: decimalDigitsSchema.default(0),
  unit_price_decimal_digits: decimalDigitsSchema.default(0),
  quantity_decimal_digits: decimalDigitsSchema.default(2),
  coefficient_decimal_digits: decimalDigitsSchema.default(0),
  exchange_rate_decimal_digits: decimalDigitsSchema.default(2),
});

export const meInvoiceStoreConfigInputSchema = z
  .object({
    meinvoice_account_id: identifierSchema,
    inv_series: z
      .string()
      .trim()
      .min(6)
      .max(20)
      .regex(/^[A-Z0-9]+$/),
    invoice_with_code: z.boolean(),
    sign_type: z.union([
      z.literal(MeInvoiceSignType.HSM),
      z.literal(MeInvoiceSignType.CALCULATING_MACHINE),
    ]),
    seller_shop_code: z.string().trim().min(1).max(100),
    seller_shop_name: z.string().trim().min(1).max(255),
    price_includes_vat: z.boolean().nullable().default(true),
    tax_rate_source: z.enum(["SOURCE", "SKU", "CATEGORY", "MANUAL_REVIEW"]),
    default_vat_rate_name: vatRateNameSchema.nullable().default(null),
    sku_mapping: z.record(z.string(), skuMappingSchema).default({}),
    category_vat_mapping: z.record(z.string(), vatRateNameSchema).default({}),
    payment_method_mapping: z
      .record(z.string(), z.string().trim().min(1).max(100))
      .default({}),
    go_live_at: z.coerce.date().nullable().default(null),
    default_buyer_name: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .default(DEFAULT_RETAIL_BUYER_NAME),
    default_buyer_address: z.string().trim().max(500).default(""),
    default_buyer_tax_code: z
      .union([z.literal(""), z.null()])
      .transform(() => null)
      .default(null),
    option_user_defined: meInvoiceOptionUserDefinedSchema.default({
      main_currency: "VND",
      amount_decimal_digits: 0,
      amount_oc_decimal_digits: 0,
      unit_price_oc_decimal_digits: 0,
      unit_price_decimal_digits: 0,
      quantity_decimal_digits: 2,
      coefficient_decimal_digits: 0,
      exchange_rate_decimal_digits: 2,
    }),
    enabled: z.boolean().default(false),
    action_time: z.coerce.date().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.enabled && value.price_includes_vat === null) {
      ctx.addIssue({
        code: "custom",
        path: ["price_includes_vat"],
        message:
          "price_includes_vat must be confirmed before enabling the store config.",
      });
    }
  });

export type MeInvoiceAccountInput = z.infer<typeof meInvoiceAccountInputSchema>;
export type MeInvoiceStoreConfigInput = z.infer<
  typeof meInvoiceStoreConfigInputSchema
>;
