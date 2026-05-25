"use client";

import dynamic from "next/dynamic";
import React from "react";
import { Skeleton } from "../../../components/ui/Skeleton";

const LoginForm = dynamic(() => import("../../../components/auth/LoginForm"), {
  ssr: false,
  loading: () => (
    <div className="grid min-h-screen grid-cols-1 bg-[var(--color-surface-base)] lg:grid-cols-[minmax(0,1fr)_480px]">
      <div className="hidden bg-[var(--color-surface-elevated)] px-10 lg:flex lg:items-center lg:justify-center">
        <div className="w-full max-w-[720px] space-y-6">
          <Skeleton variant="rect" className="h-11 w-44 rounded-full" />
          <Skeleton variant="text" className="h-14 w-4/5" />
          <Skeleton variant="text" className="h-8 w-2/3" />
        </div>
      </div>
      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[400px] space-y-5">
          <Skeleton variant="text" className="h-10 w-44" />
          <Skeleton variant="rect" className="h-11 w-full rounded-full" />
          <Skeleton variant="rect" className="h-11 w-full rounded-full" />
          <Skeleton variant="rect" className="h-11 w-full rounded-full" />
        </div>
      </div>
    </div>
  ),
});

export default function LoginPage() {
  return <LoginForm />;
}
