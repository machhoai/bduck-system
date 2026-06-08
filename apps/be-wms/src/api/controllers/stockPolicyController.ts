import type { Request, Response } from "express";
import { z } from "zod";
import {
  deleteStockPolicy,
  fetchStockPolicies,
  upsertStockPolicy,
} from "../../services/stockPolicyService.js";
import {
  idParamSchema,
  stockPolicyQuerySchema,
  upsertStockPolicySchema,
} from "../../utils/zodSchemas.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";

const getRequestUserId = (req: Request): string => {
  return (req as any).user?.id || "unknown";
};

const handleStockPolicyError = (res: Response, error: unknown) => {
  console.error("[stockPolicyController] error:", error);

  if (error instanceof z.ZodError) {
    return sendError(
      res,
      {
        vi: "Dá»¯ liá»‡u Ä‘áº§u vÃ o khÃ´ng há»£p lá»‡.",
        zh: "è¾“å…¥æ•°æ®æ— æ•ˆã€‚",
      },
      400,
      error.flatten(),
    );
  }

  const apiError = error as {
    statusCode?: number;
    messages?: { vi: string; zh: string };
  };

  if (apiError.statusCode && apiError.messages) {
    return sendError(res, apiError.messages, apiError.statusCode);
  }

  return sendError(
    res,
    {
      vi: "Lá»—i khi xá»­ lÃ½ chÃ­nh sÃ¡ch tá»“n kho.",
      zh: "å¤„ç†åº“å­˜ç­–ç•¥æ—¶å‡ºé”™ã€‚",
    },
    500,
  );
};

export const getStockPoliciesHandler = async (req: Request, res: Response) => {
  try {
    const filters = stockPolicyQuerySchema.parse(req.query);
    const policies = await fetchStockPolicies(filters as any);
    return sendSuccess(res, policies, {
      vi: "Láº¥y chÃ­nh sÃ¡ch tá»“n kho thÃ nh cÃ´ng.",
      zh: "æˆåŠŸèŽ·å–åº“å­˜ç­–ç•¥ã€‚",
    });
  } catch (error) {
    return handleStockPolicyError(res, error);
  }
};

export const upsertStockPolicyHandler = async (req: Request, res: Response) => {
  try {
    const data = upsertStockPolicySchema.parse(req.body);
    const policy = await upsertStockPolicy(
      data,
      getRequestUserId(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, policy, {
      vi: "LÆ°u chÃ­nh sÃ¡ch tá»“n kho thÃ nh cÃ´ng.",
      zh: "æˆåŠŸä¿å­˜åº“å­˜ç­–ç•¥ã€‚",
    });
  } catch (error) {
    return handleStockPolicyError(res, error);
  }
};

export const deleteStockPolicyHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await deleteStockPolicy(
      id,
      getRequestUserId(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, null, {
      vi: "XÃ³a chÃ­nh sÃ¡ch tá»“n kho thÃ nh cÃ´ng.",
      zh: "æˆåŠŸåˆ é™¤åº“å­˜ç­–ç•¥ã€‚",
    });
  } catch (error) {
    return handleStockPolicyError(res, error);
  }
};
