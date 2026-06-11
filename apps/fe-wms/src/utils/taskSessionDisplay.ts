"use client";

import type { Product, WarehouseLocation } from "@bduck/shared-types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeValue(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

export function isUuidLike(value: unknown) {
  return UUID_PATTERN.test(normalizeValue(value));
}

export function pickReadableText(...candidates: unknown[]) {
  for (const candidate of candidates) {
    const normalized = normalizeValue(candidate);
    if (!normalized || isUuidLike(normalized)) continue;
    return normalized;
  }

  return "";
}

export function resolveProductDisplay(
  product: Product | undefined,
  fallback: {
    productId?: string | null;
    productName?: string | null;
    productSku?: string | null;
    barcode?: string | null;
  },
) {
  const name = pickReadableText(product?.name, fallback.productName);
  const sku = pickReadableText(product?.code, fallback.productSku);
  const barcode = pickReadableText(product?.barcode, fallback.barcode);

  return {
    name,
    sku,
    barcode,
    hasReadableIdentity: Boolean(name || sku || barcode),
    technicalId: normalizeValue(fallback.productId),
  };
}

export function resolveLocationDisplay(
  location: WarehouseLocation | undefined,
  fallbackName?: string | null,
  fallbackId?: string | null,
) {
  return pickReadableText(location?.name, fallbackName, fallbackId);
}
