export type LocalizedMessages = {
  vi?: string;
  zh?: string;
  en?: string;
  [locale: string]: string | undefined;
};

export type ApiErrorBody = {
  success?: boolean;
  code?: string;
  error?: string;
  message?: string;
  messages?: LocalizedMessages;
  errors?: unknown;
  data?: unknown;
  details?: unknown;
};

export type DetailedApiError = Error & {
  statusCode?: number;
  statusText?: string;
  messages?: LocalizedMessages;
  code?: string;
  body?: ApiErrorBody | null;
  details?: unknown;
  errors?: unknown;
};

const FALLBACK_LOCALE = "vi";

function getPreferredLocale(): string {
  if (typeof window === "undefined") return FALLBACK_LOCALE;

  const storedLocale =
    window.localStorage.getItem("locale") ||
    window.localStorage.getItem("language") ||
    window.localStorage.getItem("i18nextLng");

  if (storedLocale) return storedLocale.toLowerCase().slice(0, 2);

  return window.navigator.language.toLowerCase().slice(0, 2) || FALLBACK_LOCALE;
}

export function getLocalizedMessage(
  messages?: LocalizedMessages | null,
): string | undefined {
  if (!messages) return undefined;

  const locale = getPreferredLocale();
  return (
    messages[locale] ||
    messages[FALLBACK_LOCALE] ||
    messages.en ||
    messages.zh ||
    Object.values(messages).find(Boolean)
  );
}

function appendLine(lines: string[], label: string, value: unknown) {
  if (value === undefined || value === null || value === "") return;
  lines.push(`${label}: ${String(value)}`);
}

function flattenUnknown(value: unknown, depth = 0): string[] {
  if (value === undefined || value === null || value === "") return [];
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }
  if (depth >= 2) return [JSON.stringify(value)];

  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenUnknown(item, depth + 1)).filter(Boolean);
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.message === "string") return [record.message];

    return Object.entries(record).flatMap(([key, entry]) => {
      const flattened = flattenUnknown(entry, depth + 1);
      return flattened.map((item) => `${key}: ${item}`);
    });
  }

  return [];
}

export async function parseApiErrorBody(response: Response): Promise<ApiErrorBody | null> {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return null;

  return response.json().catch(() => null) as Promise<ApiErrorBody | null>;
}

export function createDetailedApiError(
  response: Pick<Response, "status" | "statusText">,
  body: ApiErrorBody | null,
  fallbackMessage: string,
): DetailedApiError {
  const message =
    getLocalizedMessage(body?.messages) ||
    body?.message ||
    body?.error ||
    fallbackMessage;

  const error = new Error(message) as DetailedApiError;
  error.name = "ApiError";
  error.statusCode = response.status;
  error.statusText = response.statusText;
  error.messages = body?.messages;
  error.code = body?.code;
  error.body = body;
  error.details = body?.details ?? body?.data;
  error.errors = body?.errors;

  return error;
}

export async function createApiErrorFromResponse(
  response: Response,
  fallbackMessage: string,
): Promise<DetailedApiError> {
  const body = await parseApiErrorBody(response);
  return createDetailedApiError(response, body, fallbackMessage);
}

export function getDetailedErrorMessage(
  error: unknown,
  fallbackMessage = "Da xay ra loi. Vui long thu lai.",
): string {
  if (!error) return fallbackMessage;
  if (typeof error === "string") return error;

  const apiError = error as DetailedApiError;
  return (
    getLocalizedMessage(apiError.messages) ||
    getLocalizedMessage(apiError.body?.messages) ||
    apiError.message ||
    fallbackMessage
  );
}

export function getDetailedErrorDescription(
  error: unknown,
  fallbackDescription = "Vui long thu lai.",
): string {
  const apiError = error as DetailedApiError;
  const lines: string[] = [];

  appendLine(lines, "Chi tiet", getDetailedErrorMessage(error, fallbackDescription));
  appendLine(lines, "Ma loi", apiError.code || apiError.body?.code);
  if (apiError.statusCode) {
    appendLine(
      lines,
      "HTTP",
      `${apiError.statusCode}${apiError.statusText ? ` ${apiError.statusText}` : ""}`,
    );
  }

  const detailLines = [
    ...flattenUnknown(apiError.errors ?? apiError.body?.errors),
    ...flattenUnknown(apiError.details ?? apiError.body?.details ?? apiError.body?.data),
  ];

  for (const detail of detailLines.slice(0, 8)) {
    appendLine(lines, "Du lieu", detail);
  }

  if (lines.length === 0) return fallbackDescription;
  return lines.join("\n");
}
