"use client";

import { useTranslation } from "@/lib/i18n";
import { employeeContractTranslations } from "@/lib/i18n/employeeContractTranslations";

export const useEmployeeContractLabels = () => {
  const { lang } = useTranslation();
  return employeeContractTranslations[lang];
};
