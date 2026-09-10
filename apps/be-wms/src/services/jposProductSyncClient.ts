import { createHmac } from "crypto";

import type { PosProductCatalogSyncResult } from "@bduck/shared-types";

interface JposSyncEnvelope {
  success: boolean;
  data: PosProductCatalogSyncResult | null;
  messages?: { vi?: string; zh?: string };
}

export class JposProductSyncError extends Error {
  readonly statusCode: number;
  readonly messages: { vi: string; zh: string };

  constructor(statusCode: number, messages: { vi: string; zh: string }) {
    super("JPOS_PRODUCT_SYNC_FAILED");
    this.statusCode = statusCode;
    this.messages = messages;
  }
}

export const signJposProductSyncRequest = (
  secret: string,
  timestamp: string,
  requestId: string,
  body: string,
): string =>
  createHmac("sha256", secret)
    .update(`${timestamp}.${requestId}.${body}`)
    .digest("hex");

const requireEnvironmentValue = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

const requestGoogleIdentityToken = async (
  audience: string,
): Promise<string> => {
  const metadataUrl = new URL(
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity",
  );
  metadataUrl.searchParams.set("audience", audience);
  metadataUrl.searchParams.set("format", "full");
  const response = await fetch(metadataUrl, {
    headers: { "Metadata-Flavor": "Google" },
  });
  const token = response.ok ? (await response.text()).trim() : "";
  if (!token) throw new Error("JPOS identity token is unavailable.");
  return token;
};

export async function requestJposProductSync(input: {
  actorId: string;
  warehouseId: string;
  requestId: string;
  actionTime: string;
}): Promise<PosProductCatalogSyncResult> {
  const url = requireEnvironmentValue("JPOS_PRODUCT_SYNC_URL");
  const secret = requireEnvironmentValue("JPOS_PRODUCT_SYNC_SECRET");
  const audience = new URL(url).origin;
  const identityToken = await requestGoogleIdentityToken(audience);
  const timestamp = String(Date.now());
  const body = JSON.stringify({
    actor_id: input.actorId,
    warehouse_id: input.warehouseId,
    request_id: input.requestId,
    action_time: input.actionTime,
  });
  const signature = signJposProductSyncRequest(
    secret,
    timestamp,
    input.requestId,
    body,
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 290_000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${identityToken}`,
        "Content-Type": "application/json",
        "X-Jpulse-Timestamp": timestamp,
        "X-Jpulse-Request-Id": input.requestId,
        "X-Jpulse-Signature": signature,
      },
      body,
      signal: controller.signal,
    });
    const envelope = (await response
      .json()
      .catch(() => null)) as JposSyncEnvelope | null;
    if (!response.ok || !envelope?.success || !envelope.data) {
      throw new JposProductSyncError(response.status === 409 ? 409 : 502, {
        vi: envelope?.messages?.vi || "Không thể đồng bộ sản phẩm từ JPOS.",
        zh: envelope?.messages?.zh || "无法从 JPOS 同步商品。",
      });
    }
    return envelope.data;
  } catch (error: unknown) {
    if (error instanceof JposProductSyncError) throw error;
    throw new JposProductSyncError(502, {
      vi: "Không thể kết nối dịch vụ đồng bộ sản phẩm JPOS.",
      zh: "无法连接 JPOS 商品同步服务。",
    });
  } finally {
    clearTimeout(timeout);
  }
}
