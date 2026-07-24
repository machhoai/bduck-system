import { resolveLeaveFeatureEnabled } from "@bduck/shared-types";

export const isLeaveFeatureEnabled = resolveLeaveFeatureEnabled(
  process.env.NEXT_PUBLIC_LEAVE_FEATURE_ENABLED,
  process.env.NODE_ENV,
);
