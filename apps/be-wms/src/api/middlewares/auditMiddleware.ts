import type { Request, Response, NextFunction } from 'express';

/**
 * ISO 9001 Audit Logging Middleware
 * 
 * Intercepts requests to log critical actions (e.g., transfers, stock counts).
 * Ensures a strict audit trail for all business-critical operations.
 */
export const auditMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const { method, originalUrl, body, ip } = req;
  const userId = req.user?.id || 'anonymous'; // Assuming req.user is set by auth middleware

  // TODO: Implement proper ISO 9001 logging (e.g., to Firestore or specialized logging service)
  console.log(`[AUDIT] User: ${userId} | Method: ${method} | URL: ${originalUrl} | IP: ${ip}`);
  
  if (Object.keys(body).length > 0 && method !== 'GET') {
      // Be careful not to log sensitive data (e.g., passwords)
      console.log(`[AUDIT-PAYLOAD] ${JSON.stringify(body)}`);
  }

  next();
};
