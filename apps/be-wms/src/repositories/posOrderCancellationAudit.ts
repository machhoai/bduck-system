import type { RawPosOrder } from "./posOrderRepository.js";

export const buildPosOrderCancellationAudit = (input: {
  id: string;
  order: RawPosOrder;
  actorId: string;
  actorName: string;
  actionTime: string;
  oldValue: Record<string, unknown>;
  newValue: Record<string, unknown>;
  notes: string;
  context?: {
    ip_address?: string | null;
    device_id?: string | null;
    session_token?: string | null;
  };
}) => ({
  id: input.id,
  entity_type: "POS_ORDER",
  entity_id: input.order.localOrderId,
  entity_name: input.order.localOrderId,
  warehouse_id: input.order.warehouseId,
  action: "UPDATE",
  user_id: input.actorId,
  user_name: input.actorName,
  action_time: new Date(input.actionTime),
  sync_time: new Date(),
  old_value: input.oldValue,
  new_value: input.newValue,
  ip_address: input.context?.ip_address ?? null,
  device_id: input.context?.device_id ?? null,
  session_token: input.context?.session_token ?? null,
  notes: input.notes,
});
