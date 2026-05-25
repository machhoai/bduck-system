import type { Request } from "express";
import type { AuditMetadata } from "../services/auditService.js";

export const getAuditRequestMetadata = (req: Request): AuditMetadata => ({
  action_time: new Date(),
  ip_address: getClientIp(req),
  device_id:
    getHeaderValue(req, "x-device-id") || getHeaderValue(req, "user-agent"),
  session_token: req.cookies?.__session || null,
});

function getClientIp(req: Request) {
  const forwardedFor = getHeaderValue(req, "x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return req.ip || req.socket.remoteAddress || null;
}

function getHeaderValue(req: Request, header: string) {
  const value = req.headers[header];
  if (Array.isArray(value)) return value[0] || null;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
