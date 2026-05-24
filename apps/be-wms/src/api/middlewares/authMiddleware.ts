import { Request, Response, NextFunction } from 'express';
import { auth } from '../../config/firebase.js';
import { getUserById, getUserWarehouseRoles, getRoleById } from '../../repositories/userRepository.js';

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionCookie = req.cookies?.__session || '';

    if (!sessionCookie) {
      return res.status(401).json({
        success: false,
        data: null,
        messages: {
          vi: 'Bạn chưa đăng nhập.',
          zh: '您尚未登录。'
        }
      });
    }

    // Verify the session cookie
    const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);
    
    // We could re-fetch the user and permissions here to ensure they are fully up-to-date
    // Or we could attach just the UID and rely on the database for permissions.
    // For maximum security (and since this is a local-first system that requires high consistency on the backend),
    // let's fetch the permissions.
    const user = await getUserById(decodedClaims.uid);
    
    if (!user || user.is_deleted) {
      return res.status(401).json({
        success: false,
        data: null,
        messages: {
          vi: 'Tài khoản không tồn tại hoặc đã bị xóa.',
          zh: '账户不存在或已被删除。'
        }
      });
    }

    const userRoles = await getUserWarehouseRoles(user.id);
    const mergedPermissions: Record<string, unknown> = {};

    for (const userRole of userRoles) {
      if (!userRole.is_active) continue;
      const roleDef = await getRoleById(userRole.role_id);
      if (!roleDef) continue;

      const scope = userRole.warehouse_id || 'global';
      if (!mergedPermissions[scope]) {
        mergedPermissions[scope] = {};
      }

      mergedPermissions[scope] = {
        ...(mergedPermissions[scope] as Record<string, unknown>),
        ...roleDef.permissions
      };
    }

    // Inject into request
    (req as any).user = {
      ...user,
      permissions: mergedPermissions
    };

    return next();
  } catch (error) {
    console.error('[authMiddleware] error:', error);
    return res.status(401).json({
      success: false,
      data: null,
      messages: {
        vi: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
        zh: '登录会话无效或已过期。'
      }
    });
  }
};
