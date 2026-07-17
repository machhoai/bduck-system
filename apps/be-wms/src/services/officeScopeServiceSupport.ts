import { WarehouseType, type OfficeScopeEdge } from "@bduck/shared-types";
import { loadWarehouseById } from "./warehouseService.js";

export const isManageableOfficeFacility = (type: WarehouseType) =>
  type === WarehouseType.MAIN || type === WarehouseType.STORE;

export const assertOfficeFacility = async (officeId: string) => {
  const office = await loadWarehouseById(officeId);
  if (office.type !== WarehouseType.OFFICE) {
    throw {
      statusCode: 400,
      messages: {
        vi: "Chỉ cơ sở loại Văn phòng mới có phạm vi quản lý.",
        zh: "只有办公室类型的场所才能配置管理范围。",
      },
    };
  }
  return office;
};

export const getActiveOfficeScopeTargetIds = (edges: OfficeScopeEdge[]) =>
  edges.map((edge) => edge.target_facility_id).sort();

export const resolveEffectiveOfficeScopeIds = (
  mode: "ALL" | "SELECTED" | null,
  selectedIds: readonly string[],
  manageableIds: Set<string>,
) =>
  mode === "ALL"
    ? Array.from(manageableIds).sort()
    : selectedIds.filter((id) => manageableIds.has(id)).sort();
