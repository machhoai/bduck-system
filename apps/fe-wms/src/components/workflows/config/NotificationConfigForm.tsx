/**
 * NotificationConfigForm — Config sub-form for NOTIFICATION nodes.
 *
 * Fields:
 *   - channel (enum: IN_APP, EMAIL, PUSH)
 *   - template_key (dropdown — predefined notification templates)
 */
"use client";

import { useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import { useWorkflowCanvasStore } from "@/stores/useWorkflowCanvasStore";
import { NotificationChannel } from "@bduck/shared-types";
import {
  ConfigField,
  ConfigSelect,
} from "./ConfigFieldComponents";

interface NotificationConfigFormProps {
  nodeId: string;
  config: Record<string, unknown>;
}

/** Predefined notification templates */
const TEMPLATE_OPTIONS: { value: string; label: string }[] = [
  { value: "notification.voucher_approved", label: "Phiếu đã được duyệt" },
  { value: "notification.voucher_rejected", label: "Phiếu bị từ chối" },
  { value: "notification.receiving_completed", label: "Kiểm đếm hoàn thành" },
  { value: "notification.nonconformity_created", label: "Phát hiện chênh lệch (NC)" },
  { value: "notification.voucher_completed", label: "Phiếu nhập kho hoàn thành" },
  { value: "notification.workflow_update", label: "Cập nhật quy trình (chung)" },
];

/** Channel options with friendly labels */
const CHANNEL_OPTIONS: { value: string; label: string }[] = [
  { value: NotificationChannel.IN_APP, label: "Trong ứng dụng (In-App)" },
  { value: NotificationChannel.EMAIL, label: "Email" },
  { value: NotificationChannel.PUSH, label: "Push Notification" },
];

export function NotificationConfigForm({
  nodeId,
  config,
}: NotificationConfigFormProps) {
  const { t } = useTranslation();
  const updateNodeConfig = useWorkflowCanvasStore(
    (s) => s.updateNodeConfig,
  );

  const syncChannel = useCallback(
    (val: string) => updateNodeConfig(nodeId, { channel: val }),
    [nodeId, updateNodeConfig],
  );

  const syncTemplate = useCallback(
    (val: string) => updateNodeConfig(nodeId, { template_key: val }),
    [nodeId, updateNodeConfig],
  );

  return (
    <div className="space-y-3">
      <ConfigField label={t.workflows.config.channel}>
        <ConfigSelect
          value={(config.channel as string) || ""}
          onChange={syncChannel}
          options={CHANNEL_OPTIONS}
          placeholder="Chọn kênh thông báo..."
        />
      </ConfigField>

      <ConfigField label={t.workflows.config.templateKey}>
        <ConfigSelect
          value={(config.template_key as string) || ""}
          onChange={syncTemplate}
          options={TEMPLATE_OPTIONS}
          placeholder="Chọn mẫu thông báo..."
        />
      </ConfigField>
    </div>
  );
}
