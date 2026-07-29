import {
  AuditAction,
  formatContractDisplayDate,
  type InAppNotification,
  type LocalDate,
} from "@bduck/shared-types";
import { createHash } from "node:crypto";
import { db } from "../config/firebase.js";
import { isEmployeeContractExpiryWarningDue } from "../services/employeeContractAutomationPolicy.js";
import {
  employeeContractRef,
  mapEmployeeContractSnapshot,
} from "./employeeContractRepository.js";

const WARNING_LOCKS = "employee_contract_expiry_notification_locks";
const NOTIFICATIONS = "in_app_notifications";
const DISPATCHES = "notification_dispatches";
const AUDITS = "audit_logs";

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

type WarningWriteResult = {
  created: boolean;
  notifications: InAppNotification[];
};

export const createEmployeeContractExpiryWarning = async (
  contractId: string,
  asOfDate: LocalDate,
  recipientUserIds: string[],
  actorId: string,
): Promise<WarningWriteResult> =>
  db.runTransaction(async (transaction) => {
    const contractRef = employeeContractRef(contractId);
    const contractSnapshot = await transaction.get(contractRef);
    if (!contractSnapshot.exists) return { created: false, notifications: [] };
    const contract = mapEmployeeContractSnapshot(contractSnapshot);
    if (
      !isEmployeeContractExpiryWarningDue(contract, asOfDate) ||
      !contract.end_date ||
      recipientUserIds.length === 0
    ) {
      return { created: false, notifications: [] };
    }
    const lockId = hash(`expiry-warning:${contract.id}:${contract.end_date}`);
    const lockRef = db.collection(WARNING_LOCKS).doc(lockId);
    const lockSnapshot = await transaction.get(lockRef);
    if (lockSnapshot.exists) return { created: false, notifications: [] };

    const now = new Date();
    const recipients = Array.from(new Set(recipientUserIds)).slice(0, 450);
    const title = "Hợp đồng sắp hết hạn / 劳动合同即将到期";
    const displayEndDate = formatContractDisplayDate(contract.end_date);
    const body = `Hợp đồng ${contract.contract_number} sẽ hết hạn ngày ${displayEndDate}. / 合同 ${contract.contract_number} 将于 ${displayEndDate} 到期。`;
    const notifications = recipients.map((userId): InAppNotification => ({
      id: hash(`${lockId}:${userId}`),
      target_user_id: userId,
      target_role_id: null,
      template_key: "employee_contract.expiry_30_days",
      template_params: {
        contract_id: contract.id,
        employee_profile_id: contract.employee_profile_id,
        contract_number: contract.contract_number,
        end_date: contract.end_date,
        warning_days: 30,
      },
      channel: "IN_APP",
      title,
      body,
      action_url: "/employees",
      priority: "HIGH",
      source_instance_id: lockId,
      source_entity_id: contract.id,
      source_entity_type: "employee_contracts",
      created_by: actorId,
      is_read: false,
      read_at: null,
      is_deleted: false,
      created_at: now,
      updated_at: now,
    }));
    const dispatchId = `${lockId}:dispatch`;
    notifications.forEach((notification) =>
      transaction.create(
        db.collection(NOTIFICATIONS).doc(notification.id),
        notification,
      ),
    );
    transaction.create(db.collection(DISPATCHES).doc(dispatchId), {
      id: dispatchId,
      channel: "IN_APP",
      status: "SENT",
      title,
      body_text: body,
      body_html: null,
      recipient_user_ids: recipients,
      recipient_role_ids: [],
      recipient_emails: [],
      cc_emails: [],
      bcc_emails: [],
      brevo_message_id: null,
      error_message: null,
      sent_count: recipients.length,
      failed_count: 0,
      created_by: actorId,
      action_time: now,
      sync_time: now,
      is_deleted: false,
      created_at: now,
      updated_at: now,
    });
    transaction.create(lockRef, {
      id: lockId,
      contract_id: contract.id,
      contract_end_date: contract.end_date,
      warning_days: 30,
      dispatch_id: dispatchId,
      recipient_user_ids: recipients,
      created_at: now,
      is_deleted: false,
    });
    transaction.create(db.collection(AUDITS).doc(dispatchId), {
      id: dispatchId,
      entity_type: "notification_dispatches",
      entity_id: dispatchId,
      warehouse_id: contract.workplace_warehouse_id,
      action: AuditAction.CREATE,
      user_id: actorId,
      user_name: null,
      entity_name: contract.contract_number,
      action_time: now,
      sync_time: now,
      old_value: null,
      new_value: {
        contract_id: contract.id,
        end_date: contract.end_date,
        recipient_user_ids: recipients,
      },
      notes: "Employee contract expiry warning (30 days)",
    });
    return { created: true, notifications };
  });
