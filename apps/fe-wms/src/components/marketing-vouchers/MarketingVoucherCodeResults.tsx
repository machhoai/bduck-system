import type {
  MarketingVoucherCampaign,
  MarketingVoucherCode,
} from "@bduck/shared-types";

import type { Dictionary } from "@/lib/i18n/vi";
import { getMarketingVoucherEffectiveStatus } from "@/utils/marketingVoucherUi";

import { formatVoucherReward } from "./marketingVoucherFormatters";
import { MarketingVoucherStatusBadge } from "./MarketingVoucherStatusBadge";

interface ResultsProps {
  records: MarketingVoucherCode[];
  campaignMap: Map<string, MarketingVoucherCampaign>;
  canSelect: boolean;
  selected: Set<string>;
  allSelected: boolean;
  today: string;
  lang: string;
  copy: Dictionary["marketingVouchers"];
  onToggleAll: () => void;
  onToggleOne: (id: string) => void;
}

const isSelectable = (code: MarketingVoucherCode, canSelect: boolean) =>
  canSelect && ["AVAILABLE", "DISTRIBUTED"].includes(code.status);

export function MarketingVoucherCodeResults({
  records,
  campaignMap,
  canSelect,
  selected,
  allSelected,
  today,
  lang,
  copy,
  onToggleAll,
  onToggleOne,
}: ResultsProps) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-slate-100 bg-white md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xxs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="w-12 p-2">
                {canSelect ? (
                  <input
                    type="checkbox"
                    aria-label={copy.codes.selected}
                    checked={allSelected}
                    onChange={onToggleAll}
                  />
                ) : null}
              </th>
              <th className="p-2">ID</th>
              <th className="p-2">{copy.codes.campaign}</th>
              <th className="p-2">{copy.codes.reward}</th>
              <th className="p-2">{copy.codes.status}</th>
              <th className="p-2">{copy.codes.validTo}</th>
              <th className="p-2">{copy.codes.distributedTo}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records.map((code) => {
              const effectiveStatus = getMarketingVoucherEffectiveStatus(
                code,
                campaignMap.get(code.campaign_id),
                today,
              );
              return (
                <tr key={code.id} className="hover:bg-slate-50/70">
                  <td className="p-2">
                    {isSelectable(code, canSelect) ? (
                      <input
                        type="checkbox"
                        aria-label={code.id}
                        checked={selected.has(code.id)}
                        onChange={() => onToggleOne(code.id)}
                      />
                    ) : null}
                  </td>
                  <td className="p-2 font-mono font-semibold text-slate-950">
                    {code.id}
                  </td>
                  <td className="p-2 text-slate-700">
                    {campaignMap.get(code.campaign_id)?.name ??
                      code.campaign_name}
                  </td>
                  <td className="p-2 text-slate-700">
                    {formatVoucherReward(
                      code.reward_type,
                      code.reward_value,
                      lang,
                    )}
                  </td>
                  <td className="p-2">
                    <MarketingVoucherStatusBadge
                      status={effectiveStatus}
                      label={copy.codeStatus[effectiveStatus]}
                    />
                  </td>
                  <td className="p-2 text-slate-600">{code.valid_to}</td>
                  <td className="p-2 text-slate-500">
                    {code.emailed_to ?? code.distributed_to_phone ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="space-y-2 md:hidden">
        {records.map((code) => {
          const effectiveStatus = getMarketingVoucherEffectiveStatus(
            code,
            campaignMap.get(code.campaign_id),
            today,
          );
          return (
            <article
              key={code.id}
              className="rounded-xl border border-slate-100 bg-white p-3"
            >
              <div className="flex items-start gap-2">
                {isSelectable(code, canSelect) ? (
                  <input
                    type="checkbox"
                    aria-label={code.id}
                    checked={selected.has(code.id)}
                    onChange={() => onToggleOne(code.id)}
                    className="mt-1"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-mono font-semibold text-sm text-slate-950">
                      {code.id}
                    </p>
                    <MarketingVoucherStatusBadge
                      status={effectiveStatus}
                      label={copy.codeStatus[effectiveStatus]}
                    />
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-600">
                    {campaignMap.get(code.campaign_id)?.name ??
                      code.campaign_name}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      {formatVoucherReward(
                        code.reward_type,
                        code.reward_value,
                        lang,
                      )}
                    </span>
                    <span>
                      {copy.codes.validTo}: {code.valid_to}
                    </span>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
