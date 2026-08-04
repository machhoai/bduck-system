"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Clock3,
  FileText,
  LockKeyhole,
  Search,
  ShieldCheck,
} from "lucide-react";
import type {
  CustomerInvoiceRequestCompany,
  CustomerInvoiceRequestPublicView,
  InvoiceDraftBuyer,
} from "@bduck/shared-types";
import {
  customerInvoiceRequestApi,
  CustomerInvoiceRequestApiError,
  type CustomerInvoiceRequestSubmissionPayload,
} from "@/api/customerInvoiceRequestApi";
import { showToast } from "@/utils/toast";
import CustomerInvoiceRequestSkeleton from "./CustomerInvoiceRequestSkeleton";
import {
  customerInvoiceRequestTranslations,
  type CustomerInvoiceRequestLanguage,
} from "./customerInvoiceRequestTranslations";

const EMPTY_BUYER: InvoiceDraftBuyer = {
  full_name: "",
  legal_name: "",
  tax_code: "",
  address: "",
  phone_number: "",
  email: "",
};
const TAX_CODE_PATTERN = /^\d{10}(?:-\d{3})?$/;

const formatVnd = (value: number, language: CustomerInvoiceRequestLanguage) =>
  new Intl.NumberFormat(language === "vi" ? "vi-VN" : "zh-CN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);

const getDeviceId = () => {
  const key = "j_pulse_invoice_request_device_id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const value = crypto.randomUUID();
  window.localStorage.setItem(key, value);
  return value;
};

function Field(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: "text" | "email" | "tel";
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-800">
        {props.label}
      </span>
      <input
        type={props.type ?? "text"}
        required={props.required}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(event) => props.onChange(event.target.value)}
        className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-950 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
      />
    </label>
  );
}

export default function CustomerInvoiceRequestForm({ token }: { token: string }) {
  const [lang, setLang] = useState<CustomerInvoiceRequestLanguage>("vi");
  const [request, setRequest] = useState<CustomerInvoiceRequestPublicView | null>(null);
  const [buyer, setBuyer] = useState<InvoiceDraftBuyer>(EMPTY_BUYER);
  const [companies, setCompanies] = useState<CustomerInvoiceRequestCompany[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const idempotencyKey = useRef<string | null>(null);
  const resolvedTaxCode = useRef<string | null>(null);
  const d = customerInvoiceRequestTranslations[lang];

  const loadRequest = useCallback(async () => {
    setIsLoading(true);
    setLoadError(false);
    try {
      const data = await customerInvoiceRequestApi.get(token);
      setRequest(data);
      if (data.buyer) {
        resolvedTaxCode.current = data.buyer.tax_code;
        setBuyer(data.buyer);
      }
    } catch (error) {
      console.error("[CustomerInvoiceRequestForm] load failed", error);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadRequest();
  }, [loadRequest]);

  useEffect(() => {
    const taxCode = buyer.tax_code.trim();
    setCompanies([]);
    setLookupError("");
    if (
      !TAX_CODE_PATTERN.test(taxCode) ||
      request?.status === "LOCKED" ||
      resolvedTaxCode.current === taxCode
    ) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const result = await customerInvoiceRequestApi.lookupTaxCode(
          token,
          taxCode,
          controller.signal,
        );
        setCompanies(result);
        if (result.length === 0) setLookupError(d.noCompany);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("[CustomerInvoiceRequestForm] tax lookup failed", error);
        if (
          error instanceof CustomerInvoiceRequestApiError &&
          error.code === "INVOICE_REQUEST_EXPIRED"
        ) {
          await loadRequest();
          return;
        }
        setLookupError(error instanceof Error ? error.message : d.noCompany);
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 450);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [buyer.tax_code, d.noCompany, loadRequest, request?.status, token]);

  useEffect(() => {
    if (!request || request.status === "EXPIRED" || request.status === "LOCKED") return;
    const remaining = new Date(request.expires_at).getTime() - Date.now();
    if (remaining <= 0) {
      setRequest((current) => current ? { ...current, status: "EXPIRED" } : current);
      return;
    }
    const timeout = window.setTimeout(() => {
      setCompanies([]);
      setRequest((current) => current ? { ...current, status: "EXPIRED" } : current);
    }, remaining);
    return () => window.clearTimeout(timeout);
  }, [request]);

  const selectCompany = (company: CustomerInvoiceRequestCompany) => {
    resolvedTaxCode.current = company.tax_code;
    setBuyer((current) => ({
      ...current,
      tax_code: company.tax_code,
      legal_name: company.legal_name,
      full_name: current.full_name || company.legal_name,
      address: company.address,
    }));
    setCompanies([]);
    setLookupError("");
  };

  async function submitForm() {
    if (isSubmitting || request?.status === "LOCKED") return;
    setIsSubmitting(true);
    idempotencyKey.current ??= crypto.randomUUID();
    const payload: CustomerInvoiceRequestSubmissionPayload = {
      idempotency_key: idempotencyKey.current,
      action_time: new Date().toISOString(),
      buyer,
    };
    const promise = customerInvoiceRequestApi.submit(
      token,
      payload,
      getDeviceId(),
    );
    try {
      const result = await showToast.promise(promise, {
        loading: d.submitting,
        success: d.submitSuccess,
        error: d.submitError,
        successDescription: d.submitSuccessDescription,
        errorDescription: (error) =>
          error instanceof Error ? error.message : d.submitError,
        retry: () => void submitForm(),
        retryLabel: d.retry,
      });
      setRequest(result);
      resolvedTaxCode.current = result.buyer?.tax_code ?? buyer.tax_code;
      setBuyer(result.buyer ?? buyer);
      idempotencyKey.current = null;
    } catch (error) {
      console.error("[CustomerInvoiceRequestForm] submit failed", error);
      if (
        error instanceof CustomerInvoiceRequestApiError &&
        error.code === "INVOICE_REQUEST_EXPIRED"
      ) {
        await loadRequest();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return <CustomerInvoiceRequestSkeleton />;

  if (loadError || !request) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-5">
        <div className="w-full max-w-md rounded-3xl border border-rose-200 bg-white p-7 text-center shadow-sm">
          <FileText className="mx-auto size-10 text-rose-500" />
          <h1 className="mt-4 text-xl font-bold text-slate-950">{d.invalidLink}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{d.invalidLinkDescription}</p>
          <button type="button" onClick={() => void loadRequest()} className="mt-6 min-h-12 rounded-2xl bg-blue-600 px-6 font-semibold text-white">
            {d.retry}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-5 sm:py-10">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-bold tracking-[0.16em] text-blue-700">{d.brand}</span>
          <button type="button" onClick={() => setLang(lang === "vi" ? "zh" : "vi")} className="min-h-10 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm">
            {d.language}
          </button>
        </div>

        <header className="mt-5 rounded-3xl bg-gradient-to-br from-blue-700 to-blue-500 p-6 text-white shadow-lg shadow-blue-200 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-white/15 p-3"><FileText className="size-7" /></div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{d.title}</h1>
              <p className="mt-2 text-sm leading-6 text-blue-50">{d.subtitle}</p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 rounded-2xl bg-white/10 p-4 text-sm sm:grid-cols-3">
            <div><span className="text-blue-100">{d.localOrder}</span><strong className="mt-1 block break-all font-mono text-white">{request.local_order_id}</strong></div>
            <div><span className="text-blue-100">{d.amount}</span><strong className="mt-1 block text-white">{formatVnd(request.total_amount, lang)}</strong></div>
            <div><span className="text-blue-100">{d.paidAt}</span><strong className="mt-1 block text-white">{new Date(request.payment_time).toLocaleString(lang === "vi" ? "vi-VN" : "zh-CN")}</strong></div>
          </div>
        </header>

        {request.status === "EXPIRED" ? (
          <section className="mt-5 rounded-3xl border border-rose-200 bg-white p-7 text-center shadow-sm">
            <Clock3 className="mx-auto size-10 text-rose-600" />
            <h2 className="mt-4 text-xl font-bold text-slate-950">{d.expiredTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{d.expiredDescription}</p>
            <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {d.expiredAt}: {new Date(request.expires_at).toLocaleString(lang === "vi" ? "vi-VN" : "zh-CN")}
            </p>
          </section>
        ) : request.status === "LOCKED" ? (
          <section className="mt-5 rounded-3xl border border-amber-200 bg-white p-7 text-center shadow-sm">
            <LockKeyhole className="mx-auto size-10 text-amber-600" />
            <h2 className="mt-4 text-xl font-bold text-slate-950">{d.lockedTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{d.lockedDescription}</p>
          </section>
        ) : (
          <form className="mt-5 space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" onSubmit={(event) => { event.preventDefault(); void submitForm(); }}>
            {request.status === "SUBMITTED" && (
              <div className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
                <span>{d.submittedBanner}</span>
              </div>
            )}

            <div>
              <Field label={d.taxCode} value={buyer.tax_code} required onChange={(value) => {
                resolvedTaxCode.current = null;
                setBuyer((current) => ({ ...current, tax_code: value.replace(/[^0-9-]/g, "").slice(0, 14) }));
              }} />
              <p className="mt-1.5 text-xs text-slate-500">{d.taxHint}</p>
              {isSearching && <div className="mt-3 flex items-center gap-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600"><div className="skeleton-pulse h-9 w-9 rounded-xl" />{d.searching}</div>}
              {companies.map((company) => (
                <button key={company.tax_code} type="button" onClick={() => selectCompany(company)} className="mt-3 flex w-full items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-left transition active:scale-[0.99]">
                  <Building2 className="mt-0.5 size-5 shrink-0 text-blue-700" />
                  <span className="min-w-0"><strong className="block text-sm text-slate-950">{company.legal_name}</strong><span className="mt-1 block text-xs leading-5 text-slate-600">{company.address}</span><span className="mt-2 block text-xs font-bold text-blue-700">{d.selectCompany}</span></span>
                </button>
              ))}
              {lookupError && <p className="mt-2 text-sm text-rose-600">{lookupError}</p>}
            </div>

            <Field label={d.legalName} value={buyer.legal_name} required onChange={(value) => setBuyer((current) => ({ ...current, legal_name: value }))} />
            <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-800">{d.address}</span><textarea required rows={3} value={buyer.address} onChange={(event) => setBuyer((current) => ({ ...current, address: event.target.value }))} className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-950 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label>
            <Field label={`${d.buyerName} · ${d.optional}`} value={buyer.full_name} onChange={(value) => setBuyer((current) => ({ ...current, full_name: value }))} />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={d.email} type="email" value={buyer.email} required onChange={(value) => setBuyer((current) => ({ ...current, email: value }))} />
              <Field label={`${d.phone} · ${d.optional}`} type="tel" value={buyer.phone_number} onChange={(value) => setBuyer((current) => ({ ...current, phone_number: value }))} />
            </div>

            <button type="submit" disabled={isSubmitting} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 font-bold text-white shadow-lg shadow-blue-200 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60">
              <ShieldCheck className="size-5" />{isSubmitting ? d.submitting : d.submit}
            </button>
            <p className="flex items-center justify-center gap-2 text-center text-xs leading-5 text-slate-500"><Search className="size-4 shrink-0" />{d.privacy}</p>
          </form>
        )}
      </div>
    </main>
  );
}
