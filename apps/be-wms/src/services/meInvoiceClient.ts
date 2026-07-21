import type { MeInvoiceTemplate } from "@bduck/shared-types";

export const MEINVOICE_BASE_URLS = {
  SANDBOX: "https://developer.misa.vn/apis/itg/meinvoice",
  PRODUCTION: "https://developer.misa.vn/apis/itg/meinvoice",
} as const;

export interface MeInvoiceCredentials {
  clientSecret: string;
  taxCode: string;
  username: string;
  password: string;
}

export interface MeInvoicePagingInput {
  fromDate: string;
  toDate: string;
  skip: number;
  take: number;
  invSeries?: string[];
}

export interface MeInvoicePagingResult {
  total: number;
  items: Record<string, unknown>[];
}

export interface MeInvoicePublishResult {
  refId: string;
  transactionId: string | null;
  invoiceNumber: string | null;
  invoiceCode: string | null;
  invoiceDate: string | null;
  errorCode: string | null;
}

export interface MeInvoiceStatusResult {
  refId: string | null;
  transactionId: string | null;
  publishStatus: number;
  sendTaxStatus: number | null;
  invoiceCode: string | null;
  isDeleted: boolean;
}

export type MeInvoiceDownloadType = "Pdf" | "Xml";

export interface MeInvoiceDownloadResult {
  transactionId: string;
  data: string;
  errorCode: string | null;
  isUrl: boolean;
}

type FetchImplementation = typeof fetch;

export class MeInvoiceApiError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
    readonly httpStatus: number,
  ) {
    super(message);
    this.name = "MeInvoiceApiError";
  }
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const field = (record: Record<string, unknown>, ...names: string[]) => {
  for (const name of names) {
    if (name in record) return record[name];
  }
  return undefined;
};

const decodeData = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return value;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
};

const decodeList = (value: unknown): unknown[] => {
  const decoded = decodeData(value);
  if (!Array.isArray(decoded)) return [];
  return decoded;
};

const nullableText = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const trustedMeInvoiceUrl = (
  value: string,
  codes: { invalid: string; untrusted: string } = {
    invalid: "INVALID_MEINVOICE_URL",
    untrusted: "UNTRUSTED_MEINVOICE_URL",
  },
): string => {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new MeInvoiceApiError(
      "MISA meInvoice response contains an invalid URL.",
      codes.invalid,
      502,
    );
  }
  if (
    url.protocol !== "https:" ||
    (url.hostname !== "meinvoice.vn" && !url.hostname.endsWith(".meinvoice.vn"))
  ) {
    throw new MeInvoiceApiError(
      "MISA meInvoice response contains an untrusted URL.",
      codes.untrusted,
      502,
    );
  }
  return url.toString();
};

const parseEnvelope = (value: unknown, httpStatus: number) => {
  const record = asRecord(value);
  if (!record) {
    throw new MeInvoiceApiError(
      "MISA meInvoice returned an invalid response.",
      null,
      httpStatus,
    );
  }

  const success = field(record, "success", "Success");
  const errorCode = field(record, "errorCode", "ErrorCode");
  const description = field(
    record,
    "descriptionErrorCode",
    "DescriptionErrorCode",
  );
  const errors = field(record, "errors", "Errors");
  const code = typeof errorCode === "string" && errorCode ? errorCode : null;

  if (success === false || httpStatus < 200 || httpStatus >= 300) {
    const detail =
      typeof description === "string" && description
        ? description
        : typeof errors === "string" && errors
          ? errors
          : code || `HTTP ${httpStatus}`;
    throw new MeInvoiceApiError(
      `MISA meInvoice request failed: ${detail}`,
      code,
      httpStatus,
    );
  }

  return decodeData(field(record, "data", "Data"));
};

const toTemplate = (value: unknown): MeInvoiceTemplate | null => {
  const record = asRecord(value);
  if (!record) return null;
  const series = field(record, "InvSeries", "invSeries");
  if (typeof series !== "string" || !series.trim()) return null;

  const companyId = field(record, "CompanyID", "companyId");
  return {
    ip_template_id: String(field(record, "IPTemplateID", "ipTemplateId") ?? ""),
    company_id: typeof companyId === "number" ? companyId : null,
    template_name: String(field(record, "TemplateName", "templateName") ?? ""),
    inv_template_no: String(
      field(record, "InvTemplateNo", "invTemplateNo") ?? "",
    ),
    inv_series: series.trim(),
    org_inv_series:
      typeof field(record, "OrgInvSeries", "orgInvSeries") === "string"
        ? String(field(record, "OrgInvSeries", "orgInvSeries"))
        : null,
    inactive: field(record, "Inactive", "inactive") === true,
    is_send_summary: field(record, "IsSendSummary", "isSendSummary") === true,
    is_more_vat_rate: field(record, "IsMoreVATRate", "isMoreVATRate") === true,
  };
};

export class MeInvoiceClient {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly clientId: string,
    private readonly fetchImpl: FetchImplementation = fetch,
    private readonly timeoutMs = 15_000,
  ) {
    const normalized = baseUrl.replace(/\/+$/, "");
    if (!Object.values(MEINVOICE_BASE_URLS).includes(normalized as never)) {
      throw new Error("MISA meInvoice base URL is not allowlisted.");
    }
    this.baseUrl = normalized;
  }

  private async request(path: string, init: RequestInit): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
      });
      const body = (await response.json().catch(() => null)) as unknown;
      return parseEnvelope(body, response.status);
    } catch (error) {
      if (error instanceof MeInvoiceApiError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new MeInvoiceApiError(
          "MISA meInvoice request timed out.",
          "TIMEOUT",
          504,
        );
      }
      throw new MeInvoiceApiError(
        "Unable to connect to MISA meInvoice.",
        "NETWORK_ERROR",
        503,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async requestRecord(
    path: string,
    init: RequestInit,
  ): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
      });
      const body = (await response.json().catch(() => null)) as unknown;
      const record = asRecord(body);
      if (!record) {
        throw new MeInvoiceApiError(
          "MISA meInvoice returned an invalid response.",
          null,
          response.status,
        );
      }
      parseEnvelope(record, response.status);
      return record;
    } catch (error) {
      if (error instanceof MeInvoiceApiError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new MeInvoiceApiError(
          "MISA meInvoice request timed out.",
          "TIMEOUT",
          504,
        );
      }
      throw new MeInvoiceApiError(
        "Unable to connect to MISA meInvoice.",
        "NETWORK_ERROR",
        503,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async getToken(credentials: MeInvoiceCredentials): Promise<string> {
    const data = await this.request("/invoice/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ClientID: this.clientId,
        ClientSecret: credentials.clientSecret,
      },
      body: JSON.stringify({
        taxcode: credentials.taxCode,
        username: credentials.username,
        password: credentials.password,
      }),
    });

    if (typeof data !== "string" || !data.trim()) {
      throw new MeInvoiceApiError(
        "MISA meInvoice token response is empty.",
        "INVALID_TOKEN_RESPONSE",
        502,
      );
    }
    return data.trim();
  }

  async listTemplates(
    token: string,
    invoiceWithCode: boolean,
  ): Promise<MeInvoiceTemplate[]> {
    const query = new URLSearchParams({
      invoiceWithCode: String(invoiceWithCode),
      ticket: "false",
      year: String(new Date().getFullYear()),
    });
    const data = await this.request(`/invoice/templates?${query.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ClientID: this.clientId,
        "Content-Type": "application/json",
      },
    });
    // MISA returns an empty string when the account has no templates for the
    // requested invoice type instead of returning an empty JSON array.
    if (typeof data === "string" && data.trim() === "") return [];
    if (!Array.isArray(data)) {
      throw new MeInvoiceApiError(
        "MISA meInvoice template response is not a list.",
        "INVALID_TEMPLATE_RESPONSE",
        502,
      );
    }
    return data
      .map(toTemplate)
      .filter((item): item is MeInvoiceTemplate => item !== null);
  }

  async pageInvoices(
    token: string,
    invoiceWithCode: boolean,
    input: MeInvoicePagingInput,
  ): Promise<MeInvoicePagingResult> {
    const query = new URLSearchParams({
      invoiceWithCode: String(invoiceWithCode),
    });
    const data = await this.request(`/invoice/paging?${query.toString()}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        ClientID: this.clientId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        FromDate: input.fromDate,
        ToDate: input.toDate,
        Skip: input.skip,
        Take: input.take,
        ListInvTemplate: input.invSeries ?? [],
      }),
    });
    const record = asRecord(data);
    const rawItems = record
      ? field(record, "Items", "items", "PageData", "pageData")
      : null;
    const items = Array.isArray(rawItems) ? rawItems : decodeList(rawItems);
    const total = record
      ? Number(field(record, "Total", "total", "TotalCount", "totalCount"))
      : Number.NaN;
    if (!record || !Number.isFinite(total)) {
      throw new MeInvoiceApiError(
        "MISA meInvoice paging response is invalid.",
        "INVALID_PAGING_RESPONSE",
        502,
      );
    }
    return {
      total,
      items: items
        .map(asRecord)
        .filter((item): item is Record<string, unknown> => item !== null),
    };
  }

  async previewInvoice(
    token: string,
    invoiceData: Record<string, unknown>,
  ): Promise<string> {
    const data = await this.request("/invoice/unpublishview", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        ClientID: this.clientId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(invoiceData),
    });
    if (typeof data !== "string" || !data.trim()) {
      throw new MeInvoiceApiError(
        "MISA meInvoice preview response does not contain a URL.",
        "INVALID_PREVIEW_RESPONSE",
        502,
      );
    }
    return trustedMeInvoiceUrl(data, {
      invalid: "INVALID_PREVIEW_URL",
      untrusted: "UNTRUSTED_PREVIEW_URL",
    });
  }

  async publishInvoices(
    token: string,
    signType: number,
    invoiceData: Record<string, unknown>[],
  ): Promise<MeInvoicePublishResult[]> {
    if (invoiceData.length === 0 || invoiceData.length > 30) {
      throw new Error("MEINVOICE_PUBLISH_BATCH_SIZE_INVALID");
    }
    const response = await this.requestRecord("/invoice/publishing", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        ClientID: this.clientId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ SignType: signType, InvoiceData: invoiceData }),
    });
    const rawResults = decodeList(
      field(response, "publishInvoiceResult", "PublishInvoiceResult"),
    );
    if (rawResults.length !== invoiceData.length) {
      throw new MeInvoiceApiError(
        "MISA meInvoice publish response item count does not match the request.",
        "INVALID_PUBLISH_RESPONSE",
        502,
      );
    }
    return rawResults.map((value) => {
      const item = asRecord(value);
      const refId = item ? nullableText(field(item, "RefID", "refId")) : null;
      if (!item || !refId) {
        throw new MeInvoiceApiError(
          "MISA meInvoice publish response is missing RefID.",
          "INVALID_PUBLISH_RESPONSE",
          502,
        );
      }
      return {
        refId,
        transactionId: nullableText(
          field(item, "TransactionID", "transactionId"),
        ),
        invoiceNumber: nullableText(field(item, "InvNo", "invNo")),
        invoiceCode: nullableText(field(item, "InvCode", "invCode")),
        invoiceDate: nullableText(field(item, "InvDate", "invDate")),
        errorCode: nullableText(field(item, "ErrorCode", "errorCode")),
      };
    });
  }

  async getInvoiceStatuses(
    token: string,
    input: {
      refIds: string[];
      invoiceWithCode: boolean;
      invoiceCalculatingMachine: boolean;
    },
  ): Promise<MeInvoiceStatusResult[]> {
    if (input.refIds.length === 0 || input.refIds.length > 30) {
      throw new Error("MEINVOICE_STATUS_BATCH_SIZE_INVALID");
    }
    const query = new URLSearchParams({
      invoiceWithCode: String(input.invoiceWithCode),
      invoiceCalcu: String(input.invoiceCalculatingMachine),
      inputType: "2",
    });
    const data = await this.request(`/invoice/status?${query.toString()}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        ClientID: this.clientId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input.refIds),
    });
    if (!Array.isArray(data)) {
      throw new MeInvoiceApiError(
        "MISA meInvoice status response is not a list.",
        "INVALID_STATUS_RESPONSE",
        502,
      );
    }
    return data.map((value) => {
      const item = asRecord(value);
      const publishStatus = item
        ? Number(field(item, "PublishStatus", "publishStatus"))
        : Number.NaN;
      if (!item || !Number.isInteger(publishStatus)) {
        throw new MeInvoiceApiError(
          "MISA meInvoice status response is invalid.",
          "INVALID_STATUS_RESPONSE",
          502,
        );
      }
      const sendTaxStatus = Number(
        field(item, "SendTaxStatus", "sendTaxStatus"),
      );
      return {
        refId: nullableText(field(item, "RefID", "refId")),
        transactionId: nullableText(
          field(item, "TransactionID", "transactionId"),
        ),
        publishStatus,
        sendTaxStatus: Number.isInteger(sendTaxStatus) ? sendTaxStatus : null,
        invoiceCode: nullableText(field(item, "InvoiceCode", "invoiceCode")),
        isDeleted: field(item, "IsDelete", "isDelete") === true,
      };
    });
  }

  async viewPublishedInvoice(
    token: string,
    transactionId: string,
  ): Promise<string> {
    const data = await this.request("/invoice/publishview", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        ClientID: this.clientId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([transactionId]),
    });
    if (typeof data !== "string" || !data.trim()) {
      throw new MeInvoiceApiError(
        "MISA meInvoice published view response is empty.",
        "INVALID_PUBLISHED_VIEW_RESPONSE",
        502,
      );
    }
    return trustedMeInvoiceUrl(data);
  }

  async downloadInvoice(
    token: string,
    input: {
      transactionId: string;
      invoiceWithCode: boolean;
      invoiceCalculatingMachine: boolean;
      type: MeInvoiceDownloadType;
    },
  ): Promise<MeInvoiceDownloadResult> {
    const query = new URLSearchParams({
      invoiceWithCode: String(input.invoiceWithCode),
      invoiceCalcu: String(input.invoiceCalculatingMachine),
      downloadDataType: input.type,
    });
    const data = await this.request(`/invoice/Download?${query.toString()}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        ClientID: this.clientId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([input.transactionId]),
    });
    if (typeof data === "string" && data.trim().startsWith("https://")) {
      return {
        transactionId: input.transactionId,
        data: trustedMeInvoiceUrl(data),
        errorCode: null,
        isUrl: true,
      };
    }
    const values = Array.isArray(data) ? data : decodeList(data);
    const item = values.map(asRecord).find((candidate) => {
      if (!candidate) return false;
      const transactionId = nullableText(
        field(candidate, "TransactionID", "transactionId"),
      );
      return !transactionId || transactionId === input.transactionId;
    });
    const content = item
      ? nullableText(field(item, "data", "Data", "InvoiceData"))
      : null;
    if (!item || !content) {
      throw new MeInvoiceApiError(
        "MISA meInvoice download response is invalid.",
        "INVALID_DOWNLOAD_RESPONSE",
        502,
      );
    }
    return {
      transactionId:
        nullableText(field(item, "TransactionID", "transactionId")) ??
        input.transactionId,
      data: content,
      errorCode: nullableText(field(item, "ErrorCode", "errorCode")),
      isUrl: false,
    };
  }
}
