import { findEmployeeContractRolloutState } from "../repositories/employeeContractRolloutRepository.js";
import { repairEmployeeContractRolloutProjection } from "../repositories/employeeContractRolloutRepository.js";
import { reconcileEmployeeContracts } from "../services/employeeContractReconciliationPolicy.js";
import { getVietnamLocalDate } from "../services/employeeEmploymentPolicy.js";
import { assertConfirmedApply } from "./employeeContractScriptGuard.js";

const main = async () => {
  const guard = assertConfirmedApply();
  const state = await findEmployeeContractRolloutState();
  const asOfDate = getVietnamLocalDate();
  const plan = reconcileEmployeeContracts(
    state.contracts,
    state.locks,
    asOfDate,
  );
  console.log(
    JSON.stringify(
      {
        mode: guard.apply ? "APPLY" : "DRY_RUN",
        project_id: guard.projectId,
        as_of_date: asOfDate,
        ...plan,
      },
      null,
      2,
    ),
  );
  if (!guard.apply) {
    if (plan.blocking_issues > 0) process.exitCode = 2;
    return;
  }
  if (plan.blocking_issues > 0) {
    throw new Error("APPLY_BLOCKED_BY_DUPLICATE_OR_OVERLAP");
  }
  let repaired = 0;
  for (const contractId of plan.repair_contract_ids) {
    const result = await repairEmployeeContractRolloutProjection({
      contract_id: contractId,
      as_of_date: asOfDate,
      actor_id: guard.initiatedBy,
    });
    if (result === "REPAIRED") repaired += 1;
  }
  console.log(JSON.stringify({ mode: "APPLY_RESULT", repaired }, null, 2));
};

main().catch((error) => {
  console.error(
    "[reconcileEmployeeContracts]",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
