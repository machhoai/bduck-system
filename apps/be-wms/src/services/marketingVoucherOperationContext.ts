import type { MarketingVoucherOperationContext } from "../repositories/marketingVoucherRepository.js";

export interface MarketingVoucherRequestMetadata {
  ip_address?: string | null;
  device_id?: string | null;
  session_token?: string | null;
}

export const marketingVoucherOperationContext = (input: {
  actorId: string;
  actionTime: Date;
  idempotencyKey: string;
  metadata: MarketingVoucherRequestMetadata;
}): MarketingVoucherOperationContext => ({
  actor_id: input.actorId,
  action_time: input.actionTime,
  idempotency_key: input.idempotencyKey,
  ip_address: input.metadata.ip_address,
  device_id: input.metadata.device_id,
  session_token: input.metadata.session_token,
});
