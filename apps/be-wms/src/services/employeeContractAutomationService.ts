import {
  EMPLOYEE_CONTRACT_EXPIRY_WARNING_DAYS,
  addContractLocalDays,
  type EmployeeContractAutomationResult,
  type EmployeeContractExpiryView,
} from "@bduck/shared-types";
import {
  claimEmployeeContractAutomationRun,
  completeEmployeeContractAutomationRun,
  failEmployeeContractAutomationRun,
  synchronizeEmployeeContractStatus,
} from "../repositories/employeeContractAutomationRepository.js";
import { createEmployeeContractExpiryWarning } from "../repositories/employeeContractExpiryNotificationRepository.js";
import {
  findEmployeeContractsForAutomation,
  findExpiringEmployeeContracts,
} from "../repositories/employeeContractQueryRepository.js";
import { notificationRepository } from "../repositories/notificationRepository.js";
import { sendPushForInAppNotifications } from "./pushNotificationService.js";
import type { AuthorizationService } from "./authorization/index.js";
import {
  isEmployeeContractExpiringSoon,
  isEmployeeContractExpiryWarningDue,
} from "./employeeContractAutomationPolicy.js";
import { getVietnamLocalDate } from "./employeeEmploymentPolicy.js";

export const EMPLOYEE_CONTRACT_AUTOMATION_ACTOR =
  "system:cloud-scheduler:employee-contracts";

const emptyResult = (asOfDate: string): EmployeeContractAutomationResult => ({
  as_of_date: asOfDate,
  status_checked: 0,
  status_updated: 0,
  status_skipped: 0,
  warning_candidates: 0,
  warnings_created: 0,
  warning_recipients: 0,
  warning_skipped: 0,
  replayed: true,
  in_progress: true,
});

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const runEmployeeContractDailyAutomation = async (
  now = new Date(),
): Promise<EmployeeContractAutomationResult> => {
  const asOfDate = getVietnamLocalDate(now);
  const claim = await claimEmployeeContractAutomationRun(asOfDate);
  if (!claim.claimed) {
    return claim.result
      ? { ...claim.result, replayed: true, in_progress: false }
      : emptyResult(asOfDate);
  }

  try {
    const contracts = await findEmployeeContractsForAutomation();
    let statusUpdated = 0;
    let statusSkipped = 0;
    for (const contract of contracts) {
      const result = await synchronizeEmployeeContractStatus(
        contract.id,
        asOfDate,
        EMPLOYEE_CONTRACT_AUTOMATION_ACTOR,
      );
      if (result === "UPDATED") statusUpdated += 1;
      else statusSkipped += 1;
    }

    const warningCandidates = contracts.filter((contract) =>
      isEmployeeContractExpiryWarningDue(contract, asOfDate),
    );
    const recipientCache = new Map<string, Promise<string[]>>();
    let warningsCreated = 0;
    let warningRecipients = 0;
    let warningSkipped = 0;
    for (const contract of warningCandidates) {
      let recipients = recipientCache.get(contract.workplace_warehouse_id);
      if (!recipients) {
        recipients = notificationRepository.findActiveUserIdsByPermission(
          "employees.contracts.read",
          contract.workplace_warehouse_id,
        );
        recipientCache.set(contract.workplace_warehouse_id, recipients);
      }
      const write = await createEmployeeContractExpiryWarning(
        contract.id,
        asOfDate,
        await recipients,
        EMPLOYEE_CONTRACT_AUTOMATION_ACTOR,
      );
      if (!write.created) {
        warningSkipped += 1;
        continue;
      }
      warningsCreated += 1;
      warningRecipients += write.notifications.length;
      void sendPushForInAppNotifications(write.notifications).catch((error) => {
        console.error(
          "[employeeContractAutomationService] push delivery failed",
          contract.id,
          error,
        );
      });
    }

    const result: EmployeeContractAutomationResult = {
      as_of_date: asOfDate,
      status_checked: contracts.length,
      status_updated: statusUpdated,
      status_skipped: statusSkipped,
      warning_candidates: warningCandidates.length,
      warnings_created: warningsCreated,
      warning_recipients: warningRecipients,
      warning_skipped: warningSkipped,
      replayed: false,
      in_progress: false,
    };
    await completeEmployeeContractAutomationRun(claim.runId, result);
    return result;
  } catch (error) {
    await failEmployeeContractAutomationRun(
      claim.runId,
      getErrorMessage(error),
    );
    throw error;
  }
};

export const listExpiringEmployeeContracts = async (
  authorization: AuthorizationService,
  limit = 100,
  now = new Date(),
): Promise<EmployeeContractExpiryView[]> => {
  const asOfDate = getVietnamLocalDate(now);
  const deadline = addContractLocalDays(
    asOfDate,
    EMPLOYEE_CONTRACT_EXPIRY_WARNING_DAYS,
  );
  if (!deadline) return [];
  const facilityIds = authorization.context.isSystemAdmin
    ? null
    : authorization.facilityIdsFor("employees.contracts.read");
  const contracts = await findExpiringEmployeeContracts(
    asOfDate,
    deadline,
    facilityIds,
    Math.min(Math.max(limit * 3, limit), 500),
  );
  return contracts
    .filter((contract) => isEmployeeContractExpiringSoon(contract, asOfDate))
    .slice(0, limit);
};
