"use client";

import {
  MARKETING_VOUCHER_JOB_STATUSES,
  MARKETING_VOUCHER_JOB_TYPES,
  type MarketingVoucherCampaign,
  type MarketingVoucherJob,
  type MarketingVoucherJobStatus,
  type MarketingVoucherJobType,
} from "@bduck/shared-types";
import { useMemo, useState } from "react";

import {
  createMarketingVoucherIdempotencyKey,
  downloadMarketingVoucherExport,
  resumeMarketingVoucherJob,
} from "@/api/marketingVoucherApi";
import { useMarketingVoucherMutation } from "@/hooks/useMarketingVoucherMutation";
import { useTranslation } from "@/lib/i18n";
import { marketingVoucherJobProgress } from "@/utils/marketingVoucherUi";

import { MarketingVoucherEmailResultsSheet } from "./MarketingVoucherEmailResultsSheet";
import { MarketingVoucherEmptyState } from "./MarketingVoucherEmptyState";
import {
  formatVoucherDateTime,
  formatVoucherNumber,
} from "./marketingVoucherFormatters";
import { MarketingVoucherJobActions } from "./MarketingVoucherJobActions";
import { MarketingVoucherStatusBadge } from "./MarketingVoucherStatusBadge";

const filterClass =
  "h-8 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500";

export function MarketingVoucherJobs({
  jobs,
  campaigns,
  canGenerate,
  canExtend,
  canEmail,
  canExport,
}: {
  jobs: MarketingVoucherJob[];
  campaigns: MarketingVoucherCampaign[];
  canGenerate: boolean;
  canExtend: boolean;
  canEmail: boolean;
  canExport: boolean;
}) {
  const { t, lang } = useTranslation();
  const copy = t.marketingVouchers;
  const [campaignId, setCampaignId] = useState("");
  const [status, setStatus] = useState<MarketingVoucherJobStatus | "">("");
  const [jobType, setJobType] = useState<MarketingVoucherJobType | "">("");
  const [emailResultJobId, setEmailResultJobId] = useState<string | null>(null);
  const { pendingKey, runMutation } = useMarketingVoucherMutation();
  const campaignMap = useMemo(
    () => new Map(campaigns.map((campaign) => [campaign.id, campaign])),
    [campaigns],
  );
  const filtered = useMemo(
    () =>
      jobs.filter(
        (job) =>
          (!campaignId || job.campaign_id === campaignId) &&
          (!status || job.status === status) &&
          (!jobType || job.type === jobType),
      ),
    [campaignId, jobType, jobs, status],
  );

  const canResume = (job: MarketingVoucherJob) =>
    (job.status === "FAILED" && job.type === "GENERATE_CODES" && canGenerate) ||
    (job.status === "FAILED" && job.type === "EXTEND_EXPIRY" && canExtend) ||
    (job.status === "FAILED" && job.type === "EXPORT_EXCEL" && canExport) ||
    (job.status === "PAUSED" && job.type === "EXPORT_EXCEL" && canExport) ||
    (job.status === "PAUSED" && job.type === "SEND_EMAIL" && canEmail);
  const emailResultJob = jobs.find((job) => job.id === emailResultJobId);

  const resume = async (job: MarketingVoucherJob) => {
    const campaign = campaignMap.get(job.campaign_id);
    if (!campaign) return;
    const payload = {
      expected_job_revision: job.revision,
      expected_campaign_revision: campaign.revision,
      idempotency_key: createMarketingVoucherIdempotencyKey("job-resume"),
      action_time: new Date(),
    };
    await runMutation({
      key: `resume:${job.id}`,
      task: () => resumeMarketingVoucherJob(job.id, payload, copy.toasts.error),
      messages: { ...copy.toasts, retry: t.common.retry },
    });
  };

  const download = async (job: MarketingVoucherJob) => {
    const result = await runMutation({
      key: `download:${job.id}`,
      task: () =>
        downloadMarketingVoucherExport(
          job.id,
          {
            idempotency_key:
              createMarketingVoucherIdempotencyKey("export-download"),
            action_time: new Date(),
          },
          copy.toasts.error,
        ),
      messages: {
        ...copy.toasts,
        loading: copy.export.preparingDownload,
        success: copy.export.downloadReady,
        retry: t.common.retry,
      },
    });
    if (!result) return;
    const anchor = document.createElement("a");
    anchor.href = result.url;
    anchor.download = result.file_name;
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const progressCell = (job: MarketingVoucherJob) => {
    const progress = marketingVoucherJobProgress(job);
    return (
      <div className="min-w-36">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-slate-500">
            {formatVoucherNumber(job.progress.succeeded, lang)}/
            {formatVoucherNumber(job.progress.total, lang)}
          </span>
          <span className="font-semibold text-slate-700">{progress}%</span>
        </div>
        <progress
          max={100}
          value={progress}
          className="mt-1 h-1.5 w-full accent-amber-500"
        />
        {job.progress.failed > 0 ? (
          <p className="mt-1 text-xs font-medium text-rose-600">
            {formatVoucherNumber(job.progress.failed, lang)}{" "}
            {copy.jobStatus.FAILED.toLocaleLowerCase()}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-slate-950">{copy.jobs.title}</h2>
      <div className="grid gap-2 rounded-xl border border-slate-100 bg-white p-3 md:grid-cols-3">
        <select
          aria-label={copy.jobs.campaign}
          className={filterClass}
          value={campaignId}
          onChange={(event) => setCampaignId(event.target.value)}
        >
          <option value="">{copy.jobs.campaign}</option>
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name}
            </option>
          ))}
        </select>
        <select
          aria-label={copy.jobs.type}
          className={filterClass}
          value={jobType}
          onChange={(event) =>
            setJobType(event.target.value as MarketingVoucherJobType | "")
          }
        >
          <option value="">{copy.jobs.type}</option>
          {MARKETING_VOUCHER_JOB_TYPES.map((value) => (
            <option key={value} value={value}>
              {copy.jobType[value]}
            </option>
          ))}
        </select>
        <select
          aria-label={copy.campaigns.status}
          className={filterClass}
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as MarketingVoucherJobStatus | "")
          }
        >
          <option value="">{copy.campaigns.status}</option>
          {MARKETING_VOUCHER_JOB_STATUSES.map((value) => (
            <option key={value} value={value}>
              {copy.jobStatus[value]}
            </option>
          ))}
        </select>
      </div>
      {filtered.length === 0 ? (
        <MarketingVoucherEmptyState title={copy.jobs.empty} />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-slate-100 bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xxs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="p-2">{copy.jobs.campaign}</th>
                  <th className="p-2">{copy.jobs.type}</th>
                  <th className="p-2">{copy.campaigns.status}</th>
                  <th className="p-2">{copy.jobs.progress}</th>
                  <th className="p-2">{copy.jobs.attempts}</th>
                  <th className="p-2">{copy.jobs.requestedAt}</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50/70">
                    <td className="p-2">
                      <p className="font-semibold text-slate-950">
                        {campaignMap.get(job.campaign_id)?.name ??
                          job.campaign_id}
                      </p>
                      {job.last_error_message ? (
                        <p
                          className="mt-0.5 max-w-64 truncate text-xs text-rose-600"
                          title={job.last_error_message}
                        >
                          {job.last_error_message}
                        </p>
                      ) : null}
                    </td>
                    <td className="p-2 text-slate-700">
                      {copy.jobType[job.type]}
                    </td>
                    <td className="p-2">
                      <MarketingVoucherStatusBadge
                        status={job.status}
                        label={copy.jobStatus[job.status]}
                      />
                    </td>
                    <td className="p-2">{progressCell(job)}</td>
                    <td className="p-2 text-center font-semibold text-slate-700">
                      {job.attempt_count}
                    </td>
                    <td className="p-2 text-slate-500 text-xs">
                      {formatVoucherDateTime(job.created_at, lang)}
                    </td>
                    <td className="p-2">
                      <MarketingVoucherJobActions
                        job={job}
                        canResume={canResume(job)}
                        canDownload={
                          canExport &&
                          campaignMap.get(job.campaign_id)?.status === "ACTIVE"
                        }
                        isPending={Boolean(pendingKey)}
                        copy={copy}
                        onResume={() => void resume(job)}
                        onViewResults={() => setEmailResultJobId(job.id)}
                        onDownload={() => void download(job)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 md:hidden">
            {filtered.map((job) => (
              <article
                key={job.id}
                className="rounded-xl border border-slate-100 bg-white p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-950 text-sm">
                      {campaignMap.get(job.campaign_id)?.name ??
                        job.campaign_id}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {copy.jobType[job.type]}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <MarketingVoucherStatusBadge
                      status={job.status}
                      label={copy.jobStatus[job.status]}
                    />
                  </div>
                </div>
                <div className="mt-3">{progressCell(job)}</div>
                {job.last_error_message ? (
                  <p className="mt-2 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">
                    {job.last_error_message}
                  </p>
                ) : null}
                <div className="mt-2">
                  <MarketingVoucherJobActions
                    job={job}
                    canResume={canResume(job)}
                    canDownload={
                      canExport &&
                      campaignMap.get(job.campaign_id)?.status === "ACTIVE"
                    }
                    isPending={Boolean(pendingKey)}
                    copy={copy}
                    onResume={() => void resume(job)}
                    onViewResults={() => setEmailResultJobId(job.id)}
                    onDownload={() => void download(job)}
                  />
                </div>
              </article>
            ))}
          </div>
        </>
      )}
      {emailResultJob?.type === "SEND_EMAIL" ? (
        <MarketingVoucherEmailResultsSheet
          job={emailResultJob}
          campaign={campaignMap.get(emailResultJob.campaign_id)}
          canEmail={canEmail}
          onClose={() => setEmailResultJobId(null)}
        />
      ) : null}
    </div>
  );
}
