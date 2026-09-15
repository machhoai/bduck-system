import type {
  PartnerCategoryMappingDto,
  PartnerGiftTypeOption,
  PartnerInventoryCapability,
  PartnerInventoryComparisonSnapshot,
  PartnerInventorySyncJobDto,
  PartnerWarehouseMappingDto,
  PartnerWarehouseOption,
} from "@bduck/shared-types";

import { createDetailedApiError } from "@/utils/apiError";
import { authenticatedFetch } from "@/utils/authenticatedFetch";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";
const ROOT = `${API_BASE_URL}/api/partner-inventory`;

interface MetadataResponse {
  capability: PartnerInventoryCapability;
  warehouses: PartnerWarehouseOption[];
  gift_types: PartnerGiftTypeOption[];
}

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const response = await authenticatedFetch(`${ROOT}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw createDetailedApiError(
      response,
      body,
      "JoyWorld inventory request failed.",
    );
  }
  return body.data as T;
};

export const fetchPartnerInventoryMetadata = () =>
  request<MetadataResponse>("/metadata");

export const fetchPartnerWarehouseMapping = (warehouseId: string) =>
  request<PartnerWarehouseMappingDto | null>(
    `/warehouses/${warehouseId}/mapping`,
  );

export const savePartnerWarehouseMapping = (
  warehouseId: string,
  partnerStockId: string,
) =>
  request<PartnerWarehouseMappingDto>(`/warehouses/${warehouseId}/mapping`, {
    method: "PUT",
    body: JSON.stringify({ partner_stock_id: partnerStockId }),
  });

export const fetchPartnerCategoryMapping = (categoryId: string) =>
  request<PartnerCategoryMappingDto | null>(
    `/categories/${categoryId}/mapping`,
  );

export const savePartnerCategoryMapping = (
  categoryId: string,
  partnerTypeId: string,
) =>
  request<PartnerCategoryMappingDto>(`/categories/${categoryId}/mapping`, {
    method: "PUT",
    body: JSON.stringify({ partner_type_id: partnerTypeId }),
  });

export const createPartnerInventoryComparison = (warehouseId: string) =>
  request<PartnerInventoryComparisonSnapshot>(
    `/warehouses/${warehouseId}/comparisons`,
    {
      method: "POST",
      body: JSON.stringify({ action_time: new Date().toISOString() }),
    },
  );

export const createPartnerInventorySyncJob = (
  warehouseId: string,
  input: {
    snapshotId: string;
    productIds: string[];
    requestId: string;
  },
) =>
  request<PartnerInventorySyncJobDto>(
    `/warehouses/${warehouseId}/sync-jobs`,
    {
      method: "POST",
      body: JSON.stringify({
        snapshot_id: input.snapshotId,
        product_ids: input.productIds,
        request_id: input.requestId,
        action_time: new Date().toISOString(),
      }),
    },
  );

export const reconcilePartnerInventorySyncJob = (
  warehouseId: string,
  requestId: string,
) =>
  request<PartnerInventorySyncJobDto>(
    `/warehouses/${warehouseId}/sync-jobs/${requestId}/reconcile`,
    { method: "POST" },
  );
