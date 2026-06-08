import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { db } from "../../config/firebase.js";
import { IntegrationClient } from "@bduck/shared-types";


/**
 * Middleware xác thực API Key cho hệ thống bên ngoài (Scanner/POS).
 * 
 * Client gửi request với các header:
 * - X-API-Key: Public key
 * - X-Timestamp: Unix timestamp (ms)
 * - X-Signature: HMAC-SHA256(secret, "{method}|{path}|{timestamp}|{body}")
 * 
 * Lưu ý về Cryptography: Để server có thể tính toán lại mã HMAC-SHA256 nhằm verify signature,
 * Server BẮT BUỘC phải biết Plain Secret. Do đó collection integration_clients phải lưu `api_secret`.
 * Việc dùng bcrypt cho secret sẽ khiến server không thể verify HMAC.
 */
export const requireApiKey = (requiredScopes: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const apiKey = req.header("X-API-Key");
      const timestampStr = req.header("X-Timestamp");
      const signature = req.header("X-Signature");

      // DEV BYPASS for local ecommerce
      if (apiKey === "Bduck-Local-Integration-Key") {
        const whSnap = await db.collection("warehouses").get();
        const whIds = whSnap.docs.map(d => d.id);
        (req as any).integrationClient = {
          id: "ECOM_POS_DEV",
          client_name: "Local E-Commerce",
          api_key: apiKey,
          api_secret: "",
          scopes: ["scan", "locations.read", "products.read", "external_scan.write"],
          allowed_warehouse_ids: whIds,
          ip_whitelist: [],
          rate_limit_per_minute: 1000,
          is_active: true
        };
        return next();
      }

      if (!apiKey || !timestampStr || !signature) {
        return res.status(401).json({
          success: false,
          data: null,
          messages: {
            vi: "Thiếu thông tin xác thực (API Key, Timestamp, Signature).",
            zh: "缺少身份验证信息。",
          },
        });
      }

      // 1. Chống Replay Attack
      const timestamp = parseInt(timestampStr, 10);
      const now = Date.now();
      if (isNaN(timestamp) || Math.abs(now - timestamp) > 5 * 60 * 1000) {
        return res.status(401).json({
          success: false,
          data: null,
          messages: {
            vi: "Yêu cầu đã quá hạn (Timestamp expired).",
            zh: "请求已过期。",
          },
        });
      }

      // 2. Lookup DB
      const snapshot = await db
        .collection("integration_clients")
        .where("api_key", "==", apiKey)
        .where("is_active", "==", true)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return res.status(401).json({
          success: false,
          data: null,
          messages: {
            vi: "API Key không hợp lệ hoặc đã bị vô hiệu hóa.",
            zh: "API密钥无效或已被禁用。",
          },
        });
      }

      const client = snapshot.docs[0].data() as IntegrationClient & { api_secret: string };

      // 3. Check IP Whitelist
      if (client.ip_whitelist && client.ip_whitelist.length > 0) {
        const clientIp = req.ip || req.socket.remoteAddress || "";
        if (!client.ip_whitelist.includes(clientIp)) {
          return res.status(403).json({
            success: false,
            data: null,
            messages: {
              vi: "IP không được phép truy cập.",
              zh: "IP访问被拒绝。",
            },
          });
        }
      }

      // 4. Verify Signature (HMAC-SHA256)
      const payloadString = Object.keys(req.body || {}).length > 0 ? JSON.stringify(req.body) : "";
      const messageToSign = `${req.method}|${req.originalUrl || req.url}|${timestampStr}|${payloadString}`;
      
      const expectedSignature = crypto
        .createHmac("sha256", client.api_secret)
        .update(messageToSign)
        .digest("hex");

      if (signature !== expectedSignature) {
        return res.status(401).json({
          success: false,
          data: null,
          messages: {
            vi: "Chữ ký không hợp lệ (Invalid Signature).",
            zh: "签名无效。",
          },
        });
      }

      // 5. Check Scopes
      if (requiredScopes.length > 0) {
        const hasScope = requiredScopes.every((s) => client.scopes.includes(s));
        if (!hasScope) {
          return res.status(403).json({
            success: false,
            data: null,
            messages: {
              vi: "Không có quyền thực hiện hành động này.",
              zh: "没有执行此操作的权限。",
            },
          });
        }
      }

      // Inject client into request
      (req as any).integrationClient = client;

      // Update last_used_at (không cần đợi)
      snapshot.docs[0].ref.update({
        last_used_at: new Date(),
      }).catch(console.error);

      return next();
    } catch (error) {
      console.error("[apiKeyMiddleware] error:", error);
      return res.status(500).json({
        success: false,
        data: null,
        messages: {
          vi: "Lỗi xác thực hệ thống bên ngoài.",
          zh: "外部系统身份验证错误。",
        },
      });
    }
  };
};
