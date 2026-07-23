import type { NextFunction, Request, Response } from "express";
import {
  LOCAL_FIREBASE_TARGET_HEADER,
  isLocalFirebaseTarget,
  isLocalFirebaseTargetSelectionEnabled,
  runWithLocalFirebaseTarget,
} from "../../config/firebaseTargetContext.js";
import {
  defaultLocalFirebaseTarget,
  isLocalFirebaseTargetConfigured,
} from "../../config/firebase.js";

export function selectLocalFirebaseTarget(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!isLocalFirebaseTargetSelectionEnabled()) {
    return next();
  }

  const requestedTarget = req.get(LOCAL_FIREBASE_TARGET_HEADER);
  const target = requestedTarget ?? defaultLocalFirebaseTarget;

  if (!isLocalFirebaseTarget(target)) {
    return res.status(400).json({
      success: false,
      data: null,
      messages: {
        vi: "Nguồn dữ liệu local không hợp lệ.",
        zh: "本地数据源无效。",
      },
    });
  }

  if (!isLocalFirebaseTargetConfigured(target)) {
    return res.status(503).json({
      success: false,
      data: null,
      messages: {
        vi: `Nguồn dữ liệu ${target} chưa được cấu hình trên local.`,
        zh: `本地数据源 ${target} 尚未配置。`,
      },
    });
  }

  res.setHeader(LOCAL_FIREBASE_TARGET_HEADER, target);
  return runWithLocalFirebaseTarget(target, next);
}
