import type { NextFunction, Request, Response } from "express";
import { getRequestAuthorization } from "./requestAccessContext.js";

export type WarehouseIdExtractor = (req: Request) => string | null | undefined;
export type FacilityIdExtractor = WarehouseIdExtractor;

const sendPermissionDenied = (res: Response) =>
  res.status(403).json({
    success: false,
    data: null,
    messages: {
      vi: "Bạn không có quyền thực hiện hành động này trong phạm vi cơ sở yêu cầu.",
      zh: "您无权在所请求的场所范围内执行此操作。",
    },
  });

const isValidIdentifier = (value: unknown): value is string =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value === value.trim();

const normalizeActions = (action: string | string[]): string[] => {
  const values: unknown[] = Array.isArray(action) ? action : [action];
  return Array.from(new Set(values.filter(isValidIdentifier)));
};

export const requirePermission = (
  action: string,
  getWarehouseId?: WarehouseIdExtractor,
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!isValidIdentifier(action)) return sendPermissionDenied(res);
    const authorization = getRequestAuthorization(req);
    if (!authorization) return sendPermissionDenied(res);

    // A permission without a concrete resource scope is reserved for the
    // validated system administrator. Domain routes should prefer an extractor.
    if (!getWarehouseId) {
      return authorization.context.isSystemAdmin
        ? next()
        : sendPermissionDenied(res);
    }

    let facilityId: string | null | undefined;
    try {
      facilityId = getWarehouseId(req);
    } catch {
      return sendPermissionDenied(res);
    }

    if (
      !isValidIdentifier(facilityId) ||
      !authorization.can(action, facilityId)
    ) {
      return sendPermissionDenied(res);
    }
    return next();
  };
};

/**
 * Coarse route admission only. Controllers/services must still authorize the
 * concrete resource before reading or mutating it.
 */
export const requireAnyScopedPermission = (action: string | string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const actions = normalizeActions(action);
    if (actions.length === 0) return sendPermissionDenied(res);

    const authorization = getRequestAuthorization(req);
    if (!authorization) return sendPermissionDenied(res);
    if (authorization.context.isSystemAdmin) return next();

    const hasPermission = actions.some(
      (item) => authorization.facilityIdsFor(item).length > 0,
    );
    return hasPermission ? next() : sendPermissionDenied(res);
  };
};
