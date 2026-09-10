import type { MarketingVoucherCampaign } from "@bduck/shared-types";
import {
  Edit3,
  FileSpreadsheet,
  Paintbrush,
  Pause,
  Play,
  Sparkles,
  TimerReset,
  Trash2,
} from "lucide-react";

import type { Dictionary } from "@/lib/i18n/vi";

import type { MarketingVoucherCampaignAction } from "./MarketingVoucherCampaignActionSheet";

export interface MarketingVoucherPermissions {
  canWrite: boolean;
  canGenerate: boolean;
  canExtend: boolean;
  canAppearance: boolean;
  canExport: boolean;
}

export function MarketingVoucherCampaignActions({
  campaign,
  permissions,
  copy,
  onEdit,
  onAppearance,
  onAction,
  onExport,
  isPending,
}: {
  campaign: MarketingVoucherCampaign;
  permissions: MarketingVoucherPermissions;
  copy: Dictionary["marketingVouchers"];
  onEdit: () => void;
  onAppearance: () => void;
  onAction: (action: MarketingVoucherCampaignAction) => void;
  onExport: () => void;
  isPending: boolean;
}) {
  const actions = [
    {
      show:
        permissions.canExport &&
        campaign.purpose === "PRINT" &&
        campaign.status === "ACTIVE" &&
        !campaign.active_generation_job_id &&
        !campaign.active_extension_job_id &&
        !campaign.active_export_job_id,
      label: copy.campaigns.export,
      icon: FileSpreadsheet,
      tone: "hover:bg-emerald-50 hover:text-emerald-700",
      onClick: onExport,
    },
    {
      show: permissions.canWrite && !campaign.active_export_job_id,
      label: copy.campaigns.edit,
      icon: Edit3,
      tone: "hover:bg-slate-100 hover:text-slate-900",
      onClick: onEdit,
    },
    {
      show:
        permissions.canWrite &&
        ["ACTIVE", "GENERATING"].includes(campaign.status),
      label: copy.campaigns.pause,
      icon: Pause,
      tone: "hover:bg-amber-50 hover:text-amber-700",
      onClick: () => onAction("pause"),
    },
    {
      show: permissions.canWrite && campaign.status === "PAUSED",
      label: copy.campaigns.activate,
      icon: Play,
      tone: "hover:bg-emerald-50 hover:text-emerald-700",
      onClick: () => onAction("activate"),
    },
    {
      show:
        permissions.canGenerate &&
        campaign.status === "ACTIVE" &&
        !campaign.active_generation_job_id &&
        !campaign.active_extension_job_id &&
        !campaign.active_export_job_id,
      label: copy.campaigns.generate,
      icon: Sparkles,
      tone: "hover:bg-sky-50 hover:text-sky-700",
      onClick: () => onAction("generate"),
    },
    {
      show: permissions.canAppearance,
      label: copy.campaigns.appearance,
      icon: Paintbrush,
      tone: "hover:bg-fuchsia-50 hover:text-fuchsia-700",
      onClick: onAppearance,
    },
    {
      show:
        permissions.canExtend &&
        campaign.status === "ACTIVE" &&
        !campaign.active_generation_job_id &&
        !campaign.active_extension_job_id &&
        !campaign.active_export_job_id,
      label: copy.campaigns.extend,
      icon: TimerReset,
      tone: "hover:bg-violet-50 hover:text-violet-700",
      onClick: () => onAction("extend"),
    },
    {
      show: permissions.canWrite,
      label: copy.campaigns.end,
      icon: Trash2,
      tone: "hover:bg-rose-50 hover:text-rose-700",
      onClick: () => onAction("end"),
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {actions.map(({ show, label, icon: Icon, tone, onClick }) =>
        show ? (
          <button
            key={label}
            type="button"
            disabled={isPending}
            onClick={onClick}
            aria-label={label}
            title={label}
            className={`grid h-8 w-8 place-items-center rounded text-slate-500 disabled:cursor-not-allowed disabled:opacity-40 ${tone}`}
          >
            <Icon size={14} />
          </button>
        ) : null,
      )}
    </div>
  );
}
