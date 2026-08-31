import type { RevenueExportRequest } from "@bduck/shared-types";

import { authenticatedFetch } from "@/utils/authenticatedFetch";
import { downloadBlob } from "@/utils/reportExcelClient";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

function getDownloadFileName(
  disposition: string | null,
  fallback: string,
): string {
  if (!disposition) return fallback;

  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/iu)?.[1];
  if (encoded) return decodeURIComponent(encoded.replace(/["']/gu, ""));

  return disposition.match(/filename="?([^";]+)"?/iu)?.[1] ?? fallback;
}

export async function downloadRevenueExport(
  request: RevenueExportRequest,
  fallbackError: string,
): Promise<void> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/api/revenue/export`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.messages?.[request.locale] ?? fallbackError);
  }

  const fallbackName = `revenue-${request.reportType.toLowerCase()}.xlsx`;
  downloadBlob(
    await response.blob(),
    getDownloadFileName(
      response.headers.get("Content-Disposition"),
      fallbackName,
    ),
  );
}
