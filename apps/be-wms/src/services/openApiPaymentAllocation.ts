import type { RevenuePaymentCategory } from "@bduck/shared-types";

type JsonRecord = Record<string, unknown>;
export type OpenApiPaymentMapping = Record<string, RevenuePaymentCategory>;

export interface OpenApiPaymentChannel {
  method: string;
  category: RevenuePaymentCategory;
  amount: number;
}

export function allocateOpenApiPaymentChannels(
  row: JsonRecord,
  mapping: OpenApiPaymentMapping,
  totalRevenue: number,
): OpenApiPaymentChannel[] {
  const groups = [
    {
      values: row.onlines,
      codeKeys: ["channelNo"],
      nameKeys: ["channelName"],
      scalarKey: "onlineMoney",
      fallbackMethod: "online",
      defaultCategory: "other" as const,
    },
    {
      values: row.customs,
      codeKeys: ["customNo"],
      nameKeys: ["customName"],
      scalarKey: "customMoney",
      fallbackMethod: "custom",
      defaultCategory: "other" as const,
    },
    {
      values: row.writeoffs,
      codeKeys: ["channelNo", "channelId"],
      nameKeys: ["channelName"],
      scalarKey: "writeoffMoney",
      fallbackMethod: "writeoff",
      defaultCategory: "other" as const,
    },
  ];
  const candidates: OpenApiPaymentChannel[] = [];
  const cash = Math.max(0, firstNumber(row, ["cashRealMoney"]));
  if (cash > 0) candidates.push({ method: "cash", category: "cash", amount: cash });

  for (const group of groups) {
    let detailTotal = 0;
    if (Array.isArray(group.values)) {
      for (const raw of group.values) {
        const item = asRecord(raw);
        const code = firstText(item, group.codeKeys);
        const name = firstText(item, group.nameKeys);
        const amount = firstNumber(item, ["money", "amount", "realMoney"]);
        if (amount <= 0) continue;
        detailTotal += amount;
        candidates.push({
          method: name || code || group.fallbackMethod,
          category: resolveCategory(
            code,
            name,
            mapping,
            group.defaultCategory,
          ),
          amount,
        });
      }
    }
    const scalarTotal = Math.max(0, firstNumber(row, [group.scalarKey]));
    const missingDetail = Math.max(0, scalarTotal - detailTotal);
    if (missingDetail > 0) {
      candidates.push({
        method: group.fallbackMethod,
        category: group.defaultCategory,
        amount: missingDetail,
      });
    }
  }

  let remaining = Math.max(0, totalRevenue);
  const allocated: OpenApiPaymentChannel[] = [];
  for (const candidate of candidates) {
    const amount = Math.min(candidate.amount, remaining);
    if (amount <= 0) break;
    allocated.push({ ...candidate, amount });
    remaining -= amount;
  }
  if (remaining > 0) {
    allocated.push({ method: "other", category: "other", amount: remaining });
  }
  return allocated;
}

export function normalizeOpenApiPaymentMapping(
  mapping: OpenApiPaymentMapping,
): OpenApiPaymentMapping {
  return Object.fromEntries(
    Object.entries(mapping).map(([key, value]) => [normalizeText(key), value]),
  );
}

function resolveCategory(
  code: string,
  name: string,
  mapping: OpenApiPaymentMapping,
  fallback: RevenuePaymentCategory,
): RevenuePaymentCategory {
  for (const candidate of [code, name]) {
    const configured = mapping[normalizeText(candidate)];
    if (configured) return configured;
  }
  const combined = normalizeText(`${code} ${name}`);
  if (/cash|tien mat/u.test(combined)) return "cash";
  if (/bank|qr|transfer|chuyen khoan|debit|recordpayment/u.test(combined)) {
    return "transfer";
  }
  return fallback;
}

function firstText(row: JsonRecord, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function firstNumber(row: JsonRecord, keys: string[]): number {
  for (const key of keys) {
    const value = Number(row[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" ? (value as JsonRecord) : {};
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .trim()
    .toLowerCase();
}
