import type { Request, Response, NextFunction } from 'express';
import { logAudit } from '../../services/auditService.js';
import { AuditAction } from '@bduck/shared-types';

/**
 * ISO 9001 Audit Logging Middleware
 * 
 * Intercepts requests to log critical actions (e.g., transfers, stock counts).
 * Ensures a strict audit trail for all business-critical operations.
 */
export const auditMiddleware = (action: AuditAction, entityType: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Capture the original send to intercept the response and log after success
    const originalSend = res.json;

    res.json = function (body) {
      // If the request was successful, we log it
      if (res.statusCode >= 200 && res.statusCode < 300 && body?.success !== false) {
        // We log async without awaiting to not block the response
        const userId = (req as any).user?.id || 'system';

        // Entity ID could be in params or body depending on the request type
        // Usually, the newly created ID is in body.data.id, or updated ID in req.params.id
        const entityId = req.params.id || body?.data?.id || 'unknown';

        // Attempt to extract old/new values
        // Note: For a robust system, these values should be set by the service layer
        // We use req.auditContext to allow services to pass this info back to the middleware
        const auditContext = (req as any).auditContext || {};

        logAudit({
          entity_type: entityType,
          entity_id: entityId,
          action: action,
          user_id: userId,
          old_value: auditContext.old_value || null,
          new_value: auditContext.new_value || req.body || null,
          ip_address: req.ip,
          session_token: req.cookies?.__session || null,
          notes: `Action ${action} on ${entityType} via API`
        }).catch((err: unknown) => {
          console.error('[auditMiddleware] Failed to log:', err);
        });
      }

      return originalSend.call(this, body);
    };

    next();
  };
};
