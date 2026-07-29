"use client";

import type { EmployeeContract } from "@bduck/shared-types";
import { Pencil, RefreshCw, XCircle } from "lucide-react";
import type { EmployeeContractLifecycleMode } from "./EmployeeContractLifecycleSheet";
import type { EmployeeContractLabels } from "./employeeContractUiTypes";
import {
  canCancelContract,
  canRenewContract,
  canTerminateContract,
  resolveContractUiStatus,
} from "./employeeContractUiPolicy";
import { EmployeeContractStatus } from "@bduck/shared-types";

interface EmployeeContractActionBarProps {
  contract: EmployeeContract;
  labels: EmployeeContractLabels;
  canManage: boolean;
  canTerminate: boolean;
  onEdit: () => void;
  onRenew: () => void;
  onLifecycle: (mode: EmployeeContractLifecycleMode) => void;
}

export function EmployeeContractActionBar(
  props: EmployeeContractActionBarProps,
) {
  const { contract, labels } = props;
  const status = resolveContractUiStatus(contract);
  const canEdit = ![
    EmployeeContractStatus.CANCELLED,
    EmployeeContractStatus.TERMINATED,
  ].includes(status);
  return (
    <div className="flex flex-wrap gap-2">
      {props.canManage && canEdit ? (
        <ActionButton
          icon={Pencil}
          label={labels.actions.edit}
          onClick={props.onEdit}
        />
      ) : null}
      {props.canManage && canRenewContract(contract) ? (
        <ActionButton
          icon={RefreshCw}
          label={labels.actions.renew}
          onClick={props.onRenew}
        />
      ) : null}
      {props.canTerminate && canCancelContract(contract) ? (
        <ActionButton
          icon={XCircle}
          label={labels.actions.cancel}
          onClick={() => props.onLifecycle("cancel")}
        />
      ) : null}
      {props.canTerminate && canTerminateContract(contract) ? (
        <ActionButton
          icon={XCircle}
          label={labels.actions.terminate}
          onClick={() => props.onLifecycle("terminate")}
        />
      ) : null}
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Pencil;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--color-border-subtle)] px-3 text-xs font-semibold text-[var(--color-text-secondary)]"
    >
      <Icon size={13} />
      {label}
    </button>
  );
}
