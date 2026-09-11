import type {
  PosVoucherCampaignSetting,
  PosVoucherSettingsView,
} from "@bduck/shared-types";

import { posProductVisibilityRepository } from "../repositories/posProductVisibilityRepository.js";
import { posVoucherSettingsRepository } from "../repositories/posVoucherSettingsRepository.js";

import type { AuditMetadata } from "./auditService.js";
import type { AuthorizationService } from "./authorization/index.js";
import type { PosVoucherCampaignSettingValue } from "./posVoucherSettingsSchemas.js";
import { loadWarehouseById } from "./warehouseService.js";

export const getPosVoucherSettings = async (
  warehouseId: string,
  authorization: AuthorizationService,
): Promise<PosVoucherSettingsView> => {
  authorization.assert("pos.settings.read", warehouseId);
  await loadWarehouseById(warehouseId);
  const [campaigns, products, settings] = await Promise.all([
    posVoucherSettingsRepository.listCampaigns(),
    posProductVisibilityRepository.listCatalog(),
    posVoucherSettingsRepository.listByWarehouse(warehouseId),
  ]);
  return { campaigns, products, settings };
};

export const savePosVoucherSetting = async (input: {
  warehouseId: string;
  campaignId: string;
  actorId: string;
  value: PosVoucherCampaignSettingValue;
  authorization: AuthorizationService;
  auditMetadata?: AuditMetadata;
}): Promise<PosVoucherCampaignSetting> => {
  input.authorization.assert("pos.settings.manage", input.warehouseId);
  await loadWarehouseById(input.warehouseId);
  const [campaigns, productSnapshot, visibilitySettings] = await Promise.all([
    posVoucherSettingsRepository.listCampaigns(),
    posProductVisibilityRepository.listCatalog(),
    posProductVisibilityRepository.findByWarehouse(input.warehouseId),
  ]);
  if (!campaigns.some((campaign) => campaign.id === input.campaignId)) {
    throw Object.assign(new Error("POS_VOUCHER_CAMPAIGN_NOT_SUPPORTED"), {
      statusCode: 404,
      messages: {
        vi: "Chiến dịch voucher không tồn tại hoặc chưa hỗ trợ trên JPOS.",
        zh: "优惠券活动不存在或暂不支持 JPOS。",
      },
    });
  }
  const product = productSnapshot.find(
    (item) => item.goods_id === input.value.product_id,
  );
  if (!product) {
    throw Object.assign(new Error("POS_VOUCHER_PRODUCT_NOT_AVAILABLE"), {
      statusCode: 409,
      messages: {
        vi: "Sản phẩm mapping không còn khả dụng trên JPOS.",
        zh: "映射商品已无法在 JPOS 使用。",
      },
    });
  }
  const hasActiveVisibilityOverride = visibilitySettings?.is_deleted !== true;
  const productIsDisabled = hasActiveVisibilityOverride && (
    visibilitySettings?.disabled_product_ids.includes(product.goods_id) ||
    visibilitySettings?.disabled_group_keys.includes(product.group_key)
  );
  if (input.value.enabled && productIsDisabled) {
    throw Object.assign(new Error("POS_VOUCHER_PRODUCT_DISABLED_AT_WAREHOUSE"), {
      statusCode: 409,
      messages: {
        vi: "Sản phẩm mapping đang bị tắt bán tại cửa hàng này.",
        zh: "映射商品当前已在此门店停售。",
      },
    });
  }
  return posVoucherSettingsRepository.save({
    warehouseId: input.warehouseId,
    campaignId: input.campaignId,
    actorId: input.actorId,
    value: input.value,
    context: input.auditMetadata,
  });
};
