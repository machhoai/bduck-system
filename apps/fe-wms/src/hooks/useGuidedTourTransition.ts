"use client";

import { useEffect } from "react";
import { useNextStep } from "nextstepjs";
import { isVoucherCreateTour } from "@/config/guides/voucherTours";

export function useGuidedTourTransition(activeTourName: string) {
  const { currentTour, isNextStepVisible, startNextStep } = useNextStep();

  useEffect(() => {
    if (
      !isNextStepVisible ||
      !isVoucherCreateTour(currentTour) ||
      currentTour === activeTourName
    ) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      startNextStep(activeTourName);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeTourName, currentTour, isNextStepVisible, startNextStep]);
}
