import type { ApprovalRecord } from "@bduck/shared-types";

import type { AuthorizationService } from "./authorization/index.js";

type CreatorCancelAuthorization = Pick<AuthorizationService, "assert">;

export function assertCreatorCancelFacilityAccess(
  record: ApprovalRecord,
  authorization: CreatorCancelAuthorization,
): void {
  authorization.assert("vouchers.write", record.warehouse_id);
}

export function assertApprovalCreator(
  record: ApprovalRecord,
  actorId: string,
): void {
  if (record.creator_id === actorId) return;

  throw {
    statusCode: 403,
    messages: {
      vi: "Chỉ người tạo lệnh mới có quyền hủy.",
      zh: "只有创建人才能撤销单据。",
    },
  };
}
