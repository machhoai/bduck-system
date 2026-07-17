import { z } from "zod";
import type { AuthorizationService } from "./authorization/index.js";

const onlineSalesReportQuerySchema = z.object({
  warehouseId: z.string().uuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export interface OnlineSalesReportRequest {
  warehouseId: string;
  from: string;
  to: string;
}

export const authorizeOnlineSalesReportRequest = (
  input: unknown,
  authorization: AuthorizationService,
): OnlineSalesReportRequest => {
  const query = onlineSalesReportQuerySchema.parse(input);
  authorization.assert("revenue.read", query.warehouseId);
  return query;
};
