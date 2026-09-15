import type { ActiveStatus, WarehouseType } from "@bduck/shared-types";

export interface WarehouseFormValues {
  organization_id: string;
  name: string;
  code: string;
  type: WarehouseType;
  status: ActiveStatus;
  address: string;
  manager_id: string;
  warehouse_description: string;
  warehouse_image_url: string;
  longitude: string;
  latitude: string;
}
