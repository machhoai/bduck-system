"use client";

import { useTranslation } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { FileQuestion, ShieldAlert, Lock } from "lucide-react";
import React from "react";

interface ErrorPageProps {
  statusCode: "401" | "403" | "404";
}

export function ErrorPage({ statusCode }: ErrorPageProps) {
  const { t } = useTranslation();
  const router = useRouter();

  const config = {
    "401": {
      icon: Lock,
      title: t.errorPage["401"].title,
      description: t.errorPage["401"].description,
      actionText: t.errorPage["401"].action,
      action: () => router.push("/login"),
      illustration: (
        <div className="relative w-32 h-32 mx-auto mb-6 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-100 rounded-lg transform rotate-3 scale-90" />
          <div className="absolute inset-0 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center shadow-sm">
            <Lock className="w-12 h-12 text-slate-400" strokeWidth={1.5} />
            <div className="absolute bottom-2 right-2 bg-white rounded-full p-1 shadow-sm">
              <div className="w-3 h-3 bg-red-400 rounded-full" />
            </div>
          </div>
        </div>
      ),
    },
    "403": {
      icon: ShieldAlert,
      title: t.errorPage["403"].title,
      description: t.errorPage["403"].description,
      actionText: t.errorPage["403"].action,
      action: () => router.push("/"),
      illustration: (
        <div className="relative w-40 h-32 mx-auto mb-6 flex items-center justify-center">
          <div className="w-full h-8 bg-slate-200 rounded-md flex overflow-hidden opacity-80">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex-1 border-r-8 border-transparent" style={{ borderRightColor: 'white', borderRightWidth: '10px', transform: 'skewX(-20deg)', transformOrigin: 'bottom' }} />
            ))}
          </div>
          <div className="absolute -top-4 w-12 h-12 bg-white border-2 border-slate-200 rounded-md flex items-center justify-center shadow-sm">
            <div className="w-1 h-4 bg-slate-300 rounded-full mb-1" />
            <div className="w-1 h-1 bg-slate-300 rounded-full absolute bottom-2" />
          </div>
          <div className="absolute bottom-0 w-2 h-6 bg-slate-300 left-8" />
          <div className="absolute bottom-0 w-2 h-6 bg-slate-300 right-8" />
        </div>
      ),
    },
    "404": {
      icon: FileQuestion,
      title: t.errorPage["404"].title,
      description: t.errorPage["404"].description,
      actionText: t.errorPage["404"].action,
      action: () => router.push("/"),
      illustration: (
        <div className="relative w-32 h-32 mx-auto mb-6 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-100 rounded-lg transform -rotate-6 scale-90 translate-x-2" />
          <div className="absolute inset-0 bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col p-4">
            <div className="w-16 h-2 bg-slate-200 rounded-full mb-3" />
            <div className="w-20 h-2 bg-slate-100 rounded-full mb-2" />
            <div className="w-12 h-2 bg-slate-100 rounded-full mb-2" />
            <div className="w-24 h-2 bg-slate-100 rounded-full mb-2" />
          </div>
          <div className="absolute -bottom-2 -right-2">
            <FileQuestion className="w-14 h-14 text-slate-800 bg-white rounded-full" strokeWidth={1.5} />
          </div>
        </div>
      ),
    },
  };

  const { title, description, actionText, action, illustration } = config[statusCode];

  return (
    <div className="flex-1 w-full h-full min-h-[80vh] flex flex-col items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-100 p-8 sm:p-12 text-center flex flex-col items-center">
        {illustration}
        <h1 className="text-4xl font-bold text-blue-500 mb-2">{statusCode}</h1>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">{title}</h2>
        <p className="text-sm text-slate-500 mb-8">{description}</p>
        
        <button
          onClick={action}
          className="bg-slate-900 hover:bg-slate-800 transition-colors text-white rounded-full px-8 py-2 font-medium w-fit text-sm"
        >
          {actionText}
        </button>
      </div>
    </div>
  );
}
