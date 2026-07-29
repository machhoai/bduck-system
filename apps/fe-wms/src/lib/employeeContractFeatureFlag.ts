import { resolveEmployeeContractsFeatureEnabled } from "@bduck/shared-types";

export const isEmployeeContractsFeatureEnabled =
  resolveEmployeeContractsFeatureEnabled(
    process.env.NEXT_PUBLIC_EMPLOYEE_CONTRACTS_FEATURE_ENABLED,
    process.env.NODE_ENV,
  );
