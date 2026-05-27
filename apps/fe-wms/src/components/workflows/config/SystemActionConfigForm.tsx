/**
 * SystemActionConfigForm — Config sub-form for SYSTEM_ACTION nodes.
 *
 * - action_type: dropdown (known system actions)
 * - target_status: dropdown (ImportVoucherStatus enum) — NOT text input
 */
"use client";

import { useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import { useWorkflowCanvasStore } from "@/stores/useWorkflowCanvasStore";
import { ImportVoucherStatus } from "@bduck/shared-types";
import {
  ConfigField,
  ConfigSelect,
} from "./ConfigFieldComponents";

interface SystemActionConfigFormProps {
  nodeId: string;
  config: Record<string, unknown>;
}

const SYSTEM_ACTIONS = [
  { value: "UPDATE_INVENTORY", label: "Cập nhật tồn kho (ATP)" },
  { value: "AUTO_APPROVE", label: "Tự động duyệt" },
  { value: "CHANGE_VOUCHER_STATUS", label: "Đổi trạng thái phiếu" },
  { value: "CREATE_NONCONFORMITY", label: "Tạo biên bản sai lệch (NC)" },
];

/** Status labels for the dropdown */
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: ImportVoucherStatus.DRAFT, label: "Nháp (DRAFT)" },
  { value: ImportVoucherStatus.PENDING_APPROVAL, label: "Chờ duyệt (PENDING_APPROVAL)" },
  { value: ImportVoucherStatus.APPROVED, label: "Đã duyệt (APPROVED)" },
  { value: ImportVoucherStatus.REJECTED, label: "Từ chối (REJECTED)" },
  { value: ImportVoucherStatus.RECEIVING, label: "Đang nhận hàng (RECEIVING)" },
  { value: ImportVoucherStatus.COMPLETED, label: "Hoàn thành (COMPLETED)" },
  { value: ImportVoucherStatus.CANCELLED, label: "Đã hủy (CANCELLED)" },
];

export function SystemActionConfigForm({
  nodeId,
  config,
}: SystemActionConfigFormProps) {
  const { t } = useTranslation();
  const updateNodeConfig = useWorkflowCanvasStore(
    (s) => s.updateNodeConfig,
  );

  const syncAction = useCallback(
    (val: string) => updateNodeConfig(nodeId, { action_type: val }),
    [nodeId, updateNodeConfig],
  );

  const syncTargetStatus = useCallback(
    (val: string) =>
      updateNodeConfig(nodeId, {
        params: { target_status: val },
      }),
    [nodeId, updateNodeConfig],
  );

  const currentParams = (config.params as Record<string, unknown>) || {};

  return (
    <div className="space-y-3">
      <ConfigField label={t.workflows.config.actionType}>
        <ConfigSelect
          value={(config.action_type as string) || ""}
          onChange={syncAction}
          options={SYSTEM_ACTIONS}
          placeholder="Chọn hành động..."
        />
      </ConfigField>

      {config.action_type === "CHANGE_VOUCHER_STATUS" && (
        <ConfigField label="Trạng thái đích">
          <ConfigSelect
            value={(currentParams.target_status as string) || ""}
            onChange={syncTargetStatus}
            options={STATUS_OPTIONS}
            placeholder="Chọn trạng thái..."
          />
        </ConfigField>
      )}
    </div>
  );
}
