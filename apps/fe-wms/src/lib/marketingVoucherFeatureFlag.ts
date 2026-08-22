import { resolveMarketingVouchersFeatureEnabled } from "@bduck/shared-types";

export const isMarketingVoucherFeatureEnabled =
  resolveMarketingVouchersFeatureEnabled(
    process.env.NEXT_PUBLIC_MARKETING_VOUCHERS_FEATURE_ENABLED,
  );
