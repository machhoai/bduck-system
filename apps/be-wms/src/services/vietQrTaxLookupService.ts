import { z } from "zod";
import type { CustomerInvoiceRequestCompany } from "@bduck/shared-types";

const responseSchema = z.object({
  code: z.string(),
  desc: z.string().optional(),
  data: z
    .object({
      id: z.union([z.string(), z.number()]),
      name: z.string(),
      internationalName: z.string().nullish(),
      shortName: z.string().nullish(),
      address: z.string().nullish(),
    })
    .nullish(),
});

const cache = new Map<
  string,
  { expiresAt: number; value: CustomerInvoiceRequestCompany }
>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
const TIMEOUT_MS = 5_000;

const serviceError = (
  statusCode: number,
  vi: string,
  zh: string,
  code: string,
) => ({ statusCode, messages: { vi, zh }, data: { code } });

export const lookupVietQrTaxCode = async (
  taxCode: string,
): Promise<CustomerInvoiceRequestCompany> => {
  const cached = cache.get(taxCode);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const baseUrl = process.env.VIETQR_TAX_API_BASE_URL;
  if (!baseUrl) {
    throw serviceError(
      503,
      "Dịch vụ tra cứu mã số thuế chưa được cấu hình.",
      "税号查询服务尚未配置。",
      "VIETQR_NOT_CONFIGURED",
    );
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(
      `${baseUrl.replace(/\/$/, "")}/${encodeURIComponent(taxCode)}`,
      { signal: controller.signal, headers: { Accept: "application/json" } },
    );
    if (response.status === 429) {
      throw serviceError(
        429,
        "Dịch vụ tra cứu mã số thuế đang quá tải. Vui lòng thử lại sau.",
        "税号查询服务请求过多，请稍后重试。",
        "VIETQR_RATE_LIMITED",
      );
    }
    if (response.status === 404) {
      throw serviceError(
        404,
        "Không tìm thấy doanh nghiệp với mã số thuế này.",
        "未找到该税号对应的企业。",
        "TAX_CODE_NOT_FOUND",
      );
    }
    if (!response.ok) throw new Error(`VIETQR_HTTP_${response.status}`);
    const payload = responseSchema.parse(await response.json());
    if (payload.code !== "00" || !payload.data) {
      throw serviceError(
        404,
        "Không tìm thấy doanh nghiệp với mã số thuế này.",
        "未找到该税号对应的企业。",
        "TAX_CODE_NOT_FOUND",
      );
    }
    const company: CustomerInvoiceRequestCompany = {
      tax_code: String(payload.data.id),
      legal_name: payload.data.name.trim(),
      international_name: payload.data.internationalName?.trim() ?? "",
      short_name: payload.data.shortName?.trim() ?? "",
      address: payload.data.address?.trim() ?? "",
    };
    cache.set(taxCode, { expiresAt: Date.now() + CACHE_TTL_MS, value: company });
    return company;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "statusCode" in error
    ) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw serviceError(
        504,
        "Dịch vụ tra cứu mã số thuế phản hồi quá chậm.",
        "税号查询服务响应超时。",
        "VIETQR_TIMEOUT",
      );
    }
    throw serviceError(
      502,
      "Không thể tra cứu mã số thuế lúc này.",
      "当前无法查询税号。",
      "VIETQR_UNAVAILABLE",
    );
  } finally {
    clearTimeout(timeout);
  }
};
