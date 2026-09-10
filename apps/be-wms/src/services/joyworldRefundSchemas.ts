import { z } from "zod";

const joyworldDateTimeSchema = z.string().trim().min(1).max(64);
const joyworldOrderNumberSchema = z.string().trim().min(1).max(64);

const joyworldEnvelopeSchema = <T extends z.ZodType>(dataSchema: T) =>
  z
    .object({
      success: z.boolean(),
      msg: z.string(),
      code: z.number().int(),
      data: dataSchema,
      desc: z.string(),
    })
    .passthrough();

export const joyworldRefundDetailsQuerySchema = z
  .object({
    orderId: z.string().uuid(),
  })
  .strict();

export const joyworldRefundCheckRequestSchema =
  joyworldRefundDetailsQuerySchema;

export const joyworldRefundCheckResponseSchema = joyworldEnvelopeSchema(
  z.unknown().nullable(),
);

export const joyworldRefundItemSchema = z
  .object({
    goodsId: z.string().uuid(),
    goodsName: z.string().trim().min(1).max(500),
    category: z.number().int(),
    goodsCategoryName: z.string().trim().max(255),
    price: z.number().nonnegative(),
    qty: z.number().int().nonnegative(),
    surplusQty: z.number().int().nonnegative(),
    returnQty: z.number().int().nonnegative(),
    businessType: z.number().int(),
  })
  .passthrough();

export const joyworldRefundPaymentSchema = z
  .object({
    payOrderNumber: joyworldOrderNumberSchema,
    payMethodId: z.string().uuid(),
    payMethodCode: z.string().trim().min(1).max(255),
    payMethodName: z.string().trim().min(1).max(255),
    money: z.number().nonnegative(),
    payStatus: z.number().int(),
    payStatusName: z.string().trim().min(1).max(255),
    payTime: joyworldDateTimeSchema,
    outTradeNO: z.string().max(255),
    thirdPartyTerminalId: z.string().max(255).nullable(),
    paymentMode: z.number().int(),
  })
  .passthrough();

export const joyworldRefundDetailsDataSchema = z
  .object({
    orderId: z.string().uuid(),
    orderNumber: joyworldOrderNumberSchema,
    buyTime: joyworldDateTimeSchema,
    totalNumber: z.number().int().nonnegative(),
    totalMoney: z.number().nonnegative(),
    payMethodNames: z.string().trim().max(1_000),
    refundMode: z.string().trim().max(2_000),
    items: z.array(joyworldRefundItemSchema),
    payModeInfo: z.array(joyworldRefundPaymentSchema),
    invoiceNumber: z.string().max(255),
    invoiceSystemType: z.number().int(),
    isInterFactuSpainInvoice: z.boolean(),
  })
  .passthrough();

export const joyworldRefundDetailsResponseSchema = joyworldEnvelopeSchema(
  joyworldRefundDetailsDataSchema,
);

export const joyworldRefundPrintTaskSchema = z
  .object({
    category: z.number().int(),
    printReceiptCategory: z.number().int(),
    content: z.string(),
    remark: z.string(),
    printData: z.string(),
    printDataByPay: z
      .object({
        printByPayCategory: z.number().int(),
        printJsonData: z.string(),
      })
      .passthrough(),
  })
  .passthrough();

export const joyworldRefundSubmitResponseSchema = joyworldEnvelopeSchema(
  z
    .object({
      orderNumber: joyworldOrderNumberSchema,
      memberStoreDesc: z.string(),
      tasks: z.array(joyworldRefundPrintTaskSchema),
    })
    .passthrough(),
);

export const joyworldRefundSubmitItemSchema = z
  .object({
    goodsId: z.string().uuid(),
    cancelQty: z.number().int().positive(),
    businessType: z.number().int(),
  })
  .strict();

export const joyworldRefundSubmitRequestSchema = z
  .object({
    orderId: z.string().uuid(),
    totalMoney: z.number().positive(),
    originalTotalMoney: z.number().positive(),
    remark: z.string().trim().min(1).max(500),
    isForcedRefund: z.boolean(),
    items: z.array(joyworldRefundSubmitItemSchema).min(1),
  })
  .strict();

export const joyworldRefundSubmitHeadersSchema = z
  .object({
    authorization: z.string().regex(/^Bearer\s+\S+$/),
    "content-type": z.literal("application/json"),
    "jj-language": z.enum(["cn", "vi"]),
    "jj-bizcode": z
      .string()
      .trim()
      .length(32)
      .regex(/^[A-Za-z0-9]+$/),
  })
  .strict();

export type JoyworldRefundDetailsQuery = z.infer<
  typeof joyworldRefundDetailsQuerySchema
>;
export type JoyworldRefundDetailsResponse = z.infer<
  typeof joyworldRefundDetailsResponseSchema
>;
export type JoyworldRefundSubmitResponse = z.infer<
  typeof joyworldRefundSubmitResponseSchema
>;
export type JoyworldRefundSubmitRequest = z.infer<
  typeof joyworldRefundSubmitRequestSchema
>;
export type JoyworldRefundSubmitHeaders = z.infer<
  typeof joyworldRefundSubmitHeadersSchema
>;
