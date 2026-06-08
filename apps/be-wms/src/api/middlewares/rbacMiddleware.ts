import { Request, Response, NextFunction } from "express";

type WarehouseIdExtractor = (req: Request) => string | null | undefined;

const sendPermissionDenied = (res: Response) =>
  res.status(403).json({
    success: false,
    data: null,
    messages: {
      vi: "Bạn không có quyền thực hiện hành động này.",
      zh: "您没有执行此操作的权限。",
    },
  });

export const requirePermission = (
  action: string,
  getWarehouseId?: WarehouseIdExtractor,
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !user.permissions) {
      return res.status(403).json({
        success: false,
        data: null,
        messages: {
          vi: "Không có quyền truy cập.",
          zh: "没有访问权限。",
        },
      });
    }

    const permissions = user.permissions as Record<
      string,
      Record<string, unknown>
    >;
    const globalPerms = permissions["global"] || {};

    // 1. Check for global admin wildcard
    if (globalPerms["*"] === true) {
      return next();
    }

    // 2. Check for global specific action
    if (globalPerms[action] === true) {
      return next();
    }

    // 3. Check for warehouse-specific action
    if (getWarehouseId) {
      const warehouseId = getWarehouseId(req);
      if (warehouseId) {
        const warehousePerms = permissions[warehouseId] || {};
        if (warehousePerms["*"] === true || warehousePerms[action] === true) {
          return next();
        }
      }
    }

    // Fallback: Deny access
    return res.status(403).json({
      success: false,
      data: null,
      messages: {
        vi: "Bạn không có quyền thực hiện hành động này.",
        zh: "您没有执行此操作的权限。",
      },
    });
  };
};

export const requireAnyScopedPermission = (action: string | string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !user.permissions) {
      return sendPermissionDenied(res);
    }

    const permissions = user.permissions as Record<
      string,
      Record<string, unknown>
    >;

    const actions = Array.isArray(action) ? action : [action];
    const hasPermission = Object.values(permissions).some(
      (scopedPermissions) =>
        scopedPermissions["*"] === true ||
        actions.some((item) => scopedPermissions[item] === true),
    );

    if (hasPermission) {
      return next();
    }

    return sendPermissionDenied(res);
  };
};
