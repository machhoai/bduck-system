import type { Request, Response } from "express";
import { z } from "zod";
import {
  createLocationSlot,
  deleteLocationSlot,
  deleteLocationSlotProduct,
  fetchLocationSlotById,
  fetchLocationSlotProducts,
  fetchLocationSlots,
  updateLocationSlot,
  upsertLocationSlotProduct,
} from "../../services/locationSlotService.js";
import {
  createLocationSlotSchema,
  idParamSchema,
  slotProductQuerySchema,
  slotQuerySchema,
  updateLocationSlotSchema,
  upsertLocationSlotProductSchema,
} from "../../utils/zodSchemas.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";

const getRequestUserId = (req: Request): string => {
  return (req as any).user?.id || "unknown";
};

const handleSlotError = (res: Response, error: unknown) => {
  console.error("[locationSlotController] error:", error);

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
      vi: "Lá»—i khi xá»­ lÃ½ giá»£i trong vá»‹ trÃ­.",
      zh: "å¤„ç†å­åº“ä½æ—¶å‡ºé”™ã€‚",
    },
    500,
  );
};

export const getLocationSlotsHandler = async (req: Request, res: Response) => {
  try {
    const filters = slotQuerySchema.parse(req.query);
    const slots = await fetchLocationSlots(filters);
    return sendSuccess(res, slots, {
      vi: "Láº¥y danh sÃ¡ch giá»£i thÃ nh cÃ´ng.",
      zh: "æˆåŠŸèŽ·å–å­åº“ä½åˆ—è¡¨ã€‚",
    });
  } catch (error) {
    return handleSlotError(res, error);
  }
};

export const getLocationSlotByIdHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const slot = await fetchLocationSlotById(id);
    return sendSuccess(res, slot, {
      vi: "Láº¥y thÃ´ng tin giá»£i thÃ nh cÃ´ng.",
      zh: "æˆåŠŸèŽ·å–å­åº“ä½ä¿¡æ¯ã€‚",
    });
  } catch (error) {
    return handleSlotError(res, error);
  }
};

export const createLocationSlotHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const data = createLocationSlotSchema.parse(req.body);
    const slot = await createLocationSlot(
      data,
      getRequestUserId(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(
      res,
      slot,
      {
        vi: "Táº¡o giá»£i thÃ nh cÃ´ng.",
        zh: "æˆåŠŸåˆ›å»ºå­åº“ä½ã€‚",
      },
      201,
    );
  } catch (error) {
    return handleSlotError(res, error);
  }
};

export const updateLocationSlotHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const data = updateLocationSlotSchema.parse(req.body);
    await updateLocationSlot(
      id,
      data,
      getRequestUserId(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, null, {
      vi: "Cáº­p nháº­t giá»£i thÃ nh cÃ´ng.",
      zh: "æˆåŠŸæ›´æ–°å­åº“ä½ã€‚",
    });
  } catch (error) {
    return handleSlotError(res, error);
  }
};

export const deleteLocationSlotHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await deleteLocationSlot(
      id,
      getRequestUserId(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, null, {
      vi: "XÃ³a giá»£i thÃ nh cÃ´ng.",
      zh: "æˆåŠŸåˆ é™¤å­åº“ä½ã€‚",
    });
  } catch (error) {
    return handleSlotError(res, error);
  }
};

export const getLocationSlotProductsHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const filters = slotProductQuerySchema.parse(req.query);
    const mappings = await fetchLocationSlotProducts(filters);
    return sendSuccess(res, mappings, {
      vi: "Láº¥y danh sÃ¡ch mapping sáº£n pháº©m thÃ nh cÃ´ng.",
      zh: "æˆåŠŸèŽ·å–äº§å“æ˜ å°„åˆ—è¡¨ã€‚",
    });
  } catch (error) {
    return handleSlotError(res, error);
  }
};

export const upsertLocationSlotProductHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const data = upsertLocationSlotProductSchema.parse(req.body);
    const mapping = await upsertLocationSlotProduct(
      data,
      getRequestUserId(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, mapping, {
      vi: "GÃ¡n sáº£n pháº©m vÃ o giá»£i thÃ nh cÃ´ng.",
      zh: "æˆåŠŸå°†äº§å“åˆ†é…åˆ°å­åº“ä½ã€‚",
    });
  } catch (error) {
    return handleSlotError(res, error);
  }
};

export const deleteLocationSlotProductHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await deleteLocationSlotProduct(
      id,
      getRequestUserId(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, null, {
      vi: "Bá» gÃ¡n sáº£n pháº©m khá»i giá»£i thÃ nh cÃ´ng.",
      zh: "æˆåŠŸç§»é™¤äº§å“æ˜ å°„ã€‚",
    });
  } catch (error) {
    return handleSlotError(res, error);
  }
};
