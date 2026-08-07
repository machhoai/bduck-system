"use client";

import { ExternalLink, ShieldCheck, UserRoundCog } from "lucide-react";
import Link from "next/link";

import { usePosManagementCopy } from "./usePosManagementCopy";

export function PosAccessPanel({ warehouseId }: { warehouseId: string }) {
  const copy = usePosManagementCopy();
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 p-4">
        <UserRoundCog className="text-amber-600" size={22} />
        <h2 className="mt-2 text-sm font-black text-slate-900">{copy.accountTitle}</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">{copy.accountHint}</p>
        <Link href={`/users?warehouse_id=${warehouseId}&permission=pos.login`} className="mt-3 inline-flex h-8 items-center gap-2 rounded-lg bg-amber-500 px-3 text-xs font-bold text-white">{copy.manageAccounts} <ExternalLink size={14} /></Link>
      </section>
      <section className="rounded-xl border border-slate-200 p-4">
        <ShieldCheck className="text-amber-600" size={22} />
        <h2 className="mt-2 text-sm font-black text-slate-900">{copy.roleTitle}</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">{copy.roleHint}</p>
        <Link href={`/users?tab=roles&warehouse_id=${warehouseId}&group=pos`} className="mt-3 inline-flex h-8 items-center gap-2 rounded-lg border border-amber-300 px-3 text-xs font-bold text-amber-800">{copy.manageRoles} <ExternalLink size={14} /></Link>
      </section>
    </div>
  );
}
